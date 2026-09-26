-- Fixes for two Supabase performance-advisor finding classes in the `glue`
-- schema, already applied live against the shared project and verified:
--
-- 1. auth_rls_initplan (9 policies across api_requests, profiles,
--    saved_workflows): each policy called `auth.uid()` directly in its
--    USING/WITH CHECK clause, which Postgres re-evaluates per row. Wrapping
--    it in a scalar subselect `(select auth.uid())` lets the planner treat
--    it as a stable InitPlan evaluated once per query instead.
--    Verified live: 0 rows remain matching the unwrapped-call pattern.
--
-- 2. unindexed foreign keys (16 columns across 12 tables): every FK column
--    in `glue` lacking a covering index, which forces a sequential scan on
--    the referencing table for every parent-row update/delete. All 12
--    tables were confirmed empty at apply time, so backfill cost was zero.
--    Verified live: all 16 indexes present in pg_indexes.

-- auth_rls_initplan fixes
ALTER POLICY "Users can delete own api_requests" ON glue.api_requests
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert own api_requests" ON glue.api_requests
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own api_requests" ON glue.api_requests
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert their own profile" ON glue.profiles
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update their own profile" ON glue.profiles
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete own saved_workflows" ON glue.saved_workflows
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert own saved_workflows" ON glue.saved_workflows
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update own saved_workflows" ON glue.saved_workflows
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own saved_workflows" ON glue.saved_workflows
  USING ((select auth.uid()) = user_id);

-- unindexed-foreign-key fixes
CREATE INDEX IF NOT EXISTS idx_saved_workflows_user_id
  ON glue.saved_workflows (user_id);

CREATE INDEX IF NOT EXISTS idx_connector_installations_connector_id
  ON glue.connector_installations (connector_id);

CREATE INDEX IF NOT EXISTS idx_template_installs_template_version_id
  ON glue.template_installs (template_version_id);

CREATE INDEX IF NOT EXISTS idx_trigger_activations_trigger_id
  ON glue.trigger_activations (trigger_id);

CREATE INDEX IF NOT EXISTS idx_workflow_migrations_definition_id
  ON glue.workflow_migrations (definition_id);

CREATE INDEX IF NOT EXISTS idx_workflow_schedules_workflow_definition_id
  ON glue.workflow_schedules (workflow_definition_id);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_replay_of
  ON glue.workflow_runs (replay_of);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_version_id
  ON glue.workflow_runs (workflow_version_id);

CREATE INDEX IF NOT EXISTS idx_workflow_replay_provenance_replay_run_id
  ON glue.workflow_replay_provenance (replay_run_id);

CREATE INDEX IF NOT EXISTS idx_workflow_replay_provenance_source_run_id
  ON glue.workflow_replay_provenance (source_run_id);

CREATE INDEX IF NOT EXISTS idx_workflow_replay_provenance_workflow_version_id
  ON glue.workflow_replay_provenance (workflow_version_id);

CREATE INDEX IF NOT EXISTS idx_workflow_run_repair_run_id
  ON glue.workflow_run_repair (run_id);

CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_job_id
  ON glue.workflow_step_runs (job_id);

CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_run_id
  ON glue.workflow_step_runs (run_id);

CREATE INDEX IF NOT EXISTS idx_workflow_job_repair_job_id
  ON glue.workflow_job_repair (job_id);

CREATE INDEX IF NOT EXISTS idx_workflow_job_repair_run_id
  ON glue.workflow_job_repair (run_id);
