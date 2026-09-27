// Operational control plane — identity-bound.
// All actions require an authenticated caller; admin-only actions are gated
// by SQL functions that validate tenant_members.role = 'admin'.

import { requireUser, serviceClient, logSecurity } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const j = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function kickWorker() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${url}/functions/v1/run-worker`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: "{}",
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const auth = await requireUser(req);
  if (!auth.ok) return j({ error: auth.error }, auth.status);
  const operator_uid = auth.ctx.userId;
  const sb = serviceClient();

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    if (!action) return j({ error: "action required" }, 400);

    switch (action) {
      case "drain_worker": {
        if (!body.worker_id) return j({ error: "worker_id required" }, 400);
        const { error } = await sb.rpc("drain_worker", {
          _worker_id: body.worker_id,
          _operator_uid: operator_uid,
        });
        if (error) return j({ error: error.message }, 403);
        return j({ ok: true });
      }
      case "pause_partition":
      case "resume_partition": {
        if (!body.partition_key) return j({ error: "partition_key required" }, 400);
        const { error } = await sb.rpc("pause_partition", {
          _partition_key: body.partition_key,
          _paused: action === "pause_partition",
          _operator_uid: operator_uid,
        });
        if (error) return j({ error: error.message }, 403);
        return j({ ok: true });
      }
      case "reconcile": {
        const { data } = await sb.rpc("reconcile_orphans", { _worker_stale_seconds: 180 });
        await logSecurity({
          actor_user_id: operator_uid,
          category: "operator.action",
          subject_type: "runtime",
          message: "reconcile_orphans invoked",
          details: { result: data?.[0] ?? null },
        });
        return j({ ok: true, result: data?.[0] ?? null });
      }
      case "archive_events": {
        const minutes = Number(body.older_than_minutes ?? 1440);
        const { data } = await sb.rpc("archive_old_events", { _older_than_minutes: minutes });
        return j({ ok: true, archived: data?.[0]?.archived ?? 0 });
      }
      case "aggregate": {
        await sb.rpc("aggregate_telemetry");
        return j({ ok: true });
      }
      case "health": {
        const { data } = await sb.rpc("runtime_health_report");
        return j({ ok: true, report: data });
      }
      case "throttle_connector": {
        const { connector, max_concurrency } = body;
        if (!connector || typeof max_concurrency !== "number") {
          return j({ error: "connector + max_concurrency required" }, 400);
        }
        // Admin-only — check via tenant_members.
        const { data: isAdmin } = await sb
          .from("tenant_members")
          .select("user_id")
          .eq("user_id", operator_uid)
          .eq("role", "admin")
          .maybeSingle();
        if (!isAdmin) {
          await logSecurity({
            actor_user_id: operator_uid,
            category: "authz.denied",
            severity: "warn",
            subject_type: "connector",
            subject_id: connector,
            message: "throttle_connector denied: admin required",
          });
          return j({ error: "admin role required" }, 403);
        }
        const key = `connector:${connector}`;
        await sb.from("queue_partitions").upsert(
          { partition_key: key, max_concurrency, description: `Connector throttle for ${connector}` },
          { onConflict: "partition_key" },
        );
        await sb.from("runtime_audit_log").insert({
          actor: operator_uid, action: "connector.throttle",
          subject_type: "connector", subject_id: connector, details: { max_concurrency },
        });
        await logSecurity({
          actor_user_id: operator_uid,
          category: "operator.action",
          subject_type: "connector",
          subject_id: connector,
          message: "connector throttled",
          details: { max_concurrency },
        });
        return j({ ok: true });
      }
      case "replay_dead_letter": {
        // Fixed 2026-09-17: this update previously targeted
        // retry_attempt/backoff_until/scheduled_at, none of which exist
        // on workflow_jobs (confirmed via information_schema.columns) --
        // every real replay attempt was failing. The real retry model
        // (see sweep_stale_jobs) is state/retry_count/lease_expires_at.
        const { job_id } = body;
        if (!job_id) return j({ error: "job_id required" }, 400);
        const { data: job } = await sb.from("workflow_jobs").select("*").eq("id", job_id).single();
        if (!job) return j({ error: "job not found" }, 404);

        // Tenant authorization: caller must be operator on the job's tenant.
        const { data: allowed } = await sb.rpc("has_operator_role", {
          _uid: operator_uid, _tenant_id: job.tenant_id, _required: "operator",
        });
        if (!allowed) {
          await logSecurity({
            tenant_id: job.tenant_id,
            actor_user_id: operator_uid,
            category: "authz.denied",
            severity: "warn",
            subject_type: "job",
            subject_id: job_id,
            message: "replay_dead_letter denied",
          });
          return j({ error: "operator role required" }, 403);
        }

        await sb.from("workflow_jobs").update({
          state: "pending", retry_count: 0, error: null,
          claimed_by: null, worker_id: null, claimed_at: null,
          lease_expires_at: null, started_at: null, completed_at: null,
          updated_at: new Date().toISOString(),
        }).eq("id", job_id);
        await sb.from("runtime_audit_log").insert({
          tenant_id: job.tenant_id, actor: operator_uid, action: "deadletter.replay",
          subject_type: "job", subject_id: job_id, details: { run_id: job.run_id },
        });
        await logSecurity({
          tenant_id: job.tenant_id,
          actor_user_id: operator_uid,
          category: "operator.action",
          subject_type: "job",
          subject_id: job_id,
          message: "dead-letter job re-queued",
        });
        kickWorker();
        return j({ ok: true });
      }
      case "pause_webhook":
      case "resume_webhook": {
        if (!body.endpoint_id) return j({ error: "endpoint_id required" }, 400);
        const { error } = await sb.rpc("pause_webhook", {
          _endpoint_id: body.endpoint_id, _paused: action === "pause_webhook",
          _operator_uid: operator_uid,
        });
        if (error) return j({ error: error.message }, 403);
        return j({ ok: true });
      }
      case "set_schedule_state": {
        if (!body.schedule_id || !body.state) return j({ error: "schedule_id + state required" }, 400);
        const { error } = await sb.rpc("set_schedule_state", {
          _schedule_id: body.schedule_id, _state: body.state, _operator_uid: operator_uid,
        });
        if (error) return j({ error: error.message }, 403);
        return j({ ok: true });
      }
      case "replay_webhook_delivery": {
        if (!body.delivery_id) return j({ error: "delivery_id required" }, 400);
        const { data: del } = await sb.from("webhook_deliveries").select("*").eq("id", body.delivery_id).maybeSingle();
        if (!del) return j({ error: "delivery not found" }, 404);
        const { data: allowed } = await sb.rpc("has_operator_role", {
          _uid: operator_uid, _tenant_id: del.tenant_id, _required: "operator",
        });
        if (!allowed) return j({ error: "operator role required" }, 403);
        const { data: ep } = await sb.from("webhook_endpoints").select("*").eq("id", del.endpoint_id).maybeSingle();
        if (!ep) return j({ error: "endpoint missing" }, 404);
        // Re-enqueue (mirrors webhook-ingress enqueue path).
        const { enqueueFromTrigger } = await import("../_shared/triggers.ts");
        const correlation_id = crypto.randomUUID();
        const result = await enqueueFromTrigger(sb, {
          tenant_id: del.tenant_id, workflow_version_id: ep.workflow_version_id, dag_id: ep.dag_id,
          payload: { event: del.body, headers: del.headers, source: ep.source, endpoint_key: ep.endpoint_key, replayed_from: del.id },
          correlation_id,
          workflow_name: `webhook-replay:${ep.endpoint_key}`,
          trigger_kind: "webhook", source_label: `${ep.endpoint_key}:replay`,
        });
        if (!result.ok) return j({ error: result.error ?? "enqueue failed" }, 500);
        await sb.from("webhook_deliveries").insert({
          tenant_id: del.tenant_id, endpoint_id: del.endpoint_id, headers: del.headers,
          body: del.body, raw_body: del.raw_body, signature_valid: true,
          status: "enqueued", run_id: result.run_id, correlation_id,
        });
        await sb.from("runtime_audit_log").insert({
          tenant_id: del.tenant_id, actor: operator_uid, action: "webhook.replay",
          subject_type: "webhook_delivery", subject_id: body.delivery_id,
          details: { run_id: result.run_id },
        });
        return j({ ok: true, run_id: result.run_id });
      }

      case "list_workflow_versions": {
        // workflow_versions has zero RLS policies (service-role-only by
        // design), so the picker UI reads it through here rather than
        // directly from the client.
        if (!body.tenant_id) return j({ error: "tenant_id required" }, 400);
        const { data: allowed } = await sb.rpc("has_operator_role", {
          _uid: operator_uid, _tenant_id: body.tenant_id, _required: "operator",
        });
        if (!allowed) return j({ error: "operator role required" }, 403);
        const { data, error } = await sb.from("workflow_versions")
          .select("id, state, metadata, created_at")
          .eq("tenant_id", body.tenant_id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return j({ error: error.message }, 500);
        return j({ ok: true, versions: data ?? [] });
      }

      case "list_event_triggers": {
        // runtime_triggers has zero RLS policies at all (not even
        // SELECT), so it's read through here rather than directly.
        if (!body.tenant_id) return j({ error: "tenant_id required" }, 400);
        const { data: allowed } = await sb.rpc("has_operator_role", {
          _uid: operator_uid, _tenant_id: body.tenant_id, _required: "operator",
        });
        if (!allowed) return j({ error: "operator role required" }, 403);
        const { data, error } = await sb.from("runtime_triggers")
          .select("*")
          .eq("tenant_id", body.tenant_id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return j({ error: error.message }, 500);
        return j({ ok: true, triggers: data ?? [] });
      }

      case "create_webhook_endpoint": {
        const { tenant_id, endpoint_key, source, workflow_version_id, dag_id, signing_secret } = body;
        if (!tenant_id || !endpoint_key || !workflow_version_id) {
          return j({ error: "tenant_id, endpoint_key, and workflow_version_id required" }, 400);
        }
        const { data: allowed } = await sb.rpc("has_operator_role", {
          _uid: operator_uid, _tenant_id: tenant_id, _required: "operator",
        });
        if (!allowed) return j({ error: "operator role required" }, 403);
        const { data: version } = await sb.from("workflow_versions")
          .select("id").eq("id", workflow_version_id).eq("tenant_id", tenant_id).maybeSingle();
        if (!version) return j({ error: "workflow_version not found for this tenant" }, 400);
        const { data: row, error } = await sb.from("webhook_endpoints").insert({
          tenant_id, endpoint_key, source: source || "webhook",
          workflow_version_id, dag_id: dag_id || endpoint_key,
          signing_secret: signing_secret || null,
        }).select().single();
        if (error) return j({ error: error.message }, 500);
        await logSecurity({
          tenant_id, actor_user_id: operator_uid, category: "operator.action",
          subject_type: "webhook_endpoint", subject_id: row.id, message: "webhook endpoint created",
        });
        return j({ ok: true, endpoint: row });
      }

      case "create_schedule": {
        const { tenant_id, name, workflow_version_id, dag_id, schedule_kind, interval_seconds, cron_expression } = body;
        if (!tenant_id || !name || !workflow_version_id) {
          return j({ error: "tenant_id, name, and workflow_version_id required" }, 400);
        }
        const kind = schedule_kind === "cron" ? "cron" : "interval";
        if (kind === "cron" && !cron_expression) {
          return j({ error: "cron_expression required for cron schedules" }, 400);
        }
        const { data: allowed } = await sb.rpc("has_operator_role", {
          _uid: operator_uid, _tenant_id: tenant_id, _required: "operator",
        });
        if (!allowed) return j({ error: "operator role required" }, 403);
        const { data: version } = await sb.from("workflow_versions")
          .select("id").eq("id", workflow_version_id).eq("tenant_id", tenant_id).maybeSingle();
        if (!version) return j({ error: "workflow_version not found for this tenant" }, 400);
        const { data: row, error } = await sb.from("workflow_schedules").insert({
          tenant_id, name, workflow_version_id, dag_id: dag_id || name,
          schedule_kind: kind,
          interval_seconds: kind === "interval" ? (Number(interval_seconds) || 60) : null,
          cron_expression: kind === "cron" ? cron_expression : null,
          next_run_at: new Date().toISOString(),
        }).select().single();
        if (error) return j({ error: error.message }, 500);
        await logSecurity({
          tenant_id, actor_user_id: operator_uid, category: "operator.action",
          subject_type: "workflow_schedule", subject_id: row.id, message: "schedule created",
        });
        return j({ ok: true, schedule: row });
      }

      case "create_event_trigger": {
        const { tenant_id, name, source_event_type, workflow_version_id, dag_id, condition, cooldown_seconds, max_depth } = body;
        if (!tenant_id || !name || !source_event_type || !workflow_version_id) {
          return j({ error: "tenant_id, name, source_event_type, and workflow_version_id required" }, 400);
        }
        const { data: allowed } = await sb.rpc("has_operator_role", {
          _uid: operator_uid, _tenant_id: tenant_id, _required: "operator",
        });
        if (!allowed) return j({ error: "operator role required" }, 403);
        const { data: version } = await sb.from("workflow_versions")
          .select("id").eq("id", workflow_version_id).eq("tenant_id", tenant_id).maybeSingle();
        if (!version) return j({ error: "workflow_version not found for this tenant" }, 400);
        const { data: row, error } = await sb.from("runtime_triggers").insert({
          tenant_id, name, source_event_type, workflow_version_id, dag_id: dag_id || name,
          condition: condition ?? {},
          cooldown_seconds: Number(cooldown_seconds) || 0,
          max_depth: Number(max_depth) || 5,
        }).select().single();
        if (error) return j({ error: error.message }, 500);
        await logSecurity({
          tenant_id, actor_user_id: operator_uid, category: "operator.action",
          subject_type: "runtime_trigger", subject_id: row.id, message: "event trigger created",
        });
        return j({ ok: true, trigger: row });
      }

      default:
        return j({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
