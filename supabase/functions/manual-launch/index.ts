// Manual workflow launch — operator-attributed, tenant-scoped, replayable.
// Requires authenticated operator role on the target tenant.

import { requireUser, serviceClient, logSecurity } from "../_shared/auth.ts";
import { enqueueFromTrigger } from "../_shared/triggers.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const auth = await requireUser(req);
  if (!auth.ok) return j({ error: auth.error }, auth.status);
  const operator_uid = auth.ctx.userId;

  const body = await req.json().catch(() => ({}));
  const { tenant_id, dag_id, workflow_version_id, parameters, reason } = body ?? {};
  if (!tenant_id || !dag_id || !workflow_version_id) {
    return j({ error: "tenant_id, dag_id, and workflow_version_id required" }, 400);
  }

  const sb = serviceClient();

  const { data: allowed } = await sb.rpc("has_operator_role", {
    _uid: operator_uid, _tenant_id: tenant_id, _required: "operator",
  });
  if (!allowed) {
    await logSecurity({
      tenant_id, actor_user_id: operator_uid, category: "authz.denied",
      severity: "warn", subject_type: "manual_launch", message: "manual launch denied",
    });
    return j({ error: "operator role required" }, 403);
  }

  const result = await enqueueFromTrigger(sb, {
    tenant_id,
    workflow_version_id,
    dag_id,
    payload: parameters ?? {},
    workflow_name: `manual:${dag_id}`,
    trigger_kind: "manual",
    source_label: operator_uid,
  });
  if (!result.ok) return j({ error: result.error ?? "enqueue failed" }, 500);

  await sb.from("manual_launches").insert({
    tenant_id, operator_user_id: operator_uid, dag_id,
    parameters: parameters ?? {}, run_id: result.run_id, reason: reason ?? null,
  });
  await logSecurity({
    tenant_id, actor_user_id: operator_uid, category: "operator.action",
    subject_type: "manual_launch", subject_id: result.run_id,
    message: "manual workflow launched", details: { dag_id, reason },
  });

  return j({ ok: true, run_id: result.run_id });
});
