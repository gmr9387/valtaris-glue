// Real tests for the shared root/initial-step decision logic used by
// both execute-workflow and enqueueFromTrigger (_shared/triggers.ts) --
// findInitialSteps()/findPredecessors() are pure and portable, so
// they're imported directly here rather than needing to shim the whole
// Edge Function runtime just to exercise a graph-traversal decision.
import { describe, it, expect } from "vitest";
import { findInitialSteps, findPredecessors } from "../../supabase/functions/_shared/dag-roots.pure.ts";
import type { DagNode } from "../../supabase/functions/schedule-next-job.pure.ts";

describe("dag-roots: findPredecessors", () => {
  it("returns an empty list for a node with no incoming edges", () => {
    const root: DagNode = { id: "root" };
    expect(findPredecessors([root], "root")).toEqual([]);
  });

  it("finds a predecessor across each of the four edge types", () => {
    const a: DagNode = { id: "a", next: ["target"] };
    const b: DagNode = { id: "b", on_failure: ["target"] };
    const c: DagNode = { id: "c", on_approval: ["target"] };
    const d: DagNode = { id: "d", on_compensation: ["target"] };
    const target: DagNode = { id: "target" };
    const nodes = [a, b, c, d, target];

    expect(findPredecessors(nodes, "target").sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("does not match a node whose edge list points elsewhere", () => {
    const a: DagNode = { id: "a", next: ["other"] };
    const target: DagNode = { id: "target" };
    expect(findPredecessors([a, target], "target")).toEqual([]);
  });
});

describe("dag-roots: findInitialSteps", () => {
  it("returns every node with zero predecessors as a root", () => {
    const a: DagNode = { id: "a" };
    const b: DagNode = { id: "b" };
    const c: DagNode = { id: "c", next: ["d"] };
    const d: DagNode = { id: "d" };
    const nodes = [a, b, c, d];

    expect(findInitialSteps(nodes).sort()).toEqual(["a", "b", "c"]);
  });

  it("returns an empty list for an empty graph", () => {
    expect(findInitialSteps([])).toEqual([]);
  });

  it("a node reachable via any edge type is excluded from the roots", () => {
    const a: DagNode = { id: "a", on_failure: ["b"] };
    const b: DagNode = { id: "b" };
    expect(findInitialSteps([a, b])).toEqual(["a"]);
  });
});
