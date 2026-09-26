// Pure, runtime-portable DAG-readiness logic extracted out of
// schedule-next-job -- no Deno.env, no remote URL imports, so it's
// directly testable from Vitest instead of needing to shim a whole
// Edge Function runtime just to exercise a graph-traversal decision.
// The bare `schedule-next-job` file imports and uses these instead of
// inlining them; this holds no behavior it didn't already have.

export type DagNode = Record<string, unknown> & { id: string };

// A node can be reached via up to four edge types from its
// predecessors (next/on_failure/on_approval/on_compensation). Each
// edge type is an alternate path with its own trigger condition on
// the predecessor's terminal step-run state. A "next" join requires
// ALL next-predecessors to have completed (standard AND-join); the
// other edge types are OR-branches -- any one predecessor reaching
// that state is enough to take that path.
export const EDGE_TRIGGER_STATE: Record<string, string> = {
  next: "completed",
  on_failure: "failed",
  on_approval: "approved",
  on_compensation: "compensated",
};

export function isReady(
  node: DagNode,
  allNodes: DagNode[],
  latestStepState: Map<string, string>,
): boolean {
  const incoming: { from: string; edge: keyof typeof EDGE_TRIGGER_STATE }[] = [];

  for (const candidate of allNodes) {
    for (const edge of ["next", "on_failure", "on_approval", "on_compensation"] as const) {
      const list = candidate[edge] ?? [];
      if (Array.isArray(list) && list.includes(node.id)) {
        incoming.push({ from: candidate.id as string, edge });
      }
    }
  }

  if (incoming.length === 0) return false; // root nodes are seeded by execute-workflow

  const byEdge = new Map<string, { from: string; edge: string }[]>();
  for (const inc of incoming) {
    if (!byEdge.has(inc.edge)) byEdge.set(inc.edge, []);
    byEdge.get(inc.edge)!.push(inc);
  }

  for (const [edge, preds] of byEdge) {
    const triggerState = EDGE_TRIGGER_STATE[edge];
    if (edge === "next") {
      // AND-join: every "next" predecessor must have completed.
      if (preds.every((p) => latestStepState.get(p.from) === triggerState)) {
        return true;
      }
    } else {
      // OR-branch: any predecessor reaching this state opens the path.
      if (preds.some((p) => latestStepState.get(p.from) === triggerState)) {
        return true;
      }
    }
  }

  return false;
}

export function latestStateByStep(
  stepRuns: { step_id: string; state: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const run of stepRuns) {
    // stepRuns is ordered oldest-first by loadStepRuns, so the last
    // write per step_id wins.
    map.set(run.step_id, run.state);
  }
  return map;
}
