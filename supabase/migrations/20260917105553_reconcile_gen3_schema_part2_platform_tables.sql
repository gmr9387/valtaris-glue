-- Part 2 of the Generation-3 schema reconciliation (see part1's header
-- for full context). New tables genuinely referenced by real,
-- deployed platform/ops functions (platform-control, control-plane,
-- webhook-ingress, event-trigger-router, load-harness, manual-launch,
-- otel-export, connector-telemetry, tick-connectors' non-legacy
-- reads, worker-health, sla-sweeper).
--
-- tenants is not itself in the reverse-engineered table list, but
-- tenant_members.tenant_id (the one table in that list that is
-- explicitly relational) needs a real parent -- every other table's
-- tenant_id is left as a plain uuid without an FK, since no real
-- caller was found that depends on that constraint existing, and
-- inventing FKs beyond what's evidenced risks migration failures from
-- ordering/orphan-row issues rather than fixing anything real.

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_members (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'operator',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.connector_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text,
  publisher text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.connector_circuit_breakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'closed',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.connector_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  connector_id uuid NOT NULL REFERENCES public.connector_catalog(id),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_by uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  installed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.connector_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_key text NOT NULL,
  workflow_definition_id uuid NOT NULL,
  last_tick_at timestamptz,
  interval_seconds integer NOT NULL DEFAULT 60
);

CREATE TABLE IF NOT EXISTS public.deployment_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  profile_id uuid,
  ran_by uuid NOT NULL,
  state text NOT NULL DEFAULT 'running',
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  passed integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  warnings integer NOT NULL DEFAULT 0,
  ran_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.load_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scenario text NOT NULL,
  tenant_id uuid,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'running',
  total_runs integer NOT NULL DEFAULT 0,
  completed_runs integer,
  failed_runs integer,
  ended_at timestamptz,
  duration_ms integer,
  throughput_per_sec numeric,
  report jsonb,
  started_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manual_launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  operator_user_id uuid NOT NULL,
  dag_id text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  tenant_id uuid NOT NULL,
  step_key text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  completed_by uuid,
  PRIMARY KEY (tenant_id, step_key)
);

CREATE TABLE IF NOT EXISTS public.pack_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'upload',
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'pending',
  validation_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_by uuid NOT NULL,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.queue_partitions (
  partition_key text PRIMARY KEY,
  max_concurrency integer NOT NULL DEFAULT 10,
  description text,
  paused boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.runtime_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor text NOT NULL,
  action text NOT NULL,
  subject_type text,
  subject_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.runtime_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  source_event_type text NOT NULL,
  last_fired_at timestamptz,
  cooldown_seconds integer NOT NULL DEFAULT 0,
  max_depth integer NOT NULL DEFAULT 5,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  dag_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saved_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_user_id uuid,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  subject_type text,
  subject_id text,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sla_breaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  target text,
  scope text,
  severity text NOT NULL DEFAULT 'warn',
  observed_ms integer,
  budget_ms integer,
  resolved_at timestamptz,
  detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telemetry_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL,
  window_start timestamptz NOT NULL,
  value numeric NOT NULL,
  scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  graph jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_connectors jsonb NOT NULL DEFAULT '[]'::jsonb,
  state text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.template_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  template_id uuid NOT NULL,
  template_version_id uuid NOT NULL REFERENCES public.template_versions(id),
  installed_by uuid NOT NULL,
  state text NOT NULL DEFAULT 'installed',
  installed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trace_spans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id text NOT NULL,
  span_id text NOT NULL,
  parent_span_id text,
  name text NOT NULL,
  kind text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id uuid,
  step_id text,
  correlation_id uuid,
  tenant_id uuid,
  duration_ms integer
);

CREATE TABLE IF NOT EXISTS public.trigger_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  trigger_id uuid REFERENCES public.runtime_triggers(id),
  trigger_kind text NOT NULL,
  source_label text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  depth integer NOT NULL DEFAULT 0,
  suppressed boolean NOT NULL DEFAULT false,
  suppressed_reason text,
  run_id uuid,
  fired_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  endpoint_key text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  paused boolean NOT NULL DEFAULT false,
  signing_secret text,
  signature_header text DEFAULT 'x-signature',
  dag_id text NOT NULL,
  source text NOT NULL DEFAULT 'webhook',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id),
  source_ip text,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_body text,
  idempotency_key text,
  signature_valid boolean,
  signature_error text,
  status text NOT NULL DEFAULT 'pending',
  correlation_id uuid,
  run_id uuid,
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (endpoint_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.worker_registry (
  worker_id text PRIMARY KEY,
  region text,
  health_state text NOT NULL DEFAULT 'active',
  active_jobs integer NOT NULL DEFAULT 0,
  max_concurrency integer NOT NULL DEFAULT 10,
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  total_processed integer NOT NULL DEFAULT 0,
  total_failed integer NOT NULL DEFAULT 0
);
