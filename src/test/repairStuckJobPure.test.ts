// Real tests for repair-stuck-job's stuck-detection decision logic --
// checkStuckJob() is pure and portable, so it's imported directly here
// rather than needing to shim the whole Edge Function runtime
// (Deno.env, a remote-URL Supabase import) just to exercise a
// timestamp-comparison decision.
import { describe, it, expect } from "vitest";
import { checkStuckJob, MAX_JOB_RUNTIME_MS } from "../../supabase/functions/repair-stuck-job.pure.ts";

describe("repair-stuck-job: checkStuckJob", () => {
  const now = Date.parse("2026-09-26T12:00:00.000Z");

  it("is not stuck when the lease hasn't expired and it hasn't been running too long", () => {
    const result = checkStuckJob(
      {
        lease_expires_at: new Date(now + 60_000).toISOString(),
        claimed_at: new Date(now - 60_000).toISOString(),
      },
      now,
    );
    expect(result).toEqual({
      leaseExpired: false,
      runningTooLong: false,
      stuck: false,
      reason: null,
    });
  });

  it("is stuck with reason 'lease-expired' when the lease has expired but runtime is still within bounds", () => {
    const result = checkStuckJob(
      {
        lease_expires_at: new Date(now - 1_000).toISOString(),
        claimed_at: new Date(now - 60_000).toISOString(),
      },
      now,
    );
    expect(result.leaseExpired).toBe(true);
    expect(result.runningTooLong).toBe(false);
    expect(result.stuck).toBe(true);
    expect(result.reason).toBe("lease-expired");
  });

  it("is stuck with reason 'running-too-long' when claimed_at exceeds MAX_JOB_RUNTIME_MS but the lease hasn't expired", () => {
    const result = checkStuckJob(
      {
        lease_expires_at: new Date(now + 60_000).toISOString(),
        claimed_at: new Date(now - MAX_JOB_RUNTIME_MS - 1_000).toISOString(),
      },
      now,
    );
    expect(result.leaseExpired).toBe(false);
    expect(result.runningTooLong).toBe(true);
    expect(result.stuck).toBe(true);
    expect(result.reason).toBe("running-too-long");
  });

  it("prefers 'lease-expired' as the reported reason when both conditions are true simultaneously", () => {
    const result = checkStuckJob(
      {
        lease_expires_at: new Date(now - 1_000).toISOString(),
        claimed_at: new Date(now - MAX_JOB_RUNTIME_MS - 1_000).toISOString(),
      },
      now,
    );
    expect(result.leaseExpired).toBe(true);
    expect(result.runningTooLong).toBe(true);
    expect(result.stuck).toBe(true);
    expect(result.reason).toBe("lease-expired");
  });

  it("is not stuck when neither field is set (never claimed, no lease)", () => {
    const result = checkStuckJob({ lease_expires_at: null, claimed_at: null }, now);
    expect(result).toEqual({
      leaseExpired: false,
      runningTooLong: false,
      stuck: false,
      reason: null,
    });
  });

  it("treats exactly-at-the-runtime-boundary as not-yet-too-long (strictly greater-than)", () => {
    const result = checkStuckJob(
      {
        lease_expires_at: new Date(now + 60_000).toISOString(),
        claimed_at: new Date(now - MAX_JOB_RUNTIME_MS).toISOString(),
      },
      now,
    );
    expect(result.runningTooLong).toBe(false);
    expect(result.stuck).toBe(false);
  });

  it("treats exactly-at-the-lease-expiry boundary as not-yet-expired (strictly less-than)", () => {
    const result = checkStuckJob(
      {
        lease_expires_at: new Date(now).toISOString(),
        claimed_at: new Date(now - 60_000).toISOString(),
      },
      now,
    );
    expect(result.leaseExpired).toBe(false);
    expect(result.stuck).toBe(false);
  });
});
