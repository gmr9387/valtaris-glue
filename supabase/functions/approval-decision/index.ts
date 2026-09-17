// supabase/functions/approval-decision/index.ts
// Valtaris Glue — Human Approval Decision Handler (Generation 3)
//
// This file is responsible for:
//   - recording an operator's approve/reject decision on a pending
//     workflow_approvals row
//   - resuming the DAG via step-lifecycle's existing "approve"/"reject"
//     actions
//
// Authority chain:
//   (operator action) → approval-decision → step-lifecycle → schedule-next-job
//
// This file NEVER:
//   - executes connectors
//   - creates jobs directly
//   - mutates workflow_versions
//   - bypasses RLS
//   - decides on its own -- only ever records a real operator's choice
//
// Restored 2026-09-17: this file's deployed bytes were previously an
// exact copy of dead-letter's source (confirmed via md5sum), so no
// code path anywhere actually wrote to workflow_approvals -- an
// "approval" step's graph node had no way to ever actually resume.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const body = await req.json();
    const { approval_id, operator_uid, decision, reason } = body;

    if (!approval_id || !operator_uid || !decision) {
      return jsonError("missing-fields", 400);
    }
    if (decision !== "approve" && decision !== "reject") {
      return jsonError("invalid-decision", 400);
    }

    const approval = await loadApproval(approval_id);
    if (!approval) return jsonError("approval-not-found", 404);

    if (approval.state !== "pending") {
      return jsonError("approval-not-pending", 400, { state: approval.state });
    }
    if (approval.expires_at && new Date(approval.expires_at).getTime() < Date.now()) {
      await supabase
        .from("workflow_approvals")
        .update({ state: "expired" })
        .eq("id", approval_id);
      return jsonError("approval-expired", 400);
    }

    const newState = decision === "approve" ? "approved" : "rejected";

    const { error: updateErr } = await supabase
      .from("workflow_approvals")
      .update({
        state: newState,
        decision,
        decided_by: operator_uid,
        decided_at: new Date(),
        reason: reason ?? approval.reason ?? null,
      })
      .eq("id", approval_id)
      .eq("state", "pending"); // idempotency guard

    if (updateErr) {
      console.error("approval-decision update error:", updateErr);
      return jsonError("approval-update-failed", 500, updateErr);
    }

    const step_id = approval.step_id ?? approval.dag_node_id;

    await supabase.functions.invoke("step-lifecycle", {
      body: {
        run_id: approval.run_id,
        step_id,
        action: decision === "approve" ? "approve" : "reject",
      },
    });

    return jsonOK({
      status: "approval-decided",
      approval_id,
      run_id: approval.run_id,
      step_id,
      decision,
    });
  } catch (err) {
    console.error("approval-decision fatal error:", err);
    return jsonError("approval-decision-failed", 500, err);
  }
});

// ------------------------------------------------------------
// Load Approval
// ------------------------------------------------------------

async function loadApproval(approvalId: string) {
  const { data } = await supabase
    .from("workflow_approvals")
    .select("*")
    .eq("id", approvalId)
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
