-- job-lifecycle's "retry"/"delay" actions were defined but never invoked
-- by any real caller -- worker-finalize and worker-timeout always called
-- job-lifecycle with action:"fail" on any failure, so retry_count and
-- max_retries (default 3) existed but did nothing: every failure was
-- terminal. This wires up the actual retry mechanism (separate Edge
-- Function changes in this same commit make worker-finalize/
-- worker-timeout choose action:"retry" while budget remains).
--
-- A retried job needs a "not before" timestamp so glue.dispatch_pending_jobs()
-- doesn't immediately re-fire it before its backoff elapses -- job-lifecycle
-- resets a retried/delayed job straight back to state='pending' (matching
-- ensure_downstream_job's convention, same as repair-stuck-job's reset),
-- so without this column it would be picked up on the very next
-- once-a-minute sweep regardless of backoff.

alter table glue.workflow_jobs
  add column next_attempt_at timestamptz;

comment on column glue.workflow_jobs.next_attempt_at is
  'Earliest time dispatch_pending_jobs() may dispatch this job again -- set by job-lifecycle on retry/delay for backoff. Null means immediately eligible.';

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
      and (next_attempt_at is null or next_attempt_at <= now())
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
