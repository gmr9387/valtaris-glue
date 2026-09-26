// Real tests for schedule-next-job's DAG-readiness decision logic --
// previously untested (this repo's only test file was a placeholder
// asserting invariants against inline literals). isReady()/
// latestStateByStep() are pure and portable, so they're imported
// directly here rather than needing to shim the whole Edge Function
// runtime (Deno.env, a remote-URL Supabase import) just to exercise a
// graph-traversal decision.
import { describe, it, expect } from "vitest";
import { isReady, latestStateByStep, type DagNode } from "../../supabase/functions/schedule-next-job.pure.ts";

describe("schedule-next-job: latestStateByStep", () => {
  it("keeps the last write per step_id when a step transitioned more than once", () => {
    const result = latestStateByStep([
      { step_id: "a", state: "running" },
      { step_id: "a", state: "failed" },
      { step_id: "a", state: "retrying" },
      { step_id: "b", state: "completed" },
    ]);
    expect(result.get("a")).toBe("retrying");
    expect(result.get("b")).toBe("completed");
  });

  it("returns an empty map for no step runs", () => {
    expect(latestStateByStep([]).size).toBe(0);
  });
});

describe("schedule-next-job: isReady (DAG readiness)", () => {
  it("a root node (no incoming edges) is never ready -- seeded by execute-workflow instead", () => {
    const root: DagNode = { id: "root" };
    expect(isReady(root, [root], new Map())).toBe(false);
  });

  it("a 'next' AND-join requires ALL predecessors to have completed", () => {
    const a: DagNode = { id: "a", next: ["join"] };
    const b: DagNode = { id: "b", next: ["join"] };
    const join: DagNode = { id: "join" };
    const nodes = [a, b, join];

    // Only one of two predecessors completed -- not ready yet.
    expect(isReady(join, nodes, latestStateByStep([{ step_id: "a", state: "completed" }, { step_id: "b", state: "running" }]))).toBe(false);

    // Both completed -- ready.
    expect(isReady(join, nodes, latestStateByStep([{ step_id: "a", state: "completed" }, { step_id: "b", state: "completed" }]))).toBe(true);
  });

  it("a single 'next' predecessor gates readiness on its own completion", () => {
    const a: DagNode = { id: "a", next: ["b"] };
    const b: DagNode = { id: "b" };
    const nodes = [a, b];

    expect(isReady(b, nodes, latestStateByStep([{ step_id: "a", state: "running" }]))).toBe(false);
    expect(isReady(b, nodes, latestStateByStep([{ step_id: "a", state: "completed" }]))).toBe(true);
  });

  it("'on_failure' is an OR-branch: any one predecessor failing opens the path", () => {
    const a: DagNode = { id: "a", on_failure: ["handler"] };
    const b: DagNode = { id: "b", on_failure: ["handler"] };
    const handler: DagNode = { id: "handler" };
    const nodes = [a, b, handler];

    // Neither failed yet.
    expect(isReady(handler, nodes, latestStateByStep([{ step_id: "a", state: "running" }, { step_id: "b", state: "running" }]))).toBe(false);

    // Only one failed -- OR-branch means that's enough.
    expect(isReady(handler, nodes, latestStateByStep([{ step_id: "a", state: "failed" }, { step_id: "b", state: "running" }]))).toBe(true);
  });

  it("a completed predecessor does not satisfy an on_failure edge (wrong trigger state)", () => {
    const a: DagNode = { id: "a", on_failure: ["handler"] };
    const handler: DagNode = { id: "handler" };
    const nodes = [a, handler];

    expect(isReady(handler, nodes, latestStateByStep([{ step_id: "a", state: "completed" }]))).toBe(false);
  });

  it("on_approval and on_compensation are OR-branches on their own distinct trigger states", () => {
    const a: DagNode = { id: "a", on_approval: ["approved-path"] };
    const b: DagNode = { id: "b", on_compensation: ["comp-path"] };
    const approvedPath: DagNode = { id: "approved-path" };
    const compPath: DagNode = { id: "comp-path" };
    const nodes = [a, b, approvedPath, compPath];

    expect(isReady(approvedPath, nodes, latestStateByStep([{ step_id: "a", state: "approved" }]))).toBe(true);
    expect(isReady(approvedPath, nodes, latestStateByStep([{ step_id: "a", state: "completed" }]))).toBe(false);
    expect(isReady(compPath, nodes, latestStateByStep([{ step_id: "b", state: "compensated" }]))).toBe(true);
  });

  it("a node reachable via multiple edge types is ready if ANY edge's condition is met (edges are independent alternate paths)", () => {
    const a: DagNode = { id: "a", next: ["target"] };
    const b: DagNode = { id: "b", on_failure: ["target"] };
    const target: DagNode = { id: "target" };
    const nodes = [a, b, target];

    // "next" from a not satisfied, but "on_failure" from b is.
    expect(isReady(target, nodes, latestStateByStep([{ step_id: "a", state: "running" }, { step_id: "b", state: "failed" }]))).toBe(true);
  });

  it("no step run recorded yet for a predecessor means its state is undefined -- never satisfies a trigger", () => {
    const a: DagNode = { id: "a", next: ["b"] };
    const b: DagNode = { id: "b" };
    const nodes = [a, b];

    expect(isReady(b, nodes, latestStateByStep([]))).toBe(false);
  });
});
