-- Reconcile Gen-3 schedule tables + build the platform RPCs real deployed
-- code already calls but that never existed in the live database.
--
-- Two problems found while investigating "what's left in the ecosystem":
--
-- 1. workflow_schedules/connector_schedules were created earlier this
--    session by transcribing scheduler-tick/tick-connectors' OWN (legacy,
--    broken) column expectations -- but the real, authoritative shape is
--    what src/store/useActivation.ts's WorkflowSchedule interface reads
--    (a live admin UI: name, dag_id, schedule_kind, interval_seconds,
--    cron_expression, state, next_run_at, consecutive_failures, tenant_id),
--    confirmed by reading that store directly. That UI's own
--    `.order("next_run_at", ...)` and `setScheduleState()` calls were
--    failing against the schema this project actually had. This migration
--    adds the real columns additively; the old workflow_definition_id/cron
--    columns are left in place, unused, rather than dropped.
--
-- 2. control-plane, sla-sweeper, worker-health, and scale-monitor (all
--    deployed verbatim from real code, not written this session) call 16
--    RPCs that were never created anywhere -- confirmed by listing every
--    function in the public schema and finding none of them. Every one of
--    these RPCs is built below against the live schema, matching exactly
--    what each real caller's request/response shape expects (checked
--    caller-by-caller, not guessed).

-- ---------------------------------------------------------------------
-- 1. Schedule table reconciliation
-- ---------------------------------------------------------------------

ALTER TABLE public.workflow_schedules
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS dag_id text,
  ADD COLUMN IF NOT EXISTS schedule_kind text NOT NULL DEFAULT 'interval',
  ADD COLUMN IF NOT EXISTS interval_seconds integer,
  ADD COLUMN IF NOT EXISTS cron_expression text,
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

