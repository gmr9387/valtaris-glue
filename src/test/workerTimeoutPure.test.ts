// Real tests for worker-timeout's timeout-detection decision logic --
// isJobTimedOut()/isStepTimedOut() are pure and portable, so they're
// imported directly here rather than needing to shim the whole Edge
// Function runtime (Deno.env, a remote-URL Supabase import) just to
// exercise a timestamp-comparison decision.
import { describe, it, expect } from "vitest";
import { isJobTimedOut, isStepTimedOut, WORKER_TIMEOUT_MS } from "../../supabase/functions/worker-timeout.pure.ts";

describe("worker-timeout: isJobTimedOut", () => {
  const now = Date.parse("2026-09-26T12:00:00.000Z");

  it("is false when the job isn't running", () => {
    expect(isJobTimedOut({ state: "pending", started_at: new Date(now - WORKER_TIMEOUT_MS - 1000).toISOString() }, now)).toBe(false);
    expect(isJobTimedOut({ state: "completed", started_at: new Date(now - WORKER_TIMEOUT_MS - 1000).toISOString() }, now)).toBe(false);
  });

  it("is false when running but started_at is missing", () => {
    expect(isJobTimedOut({ state: "running", started_at: null }, now)).toBe(false);
  });

  it("is false when running and still within the timeout window", () => {
    expect(isJobTimedOut({ state: "running", started_at: new Date(now - 1000).toISOString() }, now)).toBe(false);
  });

  it("is true when running and started_at exceeds WORKER_TIMEOUT_MS ago", () => {
    expect(isJobTimedOut({ state: "running", started_at: new Date(now - WORKER_TIMEOUT_MS - 1000).toISOString() }, now)).toBe(true);
  });

  it("treats exactly-at-the-boundary as not-yet-timed-out (strictly greater-than)", () => {
    expect(isJobTimedOut({ state: "running", started_at: new Date(now - WORKER_TIMEOUT_MS).toISOString() }, now)).toBe(false);
  });
});

describe("worker-timeout: isStepTimedOut", () => {
  const now = Date.parse("2026-09-26T12:00:00.000Z");

  it("is false when there's no matching step", () => {
    expect(isStepTimedOut(undefined, now)).toBe(false);
  });

  it("is false when the step isn't running", () => {
    expect(isStepTimedOut({ state: "completed", created_at: new Date(now - WORKER_TIMEOUT_MS - 1000).toISOString() }, now)).toBe(false);
  });

  it("is false when running but created_at is missing", () => {
    expect(isStepTimedOut({ state: "running", created_at: null }, now)).toBe(false);
  });

  it("is false when running and still within the timeout window", () => {
    expect(isStepTimedOut({ state: "running", created_at: new Date(now - 1000).toISOString() }, now)).toBe(false);
  });

  it("is true when running and created_at exceeds WORKER_TIMEOUT_MS ago", () => {
    expect(isStepTimedOut({ state: "running", created_at: new Date(now - WORKER_TIMEOUT_MS - 1000).toISOString() }, now)).toBe(true);
  });
});
