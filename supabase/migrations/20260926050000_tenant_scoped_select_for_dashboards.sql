-- Fixes the "68 RLS-enabled-no-policy" advisor findings for the subset
-- of glue tables that are genuinely tenant-scoped (carry a real
-- tenant_id column, or in workflow_step_runs' case, belong to a row
-- that does) and that the frontend already queries directly as
-- `authenticated` via PostgREST (useActivation, useApprovals,
-- useScaleOps, useObservability, SecurityEventsFeed,
-- OrchestrationGraph). RLS was enabled with zero policies and zero
-- table grants existed for anon/authenticated at all -- deny-all, so
-- every one of these dashboard panels has always failed with
-- permission-denied for any real signed-in user. This was a functional
-- bug, not intentional hardening: nothing in these stores ever calls
-- .insert/.update/.delete (confirmed by grep), so only SELECT is
-- needed here -- every mutation already goes through service-role
-- Edge Functions (already correctly locked down by an earlier pass).
--
-- NOT covered by this migration, deliberately: worker_registry,
-- queue_partitions, connector_circuit_breakers, and sla_breaches carry
-- no tenant_id at all -- they're genuinely platform-wide infrastructure
-- state, not scoped to any one tenant. Exposing them needs a real
-- "platform operator" authorization concept this schema doesn't have
-- yet (tenant_members' roles are per-tenant, not platform-wide), which
-- is a product decision, not a bug fix -- inventing one here risked
-- either leaking cross-tenant infra data or getting the model wrong.
-- Left RLS-locked (correct default) until that decision is made; the
-- Control Plane page and the circuit-breaker/SLA-breach sections of
-- Scale Ops/Observability stay broken until then, which is unchanged
-- behavior, not a regression.
--
-- Already applied and verified live.
CREATE POLICY "tenant-members-select-load-benchmarks" ON glue.load_benchmarks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.tenant_members tm
    WHERE tm.tenant_id = load_benchmarks.tenant_id AND tm.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "tenant-members-select-security-events" ON glue.security_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.tenant_members tm
    WHERE tm.tenant_id = security_events.tenant_id AND tm.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "tenant-members-select-trace-spans" ON glue.trace_spans
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.tenant_members tm
    WHERE tm.tenant_id = trace_spans.tenant_id AND tm.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "tenant-members-select-trigger-activations" ON glue.trigger_activations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.tenant_members tm
    WHERE tm.tenant_id = trigger_activations.tenant_id AND tm.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "tenant-members-select-webhook-deliveries" ON glue.webhook_deliveries
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.tenant_members tm
    WHERE tm.tenant_id = webhook_deliveries.tenant_id AND tm.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "tenant-members-select-workflow-approvals" ON glue.workflow_approvals
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.tenant_members tm
    WHERE tm.tenant_id = workflow_approvals.tenant_id AND tm.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "tenant-members-select-workflow-jobs" ON glue.workflow_jobs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.tenant_members tm
    WHERE tm.tenant_id = workflow_jobs.tenant_id AND tm.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "tenant-members-select-workflow-schedules" ON glue.workflow_schedules
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.tenant_members tm
    WHERE tm.tenant_id = workflow_schedules.tenant_id AND tm.user_id = (SELECT auth.uid())
  ));

-- workflow_step_runs has no tenant_id of its own, but every row belongs
-- to a workflow_runs row that does (run_id -> workflow_runs.id) --
-- scope through that join instead of a broader bar.
CREATE POLICY "tenant-members-select-workflow-step-runs" ON glue.workflow_step_runs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.workflow_runs wr
    JOIN glue.tenant_members tm ON tm.tenant_id = wr.tenant_id
    WHERE wr.id = workflow_step_runs.run_id AND tm.user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON glue.load_benchmarks, glue.security_events, glue.trace_spans,
  glue.trigger_activations, glue.webhook_deliveries, glue.workflow_approvals,
  glue.workflow_jobs, glue.workflow_schedules, glue.workflow_step_runs
  TO authenticated;

-- webhook_endpoints: same tenant-scoped policy, but a column-level
-- grant that excludes signing_secret -- a raw HMAC signing secret that
-- a tenant member should never read back over a general dashboard
-- query (write/rotate, don't re-display -- same ethic as api_clients
-- elsewhere in this ecosystem per ADR-004). PostgREST expands
-- `select=*` using the calling role's actual column privileges, so
-- this is the standard supported way to hide one sensitive column
-- while leaving the rest of the table readable. Verified live: the
-- resulting grant lists exactly the 10 non-secret columns.
CREATE POLICY "tenant-members-select-webhook-endpoints" ON glue.webhook_endpoints
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.tenant_members tm
    WHERE tm.tenant_id = webhook_endpoints.tenant_id AND tm.user_id = (SELECT auth.uid())
  ));

GRANT SELECT (id, tenant_id, endpoint_key, active, paused, signature_header, dag_id, source, created_at, updated_at)
  ON glue.webhook_endpoints TO authenticated;
