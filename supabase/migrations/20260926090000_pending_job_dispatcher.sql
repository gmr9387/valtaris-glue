-- Nothing anywhere ever calls trigger-job automatically. init-workflow ->
-- execute-workflow creates root jobs in state='pending' via
-- ensure_downstream_job and stops; schedule-next-job does the same for
-- downstream jobs. No cron job (confirmed: cron.job has only 3 unrelated
-- entries), no Edge Function, and no frontend code ever invokes
-- trigger-job to move a job from pending -> running. worker-integrate's
-- claim action is the only other way a job could start, but that
-- requires an external worker process polling it, which does not exist
-- in this repo or dualpay. Net effect: a pending job sits forever unless
-- something calls trigger-job for it.
--
-- This adds a real, periodic dispatcher: glue.dispatch_pending_jobs()
-- finds pending jobs (oldest first, batched) and POSTs each to
-- trigger-job via pg_net, scheduled every minute via pg_cron -- the same
-- mechanism already used for the two existing reaper cron jobs in this
-- project, just extended to HTTP so it can reach an Edge Function.
--
-- Requires a one-time manual step this migration cannot perform: a
-- service-role bearer token must be stored in Vault under the name
-- 'glue_dispatch_service_role_key' for the dispatcher to authenticate its
-- calls to trigger-job. Run once, by a human, in the SQL editor:
--   select vault.create_secret('<the real service_role key>', 'glue_dispatch_service_role_key', 'Bearer token glue.dispatch_pending_jobs uses to call trigger-job');
-- Until that secret exists, dispatch_pending_jobs() is a safe no-op (it
-- checks for the secret and returns early with a notice rather than
-- erroring the cron job).

create extension if not exists pg_net;

create or replace function glue.dispatch_pending_jobs()
returns integer
language plpgsql
security definer
set search_path = glue, extensions, public
as $$
declare
  v_key text;
  v_url text := 'https://qrqekucwdfyqqzomuble.supabase.co/functions/v1/trigger-job';
  v_job record;
  v_count integer := 0;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'glue_dispatch_service_role_key'
  limit 1;

  if v_key is null then
    raise notice 'glue.dispatch_pending_jobs: glue_dispatch_service_role_key not set in vault, skipping dispatch';
    return 0;
  end if;

  for v_job in
    select id
    from glue.workflow_jobs
    where state = 'pending'
    order by created_at asc
    limit 25
  loop
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object('job_id', v_job.id)
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function glue.dispatch_pending_jobs() is
  'Finds pending workflow_jobs and dispatches each to trigger-job via pg_net. The only thing that ever moves a job from pending to running -- scheduled every minute via pg_cron. No-ops until glue_dispatch_service_role_key exists in Vault.';

select cron.schedule(
  'dispatch-pending-glue-jobs',
  '* * * * *',
  $$select glue.dispatch_pending_jobs();$$
);
