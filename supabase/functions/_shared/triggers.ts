// Shared helpers for trigger ingress: enqueue a workflow run from any trigger
// (webhook, schedule, manual, event) through the same path as execute-workflow.
// Centralizing this guarantees identical lineage, telemetry, and replay semantics.
//
// Migrated 2026-09-26 onto the Gen-3 engine: this previously addressed
// workflows via dag_id -> glue.workflow_dags (dependsOn edges,
// workflow_jobs.dag_node_id) -- a system with zero FK relationship to
// the Gen-3 engine (execute-workflow/schedule-next-job/run-worker/
// trigger-job), which addresses workflows via workflow_version_id ->
// glue.workflow_versions (next/on_failure/on_approval/on_compensation
// edges, workflow_jobs.step_id). Root jobs created here now use
// ensure_downstream_job, the same RPC execute-workflow uses, so a job
// created by a trigger is indistinguishable from one created by a direct
// execute-workflow call. dag_id is kept only as a label for lineage/audit.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { findInitialSteps } from "./dag-roots.pure.ts";
import type { DagNode } from "../schedule-next-job.pure.ts";

export interface EnqueueArgs {
  tenant_id: string;
  /** Execution pin: the workflow_versions graph to run. */
  workflow_version_id: string;
  /** Label only, for lineage/audit -- workflow_dags is not consulted. */
  dag_id?: string | null;
  payload?: Record<string, unknown>;
  correlation_id?: string;
  workflow_name?: string;
  trigger_kind: "webhook" | "schedule" | "manual" | "event";
  source_label?: string;
  trigger_id?: string | null;
  depth?: number;
}


export interface EnqueueResult {
  ok: boolean;
  run_id?: string;
  error?: string;
  suppressed_reason?: string;
}

const MAX_DEPTH = 5;

export function svc(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Enqueue a workflow run originating from a trigger. Mirrors execute-workflow. */
export async function enqueueFromTrigger(sb: SupabaseClient, a: EnqueueArgs): Promise<EnqueueResult> {
  const depth = a.depth ?? 0;
  if (depth > MAX_DEPTH) {
    await sb.from("trigger_activations").insert({
      tenant_id: a.tenant_id,
      trigger_id: a.trigger_id ?? null,
      trigger_kind: a.trigger_kind,
      source_label: a.source_label ?? null,
      payload: a.payload ?? {},
      depth,
      suppressed: true,
      suppressed_reason: `recursion depth ${depth} exceeded max ${MAX_DEPTH}`,
    });
    return { ok: false, suppressed_reason: "max_depth_exceeded" };
  }

  if (!a.workflow_version_id) {
    return { ok: false, error: "workflow_version_id not set -- pin a workflow version before this trigger can fire" };
  }

  const { data: version } = await sb.from("workflow_versions").select("id, graph").eq("id", a.workflow_version_id).maybeSingle();
  if (!version) return { ok: false, error: `workflow_version ${a.workflow_version_id} not found` };

  const correlation_id = a.correlation_id ?? crypto.randomUUID();
  const workflow_name = a.workflow_name ?? a.dag_id ?? a.workflow_version_id;

  const { data: runRow, error: runErr } = await sb.from("workflow_runs").insert({
    workflow_name,
    tenant_id: a.tenant_id,
    workflow_version_id: a.workflow_version_id,
    state: "queued",
    status: "queued",
    correlation_id,
    payload: { ...(a.payload ?? {}), _trigger: { kind: a.trigger_kind, source: a.source_label, depth, dag_id: a.dag_id ?? null } },
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (runErr || !runRow) return { ok: false, error: runErr?.message ?? "run insert failed" };
  const run_id = runRow.id as string;

  // Root jobs, via the same ensure_downstream_job RPC every other Gen-3
  // caller uses (execute-workflow/schedule-next-job) -- keeps job
  // creation, state literals, and column usage (step_id, not
  // dag_node_id) identical across every path into the engine.
  const nodes = ((version.graph as { nodes?: DagNode[] } | null)?.nodes ?? []) as DagNode[];
  const roots = findInitialSteps(nodes);
  for (const stepId of roots) {
    await sb.rpc("ensure_downstream_job", { p_run_id: run_id, p_step_id: stepId });
  }

  await sb.from("workflow_runs").update({ state: "running", status: "running" }).eq("id", run_id);

  // Lineage event
  await sb.from("workflow_events").insert({
    run_id,
    tenant_id: a.tenant_id,
    type: `trigger.${a.trigger_kind}.fired`,
    severity: "info",
    source: "trigger-ingress",
    message: `Run enqueued via ${a.trigger_kind} (${a.source_label ?? "unknown"})`,
    data: { correlation_id, depth, trigger_id: a.trigger_id ?? null, dag_id: a.dag_id ?? null },
  });

  // Activation record
  await sb.from("trigger_activations").insert({
    tenant_id: a.tenant_id,
    trigger_id: a.trigger_id ?? null,
    trigger_kind: a.trigger_kind,
    source_label: a.source_label ?? null,
    payload: a.payload ?? {},
    depth,
    run_id,
  });

  // Dispatch to trigger-job is no longer nudged eagerly here -- the
  // glue.dispatch_pending_jobs() cron sweep (every ~1min) picks up these
  // pending root jobs the same way it picks up execute-workflow's, so
  // there is exactly one dispatch mechanism instead of two.
  return { ok: true, run_id };
}

/** HMAC SHA-256 hex digest. */
export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
