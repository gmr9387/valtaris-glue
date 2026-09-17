-- Part 3 of the Generation-3 schema reconciliation (see part1's
-- header). New workflow_* tables genuinely referenced by real,
-- deployed Gen-3 functions: init-workflow, execute-workflow,
-- job-lifecycle, step-lifecycle, worker-finalize, dead-letter,
-- repair-*, finalize-run, run-lifecycle, replay-workflow,
-- workflow-publish, aggregate-*-metrics, collect-metrics,
-- connector-telemetry, plus the real logic this same change writes
-- for run-worker/approval-decision/stuck-run-detector/
-- schedule-next-job/check-invariants (previously byte-identical
-- copies of unrelated functions -- see this PR's function changes).

CREATE TABLE IF NOT EXISTS public.workflow_dags (
  id text PRIMARY KEY,
  name text,
  graph jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Two real, live writer shapes coexist (both Gen-3-family, neither in
-- the excluded legacy-4): the majority convention (run_id/step_id/
-- type/details) and _shared/triggers.ts's canonical enqueue path
-- (tenant_id/severity/source/message/data). runtime-validate's `ts`
-- filter is a third real reader. All are kept.
CREATE TABLE IF NOT EXISTS public.workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  step_id text,
  type text,
  details jsonb,
  data jsonb,
  error text,
  tenant_id uuid,
  severity text,
  source text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ts timestamptz NOT NULL DEFAULT now()
);

-- Merges dead-letter's Schema A (real writer) with webhook-ingress's
-- Schema C (real writer) -- rollback-executor/worker's Schema B is
-- the excluded legacy convention.
CREATE TABLE IF NOT EXISTS public.workflow_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  step_id text,
  type text,
  error text,
  tenant_id uuid,
  severity text NOT NULL DEFAULT 'warn',
  category text,
  summary text,
  connector text,
  recovery_state text NOT NULL DEFAULT 'open',
  acknowledged_by uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- dead-letter (writer) and runtime-validate (reader) use different
-- names for the same concepts (step_id/dag_node_id, error/last_error,
-- created_at/moved_at) -- both real Gen-3 callers, so both column
-- sets are kept rather than picking one and breaking the other.
CREATE TABLE IF NOT EXISTS public.workflow_dead_letter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  step_id text,
  dag_node_id text,
  job_id uuid,
  error text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  moved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  step_id text,
  dag_node_id text,
  tenant_id uuid,
  state text NOT NULL DEFAULT 'pending',
  decision text,
  decided_by uuid,
  decided_at timestamptz,
  escalated_to uuid,
  job_id uuid,
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.workflow_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  step_index integer,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_id uuid,
  workflow_version_id uuid,
  ts timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_compensation_repair (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  repaired_at timestamptz NOT NULL DEFAULT now(),
  stuck_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  invalid_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  failed_steps jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.workflow_connector_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  call_count integer NOT NULL DEFAULT 0,
  avg_latency_ms numeric,
  p95_latency_ms numeric,
  error_rate numeric NOT NULL DEFAULT 0,
  success_rate numeric NOT NULL DEFAULT 0,
  reliability_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_connector_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector text NOT NULL,
  idempotency_key text,
  payload jsonb,
  result jsonb,
  error text,
  duration_ms integer,
  run_id uuid,
  job_id uuid,
  step_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_idempotency (
  key text PRIMARY KEY,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_job_step_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text,
  step_id text,
  run_id uuid,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  call_count integer NOT NULL DEFAULT 0,
  avg_duration_ms numeric,
  p95_latency_ms numeric,
  error_rate numeric NOT NULL DEFAULT 0,
  success_rate numeric NOT NULL DEFAULT 0,
  reliability_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  job_id uuid,
  step_id text,
  connector text,
  event text NOT NULL,
  duration_ms integer,
  error text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id),
  from_version_id uuid,
  to_version_id uuid NOT NULL,
  strategy text NOT NULL DEFAULT 'drain',
  state text NOT NULL DEFAULT 'pending',
  actor_user_id uuid,
  ended_at timestamptz,
  report jsonb,
  started_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_connectors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_run_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  step_count integer NOT NULL DEFAULT 0,
  total_duration_ms integer,
  avg_step_duration_ms numeric,
  p95_latency_ms numeric,
  error_rate numeric NOT NULL DEFAULT 0,
  success_rate numeric NOT NULL DEFAULT 0,
  reliability_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_run_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  terminal_state text NOT NULL,
  step_count integer NOT NULL DEFAULT 0,
  job_count integer NOT NULL DEFAULT 0,
  step_state_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  job_state_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  dag_completeness jsonb NOT NULL DEFAULT '{}'::jsonb,
  terminal_state_valid boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_run_finalization_repair (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  old_state text NOT NULL,
  new_state text NOT NULL,
  repaired_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_run_state_repair (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  old_state text NOT NULL,
  new_state text NOT NULL,
  repaired_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id),
  cron text NOT NULL,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_step_run_repair (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_run_id uuid NOT NULL,
  run_id uuid NOT NULL,
  step_id text NOT NULL,
  reason text NOT NULL,
  repaired_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key text NOT NULL UNIQUE,
  install_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_workers (
  id text PRIMARY KEY,
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now()
);
