-- Building real "create webhook endpoint / schedule / event trigger" UI
-- (previously these three resource types had no creation flow at all --
-- only pause/resume/view). Creating a glue.workflow_schedules row hits a
-- real blocker: workflow_definition_id (NOT NULL, FK to
-- glue.workflow_definitions) and cron (NOT NULL text) are both dead
-- legacy columns nothing in the live codebase reads or writes --
-- scheduler-tick's real code uses schedule_kind/interval_seconds/
-- cron_expression, already noted in 20260926100000. Same for
-- glue.connector_schedules.workflow_definition_id. Requiring real
-- operators to populate meaningless legacy columns just to create a
-- schedule would mean fabricating data to satisfy dead constraints --
-- the honest fix is to stop requiring them.

alter table glue.workflow_schedules
  alter column workflow_definition_id drop not null,
  alter column cron drop not null;

alter table glue.connector_schedules
  alter column workflow_definition_id drop not null;
