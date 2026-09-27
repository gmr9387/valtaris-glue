-- tick-connectors is a fifth enqueueFromTrigger caller missed in the
-- trigger-ingress-onto-Gen-3 migration (20260926100000): it addresses
-- workflows via glue.connector_schedules.dag_id, the same legacy
-- workflow_dags-era pattern webhook_endpoints/workflow_schedules/
-- runtime_triggers had. Same fix: add workflow_version_id alongside the
-- existing dag_id label column.
--
-- Note: connector_schedules also carries a NOT NULL workflow_definition_id
-- FK to glue.workflow_definitions -- the same apparently-unused legacy
-- column already noted on workflow_schedules in 20260926100000. Left
-- untouched here for the same reason.

alter table glue.connector_schedules
  add column workflow_version_id uuid references glue.workflow_versions(id);

comment on column glue.connector_schedules.workflow_version_id is
  'Which workflow_versions graph a successful connector poll launches. Required for enqueueFromTrigger to create real jobs (dag_id is a label only).';
