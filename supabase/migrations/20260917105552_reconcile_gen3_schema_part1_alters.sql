-- Reconcile live schema with what the deployed "Generation 3" Edge
-- Functions actually reference. The local migrations/ directory (dated
-- 2026-04 to 2026-05) describes a different, abandoned single-tenant
-- schema that predates the current multi-tenant workflow engine -- it
-- was never applied to this project and is not the source of truth
-- here. This migration set is reverse-engineered directly from the
-- real, currently-deployed function source in supabase/functions/,
-- confirmed by cross-referencing which columns each real caller
-- actually inserts/selects/updates.
--
-- Several tables carry two generations of column conventions in the
-- deployed code (e.g. workflow_jobs: state vs status, run_id vs
-- workflow_run_id). This migration set supports the "Generation 3"
-- convention only (used by the large majority of functions); four
-- functions (tick-connectors, scheduler-tick, rollback-executor,
-- worker/index.ts) still use the older "legacy" convention and are
-- known to be broken against this schema -- that's a follow-up to
-- rewrite those functions, not to widen the schema further.
--
-- Part 1: add the real columns Gen-3 code needs to the 7 tables that
-- already exist live. Nothing here removes or renames an existing
-- column -- purely additive, so no existing RPC (create_workflow_run_atomic,
-- claim_next_job, mark_job_completed, finalize_run_if_terminal, etc.)
-- can break.

-- workflow_runs: init-workflow/execute-workflow/_shared/triggers.ts/
-- runtime-validate/repair-stuck-run all reference these.
ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS workflow_name text,
  ADD COLUMN IF NOT EXISTS dag_id text,
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS current_step_id text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS final_metrics jsonb,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS replay_of uuid REFERENCES public.workflow_runs(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- workflow_versions: workflow-publish's real save_draft action reads/
-- writes these; missing today means that action errors on every call.
ALTER TABLE public.workflow_versions
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- workflow_jobs: worker_id is referenced by the already-deployed
-- claim_next_job(p_worker_id uuid) RPC (confirmed via pg_get_functiondef)
-- which has been erroring on every call since that column never
-- existed -- a real, pre-existing bug this closes. The rest are real
-- Gen-3 columns used by job-lifecycle, trigger-job, repair-*, and the
-- new run-worker/schedule-next-job this migration set's follow-up adds.
ALTER TABLE public.workflow_jobs
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS dag_node_id text,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS workflow_version_id uuid,
  ADD COLUMN IF NOT EXISTS worker_id uuid,
  ADD COLUMN IF NOT EXISTS claimed_by uuid,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS partition_key text,
  ADD COLUMN IF NOT EXISTS priority_class text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress jsonb,
  ADD COLUMN IF NOT EXISTS progress_at timestamptz;

-- workflow_step_runs
ALTER TABLE public.workflow_step_runs
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.workflow_jobs(id),
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS workflow_version_id uuid,
  ADD COLUMN IF NOT EXISTS type text;

-- workflow_run_repair: repair-stuck-run (real, deployed) writes
-- `reason`, but the live table only had `action` -- this insert has
-- been failing on every real invocation.
ALTER TABLE public.workflow_run_repair
  ADD COLUMN IF NOT EXISTS reason text;

-- workflow_versions/workflow_jobs/workflow_step_runs already existed
-- with RLS enabled and zero policies (service-role-only access, which
-- is what every real Edge Function uses -- see this project's own
-- rls_auto_enable event trigger, which already enables RLS on every
-- new table automatically). No policy changes needed here.
