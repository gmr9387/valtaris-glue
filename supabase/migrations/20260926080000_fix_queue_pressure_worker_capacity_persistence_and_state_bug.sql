-- Fixes two real bugs found while assessing Scale Ops:
-- 1. capture_queue_pressure() filtered workflow_jobs.state = 'pending',
--    a value the real job-lifecycle engine never sets. The real,
--    confirmed vocabulary (traced through _shared/triggers.ts,
--    trigger-job, job-lifecycle) is: queued (created) -> running
--    (claimed+dispatched) -> completed/failed, with failed retrying
--    into retrying/delayed/dead_letter. Fixed to filter on 'queued'.
-- 2. Neither RPC ever persisted its computed snapshot anywhere queryable
--    -- scale-monitor invoked them and returned the result in its own
--    HTTP response, but nothing wrote to a table the frontend
--    (useScaleOps.ts) could read; queue_pressure_signals and
--    worker_capacity_snapshots didn't exist. Created both tables
--    (RLS: platform-operator only, matching the other cross-tenant
--    infra tables -- these are genuinely cross-tenant queue/worker
--    telemetry, no tenant_id possible) and wired both RPCs to insert a
--    real snapshot row per call, in addition to their existing
--    telemetry_aggregates writes and transient RETURN QUERY (unchanged,
--    so scale-monitor's own response shape is unaffected).
--
-- pressure_score = backlog (queued+retrying+delayed) / partition's
-- max_concurrency (floor 1 to avoid div-by-zero), a simple, honestly
-- documented ratio -- not a sophisticated model. recommendation fires
-- only when that ratio exceeds 2x.
--
-- Already applied and verified live (dry-run in a rolled-back
-- transaction first, confirmed both functions execute without error).
CREATE TABLE glue.queue_pressure_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  partition_key text NOT NULL,
  queued integer NOT NULL DEFAULT 0,
  retrying integer NOT NULL DEFAULT 0,
  delayed integer NOT NULL DEFAULT 0,
  in_flight integer NOT NULL DEFAULT 0,
  dead_letter integer NOT NULL DEFAULT 0,
  pressure_score numeric NOT NULL DEFAULT 0,
  recommendation text
);
CREATE INDEX idx_queue_pressure_signals_captured_at ON glue.queue_pressure_signals (captured_at DESC);
ALTER TABLE glue.queue_pressure_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform-operator-select-queue-pressure-signals" ON glue.queue_pressure_signals
  FOR SELECT USING (EXISTS (SELECT 1 FROM glue.platform_operators po WHERE po.user_id = (SELECT auth.uid())));
GRANT SELECT ON glue.queue_pressure_signals TO authenticated;

CREATE TABLE glue.worker_capacity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  worker_id text NOT NULL,
  region text,
  active_jobs integer NOT NULL DEFAULT 0,
  max_concurrency integer NOT NULL DEFAULT 0,
  saturation numeric NOT NULL DEFAULT 0,
  health_state text NOT NULL DEFAULT 'unknown'
);
CREATE INDEX idx_worker_capacity_snapshots_captured_at ON glue.worker_capacity_snapshots (captured_at DESC);
ALTER TABLE glue.worker_capacity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform-operator-select-worker-capacity-snapshots" ON glue.worker_capacity_snapshots
  FOR SELECT USING (EXISTS (SELECT 1 FROM glue.platform_operators po WHERE po.user_id = (SELECT auth.uid())));
GRANT SELECT ON glue.worker_capacity_snapshots TO authenticated;