ALTER TABLE public.connector_schedules
  ADD COLUMN IF NOT EXISTS dag_id text,
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS next_tick_at timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- ---------------------------------------------------------------------
-- 2. Authorization primitive (used by control-plane and manual-launch,
--    both already deployed and calling this today)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_operator_role(_uid uuid, _tenant_id uuid, _required text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_rank integer;
  v_required_rank integer;
BEGIN
  SELECT role INTO v_role FROM public.tenant_members WHERE user_id = _uid AND tenant_id = _tenant_id;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  v_rank := CASE v_role WHEN 'admin' THEN 3 WHEN 'operator' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;
  v_required_rank := CASE _required WHEN 'admin' THEN 3 WHEN 'operator' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;

  RETURN v_rank >= v_required_rank;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. sla-sweeper's three RPCs
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sweep_stale_jobs(_lease_seconds integer DEFAULT 120)
RETURNS TABLE(recovered integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retry_ids uuid[];
  v_dead_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_retry_ids
  FROM public.workflow_jobs
  WHERE state = 'running'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < now() - (_lease_seconds || ' seconds')::interval
    AND retry_count < max_retries;

  IF v_retry_ids IS NOT NULL THEN
    UPDATE public.workflow_jobs
    SET state = 'pending', retry_count = retry_count + 1,
        claimed_by = NULL, worker_id = NULL, claimed_at = NULL,
        lease_expires_at = NULL, updated_at = now()
    WHERE id = ANY(v_retry_ids);
  END IF;

  SELECT array_agg(id) INTO v_dead_ids
  FROM public.workflow_jobs
  WHERE state = 'running'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < now() - (_lease_seconds || ' seconds')::interval
    AND retry_count >= max_retries;

  IF v_dead_ids IS NOT NULL THEN
    INSERT INTO public.workflow_incidents (run_id, step_id, type, severity, error, created_at)
    SELECT run_id, step_id, 'expired-lease-exhausted', 'error', 'lease expired after max retries', now()
    FROM public.workflow_jobs WHERE id = ANY(v_dead_ids);

    UPDATE public.workflow_jobs
    SET state = 'failed', error = 'lease expired after max retries', updated_at = now()
    WHERE id = ANY(v_dead_ids);
  END IF;

  RETURN QUERY SELECT COALESCE(array_length(v_retry_ids, 1), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.detect_sla_breaches()
RETURNS TABLE(breached integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH candidates AS (
    SELECT r.id AS run_id,
           COALESCE((v.metadata->>'sla_seconds')::integer, 1800) AS budget_s,
           EXTRACT(EPOCH FROM (now() - COALESCE(r.started_at, r.created_at)))::integer AS observed_s
    FROM public.workflow_runs r
    JOIN public.workflow_versions v ON v.id = r.workflow_version_id
    WHERE r.state = 'running'
  ),
  overdue AS (
    SELECT * FROM candidates WHERE observed_s > budget_s
  ),
  new_breaches AS (
    INSERT INTO public.sla_breaches (run_id, target, scope, severity, observed_ms, budget_ms, detected_at)
    SELECT o.run_id, 'run.duration', 'run', 'warn', o.observed_s * 1000, o.budget_s * 1000, now()
    FROM overdue o
    WHERE NOT EXISTS (
      SELECT 1 FROM public.sla_breaches b
      WHERE b.run_id = o.run_id AND b.target = 'run.duration' AND b.resolved_at IS NULL
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM new_breaches;

  RETURN QUERY SELECT v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_pending_approvals()
RETURNS TABLE(expired integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids
  FROM public.workflow_approvals
  WHERE state = 'pending' AND expires_at IS NOT NULL AND expires_at < now();

  IF v_ids IS NOT NULL THEN
    UPDATE public.workflow_approvals SET state = 'expired' WHERE id = ANY(v_ids);
  END IF;

  RETURN QUERY SELECT COALESCE(array_length(v_ids, 1), 0);
END;
$$;

-- ---------------------------------------------------------------------
-- 4. worker-health's RPCs
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.worker_shutdown(_worker_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_released integer := 0;
BEGIN
  UPDATE public.workflow_jobs
  SET state = 'pending', claimed_by = NULL, worker_id = NULL,
      claimed_at = NULL, lease_expires_at = NULL, updated_at = now()
  WHERE worker_id = _worker_id AND state = 'running';
  GET DIAGNOSTICS v_released = ROW_COUNT;

  UPDATE public.worker_registry
  SET health_state = 'shutdown', active_jobs = 0, last_heartbeat = now()
  WHERE worker_id = _worker_id::text;

  RETURN v_released;
END;
$$;

CREATE OR REPLACE FUNCTION public.runtime_health_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'active_workers', (SELECT count(*) FROM public.worker_registry WHERE health_state = 'active' AND last_heartbeat > now() - interval '5 minutes'),
    'total_workers', (SELECT count(*) FROM public.worker_registry),
    'jobs_pending', (SELECT count(*) FROM public.workflow_jobs WHERE state = 'pending'),
    'jobs_running', (SELECT count(*) FROM public.workflow_jobs WHERE state = 'running'),
    'jobs_failed_1h', (SELECT count(*) FROM public.workflow_jobs WHERE state = 'failed' AND updated_at > now() - interval '1 hour'),
    'jobs_completed_1h', (SELECT count(*) FROM public.workflow_jobs WHERE state = 'completed' AND completed_at > now() - interval '1 hour'),
    'runs_running', (SELECT count(*) FROM public.workflow_runs WHERE state = 'running'),
    'open_incidents', (SELECT count(*) FROM public.workflow_incidents WHERE closed_at IS NULL),
    'generated_at', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. scale-monitor's RPCs
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.capture_queue_pressure()
RETURNS TABLE(partition_key text, pending_jobs integer, running_jobs integer, max_concurrency integer, paused boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.telemetry_aggregates (metric, window_start, value, scope, created_at)
  SELECT 'queue.pending_jobs', now(), count(*)::numeric, COALESCE(j.partition_key, 'default'), now()
  FROM public.workflow_jobs j
  WHERE j.state = 'pending'
  GROUP BY COALESCE(j.partition_key, 'default');

  RETURN QUERY
  SELECT
    COALESCE(j.partition_key, 'default') AS partition_key,
    COUNT(*) FILTER (WHERE j.state = 'pending')::integer AS pending_jobs,
    COUNT(*) FILTER (WHERE j.state = 'running')::integer AS running_jobs,
    COALESCE(qp.max_concurrency, 10) AS max_concurrency,
    COALESCE(qp.paused, false) AS paused
  FROM public.workflow_jobs j
  LEFT JOIN public.queue_partitions qp ON qp.partition_key = COALESCE(j.partition_key, 'default')
  WHERE j.state IN ('pending', 'running')
  GROUP BY COALESCE(j.partition_key, 'default'), qp.max_concurrency, qp.paused;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_worker_capacity()
RETURNS TABLE(worker_id text, active_jobs integer, max_concurrency integer, utilization numeric, health_state text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.telemetry_aggregates (metric, window_start, value, scope, created_at)
  SELECT 'worker.utilization', now(),
         CASE WHEN wr.max_concurrency > 0 THEN wr.active_jobs::numeric / wr.max_concurrency ELSE 0 END,
         wr.worker_id, now()
  FROM public.worker_registry wr;

  RETURN QUERY
  SELECT
    wr.worker_id,
    wr.active_jobs,
    wr.max_concurrency,
    CASE WHEN wr.max_concurrency > 0 THEN round(wr.active_jobs::numeric / wr.max_concurrency, 4) ELSE 0 END AS utilization,
    wr.health_state
  FROM public.worker_registry wr;
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_circuit_breakers()
RETURNS TABLE(connector text, previous_state text, new_state text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_connector text;
  v_current_state text;
  v_new_state text;
  v_total integer;
  v_errors integer;
  v_last_error boolean;
  v_updated_at timestamptz;
BEGIN
  FOR v_connector IN
    SELECT DISTINCT wcl.connector FROM public.workflow_connector_logs wcl
    WHERE wcl.created_at > now() - interval '5 minutes'
  LOOP
    SELECT cb.state, cb.updated_at INTO v_current_state, v_updated_at
    FROM public.connector_circuit_breakers cb WHERE cb.connector = v_connector;

    IF v_current_state IS NULL THEN
      INSERT INTO public.connector_circuit_breakers (connector, state, updated_at)
      VALUES (v_connector, 'closed', now())
      ON CONFLICT (connector) DO NOTHING;
      v_current_state := 'closed';
      v_updated_at := now();
    END IF;

    SELECT count(*), count(*) FILTER (WHERE error IS NOT NULL)
    INTO v_total, v_errors
    FROM public.workflow_connector_logs
    WHERE connector = v_connector AND created_at > now() - interval '5 minutes';

    v_new_state := v_current_state;

    IF v_current_state = 'closed' THEN
      IF v_total >= 5 AND v_errors::numeric / v_total > 0.5 THEN
        v_new_state := 'open';
      END IF;
    ELSIF v_current_state = 'open' THEN
      IF v_updated_at < now() - interval '1 minute' THEN
        v_new_state := 'half_open';
      END IF;
    ELSIF v_current_state = 'half_open' THEN
      SELECT (error IS NOT NULL) INTO v_last_error
      FROM public.workflow_connector_logs
      WHERE connector = v_connector
      ORDER BY created_at DESC LIMIT 1;

      IF v_last_error IS FALSE THEN
        v_new_state := 'closed';
      ELSIF v_last_error IS TRUE THEN
        v_new_state := 'open';
      END IF;
    END IF;

    IF v_new_state IS DISTINCT FROM v_current_state THEN
      UPDATE public.connector_circuit_breakers
      SET state = v_new_state, updated_at = now()
      WHERE connector = v_connector;

      connector := v_connector;
      previous_state := v_current_state;
      new_state := v_new_state;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. control-plane's remaining RPCs
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pause_webhook(_endpoint_id uuid, _paused boolean, _operator_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_allowed boolean;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.webhook_endpoints WHERE id = _endpoint_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'webhook endpoint not found';
  END IF;

  SELECT public.has_operator_role(_operator_uid, v_tenant_id, 'operator') INTO v_allowed;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'operator role required';
  END IF;

  UPDATE public.webhook_endpoints SET paused = _paused, updated_at = now() WHERE id = _endpoint_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_schedule_state(_schedule_id uuid, _state text, _operator_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_allowed boolean;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.workflow_schedules WHERE id = _schedule_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'schedule not found';
  END IF;

  SELECT public.has_operator_role(_operator_uid, v_tenant_id, 'operator') INTO v_allowed;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'operator role required';
  END IF;

  UPDATE public.workflow_schedules SET state = _state WHERE id = _schedule_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_partition(_partition_key text, _paused boolean, _operator_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.queue_partitions (partition_key, paused, updated_at)
  VALUES (_partition_key, _paused, now())
  ON CONFLICT (partition_key) DO UPDATE SET paused = _paused, updated_at = now();

  INSERT INTO public.runtime_audit_log (actor, action, subject_type, subject_id, details)
  VALUES (_operator_uid::text, CASE WHEN _paused THEN 'partition.pause' ELSE 'partition.resume' END,
          'queue_partition', _partition_key, jsonb_build_object('operator_uid', _operator_uid));
END;
$$;

CREATE OR REPLACE FUNCTION public.drain_worker(_worker_id text, _operator_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.workflow_jobs
  SET state = 'pending', claimed_by = NULL, worker_id = NULL,
      claimed_at = NULL, lease_expires_at = NULL, updated_at = now()
  WHERE worker_id::text = _worker_id AND state = 'running';

  UPDATE public.worker_registry
  SET health_state = 'draining', last_heartbeat = now()
  WHERE worker_id = _worker_id;

  INSERT INTO public.runtime_audit_log (actor, action, subject_type, subject_id, details)
  VALUES (_operator_uid::text, 'worker.drain', 'worker', _worker_id, jsonb_build_object('operator_uid', _operator_uid));
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_orphans(_worker_stale_seconds integer DEFAULT 180)
RETURNS TABLE(orphaned_jobs integer, orphaned_runs integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_ids uuid[];
  v_orphaned_jobs integer := 0;
  v_orphaned_runs integer := 0;
BEGIN
  SELECT array_agg(j.id) INTO v_job_ids
  FROM public.workflow_jobs j
  LEFT JOIN public.worker_registry wr ON wr.worker_id = j.worker_id::text
  WHERE j.state = 'running'
    AND (wr.worker_id IS NULL OR wr.last_heartbeat < now() - (_worker_stale_seconds || ' seconds')::interval);

  IF v_job_ids IS NOT NULL THEN
    UPDATE public.workflow_jobs
    SET state = 'pending', claimed_by = NULL, worker_id = NULL,
        claimed_at = NULL, lease_expires_at = NULL, updated_at = now()
    WHERE id = ANY(v_job_ids);
    v_orphaned_jobs := array_length(v_job_ids, 1);
  END IF;

  SELECT count(*) INTO v_orphaned_runs
  FROM public.workflow_runs r
  WHERE r.state = 'running'
    AND NOT EXISTS (
      SELECT 1 FROM public.workflow_jobs j
      WHERE j.run_id = r.id AND j.state IN ('pending', 'running')
    )
    AND r.updated_at < now() - (_worker_stale_seconds || ' seconds')::interval;

  RETURN QUERY SELECT v_orphaned_jobs, v_orphaned_runs;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_old_events(_older_than_minutes integer DEFAULT 1440)
RETURNS TABLE(archived integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.workflow_events
    WHERE COALESCE(ts, created_at) < now() - (_older_than_minutes || ' minutes')::interval
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM deleted;

  RETURN QUERY SELECT v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.aggregate_telemetry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.capture_queue_pressure();
  PERFORM public.capture_worker_capacity();

  INSERT INTO public.telemetry_aggregates (metric, window_start, value, scope, created_at)
  SELECT 'jobs.completed_count', now(), count(*), 'global', now()
  FROM public.workflow_jobs WHERE state = 'completed' AND completed_at > now() - interval '1 hour';

  INSERT INTO public.telemetry_aggregates (metric, window_start, value, scope, created_at)
  SELECT 'jobs.failed_count', now(), count(*), 'global', now()
  FROM public.workflow_jobs WHERE state = 'failed' AND updated_at > now() - interval '1 hour';
END;
$$;
