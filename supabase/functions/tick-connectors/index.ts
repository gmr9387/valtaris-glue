// supabase/functions/tick-connectors/index.ts
// Valtaris Glue — Connector Poll Trigger (Generation 3)
//
// This Edge Function is responsible for:
// - Scanning connector_schedules for connectors due to be polled
// - Executing the poll via connector-runner
// - Enqueuing a real workflow run (via the shared trigger-ingress path,
//   the same enqueueFromTrigger() webhook-ingress/manual-launch/
//   event-trigger-router/load-harness all use) when the poll produces
//   actionable output
// - Advancing next_tick_at and tracking consecutive_failures
//
// Rewritten 2026-09-17: this file previously created workflow_runs
// directly against a workflow_definition_id/status/current_step_id shape
// that doesn't exist on the live schema -- every due connector schedule
// silently failed to ever enqueue a run, even when the poll itself
// succeeded. The connector-runner call itself was already schema-correct
// and is unchanged.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { enqueueFromTrigger } from "../_shared/triggers.ts";

interface ConnectorSchedule {
  id: string;
  connector_key: string;
  dag_id: string | null;
  state: string;
  interval_seconds: number;
  next_tick_at: string | null;
  last_tick_at: string | null;
  consecutive_failures: number;
  tenant_id: string;
}

interface ConnectorPollResult {
  success: boolean;
  output?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

async function loadDueConnectorSchedules(
  supabase: ReturnType<typeof getSupabase>,
): Promise<ConnectorSchedule[]> {
  const { data, error } = await supabase
    .from("connector_schedules")
    .select("*")
    .eq("state", "active")
    .lte("next_tick_at", new Date().toISOString());

  if (error) {
    console.error("Error loading due connector schedules:", error);
    return [];
  }

  return (data ?? []) as ConnectorSchedule[];
}

async function pollConnector(connectorKey: string): Promise<ConnectorPollResult> {
  try {
    const res = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/connector-runner`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ connectorKey, payload: {} }),
      },
    );

    return await res.json();
  } catch (err) {
    return {
      success: false,
      errorCode: "connector.tick_failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

serve(async () => {
  const supabase = getSupabase();
  const due = await loadDueConnectorSchedules(supabase);

  const triggered: Array<{
    scheduleId: string;
    polled: boolean;
    runId?: string;
    error?: string;
  }> = [];

  for (const schedule of due) {
    const pollResult = await pollConnector(schedule.connector_key);
    let runId: string | undefined;
    let errorMessage: string | undefined = pollResult.errorMessage;

    if (pollResult.success && schedule.dag_id) {
      const result = await enqueueFromTrigger(supabase, {
        tenant_id: schedule.tenant_id,
        dag_id: schedule.dag_id,
        payload: pollResult.output ?? {},
        workflow_name: `connector:${schedule.connector_key}`,
        trigger_kind: "event",
        source_label: `connector:${schedule.connector_key}`,
      });
      runId = result.run_id;
      if (!result.ok) errorMessage = result.error ?? result.suppressed_reason;
    }

    await supabase
      .from("connector_schedules")
      .update({
        last_tick_at: new Date().toISOString(),
        next_tick_at: new Date(Date.now() + schedule.interval_seconds * 1000).toISOString(),
        consecutive_failures: pollResult.success ? 0 : schedule.consecutive_failures + 1,
      })
      .eq("id", schedule.id);

    triggered.push({
      scheduleId: schedule.id,
      polled: !!pollResult.success,
      runId,
      error: errorMessage,
    });
  }

  return new Response(
    JSON.stringify({
      triggeredCount: triggered.length,
      triggered,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