CREATE OR REPLACE FUNCTION glue.capture_queue_pressure()
 RETURNS TABLE(partition_key text, pending_jobs integer, running_jobs integer, max_concurrency integer, paused boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'glue', 'public'
AS $function$
BEGIN
  INSERT INTO glue.telemetry_aggregates (metric, window_start, value, scope, created_at)
  SELECT 'queue.pending_jobs', now(), count(*)::numeric, COALESCE(j.partition_key, 'default'), now()
  FROM glue.workflow_jobs j
  WHERE j.state = 'queued'
  GROUP BY COALESCE(j.partition_key, 'default');

  INSERT INTO glue.queue_pressure_signals (partition_key, queued, retrying, delayed, in_flight, dead_letter, pressure_score, recommendation)
  SELECT
    COALESCE(j.partition_key, 'default'),
    COUNT(*) FILTER (WHERE j.state = 'queued'),
    COUNT(*) FILTER (WHERE j.state = 'retrying'),
    COUNT(*) FILTER (WHERE j.state = 'delayed'),
    COUNT(*) FILTER (WHERE j.state = 'running'),
    COUNT(*) FILTER (WHERE j.state = 'dead_letter'),
    ROUND(
      (COUNT(*) FILTER (WHERE j.state IN ('queued', 'retrying', 'delayed')))::numeric
      / GREATEST(COALESCE(qp.max_concurrency, 10), 1),
      4
    ),
    CASE WHEN (COUNT(*) FILTER (WHERE j.state IN ('queued', 'retrying', 'delayed')))::numeric
           / GREATEST(COALESCE(qp.max_concurrency, 10), 1) > 2
         THEN 'Backlog exceeds 2x partition concurrency -- consider scaling workers or raising max_concurrency'
         ELSE NULL END
  FROM glue.workflow_jobs j
  LEFT JOIN glue.queue_partitions qp ON qp.partition_key = COALESCE(j.partition_key, 'default')
  WHERE j.state IN ('queued', 'retrying', 'delayed', 'running', 'dead_letter')
  GROUP BY COALESCE(j.partition_key, 'default'), qp.max_concurrency;

  RETURN QUERY
  SELECT
    COALESCE(j.partition_key, 'default') AS partition_key,
    COUNT(*) FILTER (WHERE j.state = 'queued')::integer AS pending_jobs,
    COUNT(*) FILTER (WHERE j.state = 'running')::integer AS running_jobs,
    COALESCE(qp.max_concurrency, 10) AS max_concurrency,
    COALESCE(qp.paused, false) AS paused
  FROM glue.workflow_jobs j
  LEFT JOIN glue.queue_partitions qp ON qp.partition_key = COALESCE(j.partition_key, 'default')
  WHERE j.state IN ('queued', 'running')
  GROUP BY COALESCE(j.partition_key, 'default'), qp.max_concurrency, qp.paused;
END;
$function$;

CREATE OR REPLACE FUNCTION glue.capture_worker_capacity()
 RETURNS TABLE(worker_id text, active_jobs integer, max_concurrency integer, utilization numeric, health_state text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'glue', 'public'
AS $function$
BEGIN
  INSERT INTO glue.telemetry_aggregates (metric, window_start, value, scope, created_at)
  SELECT 'worker.utilization', now(),
         CASE WHEN wr.max_concurrency > 0 THEN wr.active_jobs::numeric / wr.max_concurrency ELSE 0 END,
         wr.worker_id, now()
  FROM glue.worker_registry wr;

  INSERT INTO glue.worker_capacity_snapshots (worker_id, region, active_jobs, max_concurrency, saturation, health_state)
  SELECT
    wr.worker_id,
    wr.region,
    wr.active_jobs,
    wr.max_concurrency,
    CASE WHEN wr.max_concurrency > 0 THEN ROUND(wr.active_jobs::numeric / wr.max_concurrency, 4) ELSE 0 END,
    wr.health_state
  FROM glue.worker_registry wr;

  RETURN QUERY
  SELECT
    wr.worker_id,
    wr.active_jobs,
    wr.max_concurrency,
    CASE WHEN wr.max_concurrency > 0 THEN round(wr.active_jobs::numeric / wr.max_concurrency, 4) ELSE 0 END AS utilization,
    wr.health_state
  FROM glue.worker_registry wr;
END;
$function$;
