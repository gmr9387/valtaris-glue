// supabase/functions/run-worker/index.ts
// Valtaris Glue — Job Runner (Generation 3)
//
// This file is responsible for:
//   - loading a triggered job and its graph node
//   - claiming the job for this worker invocation
//   - executing the step via execute-step
//   - reporting the outcome to worker-finalize
//
// Authority chain:
//   trigger-job → run-worker → execute-step → connector-wrapper → adapter
//   run-worker → worker-finalize
//
// This file NEVER:
//   - talks to connectors directly (always via execute-step)
//   - mutates workflow_versions
//   - bypasses RLS
//   - schedules jobs directly
//
// Restored 2026-09-17: this file's deployed bytes were previously an
// exact copy of worker-finalize's source (confirmed via md5sum), so
// run-worker itself had no real logic -- trigger-job's handoff to it
// silently did nothing but re-run worker-finalize's job-lookup/lease-
// release/job-lifecycle-forwarding logic on a job that had not
// actually been executed yet.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const body = await req.json();
    const { job_id } = body;

    if (!job_id) {
      return jsonError("missing-job-id", 400);
    }

    const job = await loadJob(job_id);
    if (!job) return jsonError("job-not-found", 404);

    const run = await loadRun(job.run_id);
    if (!run) return jsonError("run-not-found", 404);

    const version = await loadVersion(run.workflow_version_id);
    if (!version) return jsonError("version-not-found", 404);

    const node = (version.graph?.nodes ?? []).find((n: any) => n.id === job.step_id);
    if (!node) return jsonError("step-not-in-graph", 404);

    // This invocation IS the worker for this job -- claim it so
    // worker-finalize's releaseLease (which matches on claimed_by) can
    // find it again.
    const worker_id = crypto.randomUUID();
    await supabase
      .from("workflow_jobs")
      .update({ claimed_by: worker_id })
      .eq("id", job_id);

    let status: "completed" | "failed";
    let result: unknown = null;
    let error: unknown = null;

    try {
      const { data, error: stepError } = await supabase.functions.invoke("execute-step", {
        body: {
          run_id: job.run_id,
          step_id: job.step_id,
          job_id,
          node,
          adapter: node.connector,
          payload: job.payload,
        },
      });

      if (stepError) throw stepError;

      status = "completed";
      result = data?.result ?? data;
    } catch (err) {
      status = "failed";
      error = err instanceof Error ? err.message : String(err);
    }

    await supabase.functions.invoke("worker-finalize", {
      body: { job_id, worker_id, status, result, error },
    });

    return jsonOK({
      status: "run-worker-dispatched",
      job_id,
      worker_id,
      outcome: status,
    });
  } catch (err) {
    console.error("run-worker fatal error:", err);
    return jsonError("run-worker-failed", 500, err);
  }
});

// ------------------------------------------------------------
// Loaders
// ------------------------------------------------------------

async function loadJob(jobId: string) {
  const { data } = await supabase.from("workflow_jobs").select("*").eq("id", jobId).single();
  return data ?? null;
}

async function loadRun(runId: string) {
  const { data } = await supabase.from("workflow_runs").select("*").eq("id", runId).single();
  return data ?? null;
}

async function loadVersion(versionId: string) {
  const { data } = await supabase
    .from("workflow_versions")
    .select("*")
    .eq("id", versionId)
    .single();
  return data ?? null;
}

// ------------------------------------------------------------
// Response Helpers
// ------------------------------------------------------------

function jsonOK(obj: any) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(code: string, status = 500, details?: any) {
  return new Response(
    JSON.stringify({
      error: code,
      details,
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}
