// Pure, runtime-portable stuck-job detection extracted out of
// repair-stuck-job -- no Deno.env, no remote URL imports, so it's
// directly testable from Vitest. The bare `repair-stuck-job` file
// imports and uses this instead of inlining it; same logic, just
// isolated so it can be verified directly.

export const MAX_JOB_RUNTIME_MS = 5 * 60 * 1000; // 5 minutes

export interface StuckJobCheck {
  leaseExpired: boolean;
  runningTooLong: boolean;
  stuck: boolean;
  reason: "lease-expired" | "running-too-long" | null;
}

/**
 * A job is stuck if its lease has expired (the worker that claimed it
 * never finished and never renewed) or it's been running longer than
 * the max allowed runtime (the worker likely crashed mid-execution
 * without ever releasing the lease at all). Either is independently
 * sufficient -- lease-expired is checked first for the reported reason
 * since it's the more specific signal.
 */
export function checkStuckJob(
  job: { lease_expires_at?: string | null; claimed_at?: string | null },
  now: number,
): StuckJobCheck {
  const leaseExpired = Boolean(job.lease_expires_at) && new Date(job.lease_expires_at!).getTime() < now;

  const runningTooLong = Boolean(job.claimed_at) && now - new Date(job.claimed_at!).getTime() > MAX_JOB_RUNTIME_MS;

  return {
    leaseExpired,
    runningTooLong,
    stuck: leaseExpired || runningTooLong,
    reason: leaseExpired ? "lease-expired" : runningTooLong ? "running-too-long" : null,
  };
}
