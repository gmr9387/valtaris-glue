// Pure, runtime-portable "find the root/initial steps of a graph" logic,
// shared between execute-workflow (the direct internal launch path) and
// enqueueFromTrigger (the trigger-ingress launch path) so both create the
// exact same set of initial jobs for the same graph. A root step is any
// node with no predecessors across all four edge types (next/on_failure/
// on_approval/on_compensation) -- same edge model schedule-next-job.pure.ts
// uses for DAG-progression readiness.

import type { DagNode } from "../schedule-next-job.pure.ts";

export function findPredecessors(nodes: DagNode[], stepId: string): string[] {
  const preds: string[] = [];
  for (const node of nodes) {
    for (const edge of ["next", "on_failure", "on_approval", "on_compensation"] as const) {
      const list = node[edge];
      if (Array.isArray(list) && list.includes(stepId)) {
        preds.push(node.id);
      }
    }
  }
  return preds;
}

export function findInitialSteps(nodes: DagNode[]): string[] {
  const roots: string[] = [];
  for (const node of nodes) {
    if (findPredecessors(nodes, node.id).length === 0) {
      roots.push(node.id);
    }
  }
  return roots;
}
