// supabase/functions/scheduler-tick/index.ts
// Valtaris Glue — Scheduled Workflow Trigger (Generation 3)
//
// This Edge Function is responsible for:
// - Scanning workflow_schedules for schedules due to fire
// - Enqueuing a real workflow run via the shared trigger-ingress path
//   (the same enqueueFromTrigger() that webhook-ingress, manual-launch,
//   event-trigger-router, and load-harness all use)
// - Advancing next_run_at and tracking consecutive_failures
//
// Invoked on a timer (cron/external scheduler), or manually via the
// Activation admin panel's "tick now" action (src/store/useActivation.ts
// calls this function directly as `tickScheduler()`).
//
// Rewritten 2026-09-17: this file previously created workflow_runs
// directly against a workflow_definition_id/status/current_step_id shape
// that doesn't exist on the live schema (confirmed via
// information_schema.columns) -- every due schedule silently failed to
// ever enqueue a run. The workflow_schedules columns this file now
// reads/writes match src/store/useActivation.ts's WorkflowSchedule
// interface exactly -- the real, live contract, confirmed by reading the
// admin UI that already depends on it.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { enqueueFromTrigger } from "../_shared/triggers.ts";

interface WorkflowSchedule {
  id: string;
  name: string;
  dag_id: string;
  schedule_kind: string;
  interval_seconds: number | null;
  cron_expression: string | null;
  state: string;
  next_run_at: string | null;
  last_run_at: string | null;
  consecutive_failures: number;
  tenant_id: string;
}

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function computeNextRunAt(schedule: WorkflowSchedule): string {
  // Minimal scheduler: interval-based schedules advance by
  // interval_seconds; cron-based schedules fall back to a 1-minute tick
  // until a full cron parser is added (same placeholder scope the
  // original version of this file already had).
  const seconds = schedule.schedule_kind === "interval" ? (schedule.interval_seconds ?? 60) : 60;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function loadDueSchedules(
  supabase: ReturnType<typeof getSupabase>,
): Promise<WorkflowSchedule[]> {
  const { data, error } = await supabase
    .from("workflow_schedules")
    .select("*")
    .eq("state", "active")
    .lte("next_run_at", new Date().toISOString());

  if (error) {
    console.error("Error loading due schedules:", error);
    return [];
  }

  return (data ?? []) as WorkflowSchedule[];
}

serve(async () => {
  const supabase = getSupabase();
  const due = await loadDueSchedules(supabase);

  const triggered: Array<{ scheduleId: string; runId?: string; error?: string }> = [];

  for (const schedule of due) {
    const result = await enqueueFromTrigger(supabase, {
      tenant_id: schedule.tenant_id,
      dag_id: schedule.dag_id,
      payload: {},
      workflow_name: schedule.name,
      trigger_kind: "schedule",
      source_label: `schedule:${schedule.name}`,
    });

    await supabase
      .from("workflow_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: computeNextRunAt(schedule),
        consecutive_failures: result.ok ? 0 : schedule.consecutive_failures + 1,
      })
      .eq("id", schedule.id);

    triggered.push(
      result.ok
        ? { scheduleId: schedule.id, runId: result.run_id }
        : { scheduleId: schedule.id, error: result.error ?? result.suppressed_reason },
    );
  }

  return new Response(
    JSON.stringify({
      triggeredCount: triggered.length,
      triggered,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
