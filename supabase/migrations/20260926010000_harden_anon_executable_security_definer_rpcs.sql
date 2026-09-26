-- Lock down SECURITY DEFINER functions found anon/authenticated-executable
-- with no matching authorization check (or a bypassable one), found via a
-- live audit of the shared Supabase project (qrqekucwdfyqqzomuble) this
-- schema currently lives in.
--
-- Severity map (verified by reading each function body, not just its
-- grants):
--
-- Critical (zero auth check, direct data corruption or evidence
-- destruction):
--   mark_job_completed / mark_job_failed -- fake-complete or fake-fail any
--     job with an arbitrary attacker-supplied payload
--   pause_partition -- halts/resumes any queue partition, no check at all
--   archive_old_events -- a real DELETE; _older_than_minutes=0 wipes the
--     event log on demand, no check
--   claim_next_job(uuid) -- dequeues real pending jobs (payload included)
--     and assigns them to an attacker-chosen worker_id
--
-- High (an authorization check exists but is bypassable via a
-- caller-supplied identity argument instead of the session's real
-- identity, or a real DoS via an attacker-controlled parameter):
--   pause_webhook / set_schedule_state -- both call has_operator_role, but
--     trust a caller-supplied _operator_uid argument; pass any real
--     operator's UUID and the check passes. This grant fix closes the
--     immediate exploit (only service_role can call these directly now),
--     but the function bodies still trust that argument -- if either is
--     ever re-exposed to `authenticated`, derive the identity from
--     auth.uid() instead of the parameter before doing so.
--   drain_worker / worker_shutdown -- no check at all; drain_worker also
--     writes the caller-supplied _operator_uid into the audit log as if
--     verified
--   seed_initial_jobs_atomic -- injects arbitrary pending jobs into any
--     run_id, no tenant/ownership check
--   reconcile_orphans / sweep_stale_jobs -- both take an attacker-
--     controlled staleness threshold (e.g. seconds=0) that lets anyone
--     immediately rip every in-flight job away from healthy workers, or
--     force jobs to exhaust retries into permanent failure
--
-- Medium (resource abuse / infra topology disclosure, not data
-- corruption):
--   increment_attempt -- arbitrary attempt-counter tampering on any job
--   aggregate_telemetry, capture_queue_pressure, capture_worker_capacity,
--   detect_sla_breaches, evaluate_circuit_breakers -- callable on demand
--     for spam/noise; capture_* also leak real worker IDs and queue
--     depths to any caller
--   runtime_health_report -- pure info disclosure of system health to any
--     anonymous caller
--
-- Hardened as defense-in-depth (individually low risk -- idempotent
-- sweeps that only act on state that's already genuinely expired -- but
-- not meant to be called by end users either):
--   expire_pending_approvals, expire_stale_leases, finalize_run_if_terminal,
--   has_operator_role
--
-- Verified live before and after: reproduced the mark_job_completed
-- exploit as anon (succeeded before this fix), confirmed it now fails
-- with 42501 permission denied, and confirmed service_role calls are
-- unaffected (runtime_health_report still returns real data as
-- service_role).
--
-- Left untouched, confirmed already safe: claim_next_job() (the no-arg
-- overload -- not SECURITY DEFINER, and anon/authenticated have zero
-- table-level grants on workflow_jobs, so it already fails for them),
-- create_workflow_run_atomic, ensure_downstream_job (same reason), and
-- handle_new_user (a trigger function -- errors if called outside
-- trigger context).

revoke all on function glue.mark_job_completed(uuid, jsonb) from public, anon, authenticated;
revoke all on function glue.mark_job_failed(uuid, jsonb) from public, anon, authenticated;
revoke all on function glue.pause_partition(text, boolean, uuid) from public, anon, authenticated;
revoke all on function glue.archive_old_events(integer) from public, anon, authenticated;
revoke all on function glue.claim_next_job(uuid) from public, anon, authenticated;
revoke all on function glue.pause_webhook(uuid, boolean, uuid) from public, anon, authenticated;
revoke all on function glue.set_schedule_state(uuid, text, uuid) from public, anon, authenticated;
revoke all on function glue.drain_worker(text, uuid) from public, anon, authenticated;
revoke all on function glue.worker_shutdown(uuid) from public, anon, authenticated;
revoke all on function glue.seed_initial_jobs_atomic(uuid, text[]) from public, anon, authenticated;
revoke all on function glue.reconcile_orphans(integer) from public, anon, authenticated;
revoke all on function glue.sweep_stale_jobs(integer) from public, anon, authenticated;
revoke all on function glue.increment_attempt(uuid) from public, anon, authenticated;
revoke all on function glue.aggregate_telemetry() from public, anon, authenticated;
revoke all on function glue.capture_queue_pressure() from public, anon, authenticated;
revoke all on function glue.capture_worker_capacity() from public, anon, authenticated;
revoke all on function glue.detect_sla_breaches() from public, anon, authenticated;
revoke all on function glue.evaluate_circuit_breakers() from public, anon, authenticated;
revoke all on function glue.runtime_health_report() from public, anon, authenticated;
revoke all on function glue.expire_pending_approvals() from public, anon, authenticated;
revoke all on function glue.expire_stale_leases() from public, anon, authenticated;
revoke all on function glue.finalize_run_if_terminal(uuid) from public, anon, authenticated;
revoke all on function glue.has_operator_role(uuid, uuid, text) from public, anon, authenticated;

grant execute on function glue.mark_job_completed(uuid, jsonb) to service_role;
grant execute on function glue.mark_job_failed(uuid, jsonb) to service_role;
grant execute on function glue.pause_partition(text, boolean, uuid) to service_role;
grant execute on function glue.archive_old_events(integer) to service_role;
grant execute on function glue.claim_next_job(uuid) to service_role;
grant execute on function glue.pause_webhook(uuid, boolean, uuid) to service_role;
grant execute on function glue.set_schedule_state(uuid, text, uuid) to service_role;
grant execute on function glue.drain_worker(text, uuid) to service_role;
grant execute on function glue.worker_shutdown(uuid) to service_role;
grant execute on function glue.seed_initial_jobs_atomic(uuid, text[]) to service_role;
grant execute on function glue.reconcile_orphans(integer) to service_role;
grant execute on function glue.sweep_stale_jobs(integer) to service_role;
grant execute on function glue.increment_attempt(uuid) to service_role;
grant execute on function glue.aggregate_telemetry() to service_role;
grant execute on function glue.capture_queue_pressure() to service_role;
grant execute on function glue.capture_worker_capacity() to service_role;
grant execute on function glue.detect_sla_breaches() to service_role;
grant execute on function glue.evaluate_circuit_breakers() to service_role;
grant execute on function glue.runtime_health_report() to service_role;
grant execute on function glue.expire_pending_approvals() to service_role;
grant execute on function glue.expire_stale_leases() to service_role;
grant execute on function glue.finalize_run_if_terminal(uuid) to service_role;
grant execute on function glue.has_operator_role(uuid, uuid, text) to service_role;
