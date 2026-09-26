-- Trigger ingress (enqueueFromTrigger, used by webhook-ingress,
-- scheduler-tick, event-trigger-router, manual-launch) currently
-- addresses workflows via dag_id -> glue.workflow_dags (dependsOn edges,
-- workflow_jobs.dag_node_id). The Gen-3 execution engine (execute-
-- workflow, schedule-next-job, run-worker, trigger-job) addresses
-- workflows via workflow_version_id -> glue.workflow_versions (next/
-- on_failure/on_approval/on_compensation edges, workflow_jobs.step_id).
-- These are two structurally separate systems -- workflow_versions has
-- no dag_id column at all, no FK links them. workflow_dags,
-- workflow_versions, and every trigger config table are all at 0 rows in
-- prod today, so this is a design gap, not a live outage: nothing has
-- ever exercised either path.
--
-- This adds workflow_version_id to each trigger config table so
-- enqueueFromTrigger can be rewritten (separately, in this same change)
-- to create jobs the same way every other Gen-3 caller does --
-- resolving a real workflow_versions graph and creating root jobs via
-- ensure_downstream_job -- instead of the disconnected workflow_dags
-- path. dag_id is left in place on each table as a label/audit field
-- only; it is no longer used to resolve a graph.
--
-- Note: workflow_schedules also carries a NOT NULL workflow_definition_id
-- FK to glue.workflow_definitions -- a separate, apparently-unused
-- legacy column from an earlier design (scheduler-tick's real code never
-- reads or writes it). Left untouched here; it's a pre-existing oddity
-- outside this change's scope, not something this migration introduces.

alter table glue.webhook_endpoints
  add column workflow_version_id uuid references glue.workflow_versions(id);

alter table glue.workflow_schedules
  add column workflow_version_id uuid references glue.workflow_versions(id);

alter table glue.runtime_triggers
  add column workflow_version_id uuid references glue.workflow_versions(id);

comment on column glue.webhook_endpoints.workflow_version_id is
  'Which workflow_versions graph this endpoint launches. Required for enqueueFromTrigger to create real jobs (dag_id is a label only).';
comment on column glue.workflow_schedules.workflow_version_id is
  'Which workflow_versions graph this schedule launches. Required for enqueueFromTrigger to create real jobs (dag_id is a label only).';
comment on column glue.runtime_triggers.workflow_version_id is
  'Which workflow_versions graph this event trigger launches. Required for enqueueFromTrigger to create real jobs (dag_id is a label only).';
