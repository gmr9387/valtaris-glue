// Pure, runtime-portable timeout-detection logic extracted out of
// worker-timeout -- no Deno.env, no remote URL imports, so it's
// directly testable from Vitest instead of needing to shim a whole
// Edge Function runtime just to exercise a timestamp-comparison
// decision. The bare `worker-timeout` file imports and uses these
// instead of inlining them; this holds no behavior it didn't already
// have.

// Worker-side timeout (Generation-3 standard)
export const WORKER_TIMEOUT_MS = 1000 * 60 * 10; // 10 minutes

export function isJobTimedOut(
  job: { state?: string | null; started_at?: string | null },
  now: number,
): boolean {
  if (job.state !== "running") return false;
  if (!job.started_at) return false;
  return now - new Date(job.started_at).getTime() > WORKER_TIMEOUT_MS;
}

export function isStepTimedOut(
  step: { state?: string | null; created_at?: string | null } | undefined,
  now: number,
): boolean {
  if (!step) return false;
  if (step.state !== "running") return false;
  if (!step.created_at) return false;
  return now - new Date(step.created_at).getTime() > WORKER_TIMEOUT_MS;
}
