// Real tests for the retry-policy decision logic shared by
// worker-finalize and worker-timeout -- decideFailureAction()/
// computeBackoffMs() are pure and portable, so they're imported
// directly here rather than needing to shim the whole Edge Function
// runtime just to exercise these decisions.
import { describe, it, expect } from "vitest";
import { decideFailureAction, computeBackoffMs } from "../../supabase/functions/_shared/retry-policy.pure.ts";

describe("retry-policy: decideFailureAction", () => {
  it("retries when retry_count is below max_retries", () => {
    expect(decideFailureAction({ retry_count: 0, max_retries: 3 })).toBe("retry");
    expect(decideFailureAction({ retry_count: 2, max_retries: 3 })).toBe("retry");
  });

  it("fails terminally once retry_count reaches max_retries", () => {
    expect(decideFailureAction({ retry_count: 3, max_retries: 3 })).toBe("fail");
    expect(decideFailureAction({ retry_count: 5, max_retries: 3 })).toBe("fail");
  });

  it("fails terminally when max_retries is 0 (no retry budget at all)", () => {
    expect(decideFailureAction({ retry_count: 0, max_retries: 0 })).toBe("fail");
  });

  it("treats missing retry_count/max_retries as 0 -- no budget, fails immediately", () => {
    expect(decideFailureAction({})).toBe("fail");
  });
});

describe("retry-policy: computeBackoffMs", () => {
  it("is 30s for the first retry", () => {
    expect(computeBackoffMs(1)).toBe(30_000);
  });

  it("doubles for each subsequent retry", () => {
    expect(computeBackoffMs(2)).toBe(60_000);
    expect(computeBackoffMs(3)).toBe(120_000);
    expect(computeBackoffMs(4)).toBe(240_000);
  });

  it("caps at 5 minutes even for a very high retry count", () => {
    expect(computeBackoffMs(10)).toBe(5 * 60_000);
  });

  it("treats retry_count <= 0 the same as 1 (30s floor)", () => {
    expect(computeBackoffMs(0)).toBe(30_000);
    expect(computeBackoffMs(-1)).toBe(30_000);
  });
});
