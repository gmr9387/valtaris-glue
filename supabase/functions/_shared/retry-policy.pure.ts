// Pure, runtime-portable retry-policy decisions shared by worker-finalize
// and worker-timeout: when a job fails, should it retry (there's budget
// left) or fail terminally (budget exhausted)? And if it retries, how
// long should the backoff be before the dispatcher picks it up again?
//
// Built 2026-09-26: previously job-lifecycle's "retry"/"delay" actions
// were defined but never invoked by any real caller -- worker-finalize
// and worker-timeout always called job-lifecycle with action:"fail" on
// any failure, so retry_count/max_retries existed but did nothing. This
// is the actual decision those two callers now make before choosing an
// action.

export function decideFailureAction(
  job: { retry_count?: number | null; max_retries?: number | null },
): "retry" | "fail" {
  const retryCount = job.retry_count ?? 0;
  const maxRetries = job.max_retries ?? 0;
  return retryCount < maxRetries ? "retry" : "fail";
}

// Exponential backoff: 30s, 60s, 120s, ... capped at 5 minutes. retryCount
// here is the count AFTER incrementing for this attempt (i.e. the 1st
// retry uses retryCount=1 -> 30s, matching "this is retry attempt N").
export function computeBackoffMs(retryCount: number): number {
  const BASE_MS = 30_000;
  const CAP_MS = 5 * 60_000;
  const n = Math.max(retryCount, 1);
  return Math.min(BASE_MS * 2 ** (n - 1), CAP_MS);
}
