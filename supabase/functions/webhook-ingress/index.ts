// Webhook ingress endpoint.
// URL pattern: /functions/v1/webhook-ingress/<endpoint_key>
// Public (verify_jwt = false) — caller authorizes via the endpoint's signing
// secret. All ingress is persisted to webhook_deliveries; duplicates are
// suppressed via the unique index on (endpoint_id, idempotency_key).

import { svc, enqueueFromTrigger, hmacSha256Hex, timingSafeEqual } from "../_shared/triggers.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function extractKey(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  // /functions/v1/webhook-ingress/<key>
  const i = parts.indexOf("webhook-ingress");
  return i >= 0 && parts[i + 1] ? parts[i + 1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ error: "method not allowed" }, 405);

  const sb = svc();
  const url = new URL(req.url);
  const endpoint_key = extractKey(url);
  if (!endpoint_key) return j({ error: "endpoint key missing" }, 404);

  const { data: endpoint } = await sb.from("webhook_endpoints").select("*").eq("endpoint_key", endpoint_key).maybeSingle();
  if (!endpoint) return j({ error: "endpoint not found" }, 404);
  if (!endpoint.active || endpoint.paused) {
    return j({ error: "endpoint disabled" }, 423);
  }

  const raw = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

  let body: Record<string, unknown> = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { /* keep raw only */ }

  // Idempotency: explicit header > body.id > content-hash
  const idem = headers["idempotency-key"]
    || headers["x-idempotency-key"]
    || (typeof body.id === "string" ? `body:${body.id}` : null)
    || `hash:${await hmacSha256Hex("ingress", raw).then((h) => h.slice(0, 32))}`;

  // Signature verification
  let signature_valid: boolean | null = null;
  let signature_error: string | null = null;
  if (endpoint.signing_secret) {
    const sigHeader = (endpoint.signature_header ?? "x-signature").toLowerCase();
    const provided = headers[sigHeader] ?? "";
    if (!provided) {
      signature_valid = false;
      signature_error = "missing signature header";
    } else {
      try {
        const expected = await hmacSha256Hex(endpoint.signing_secret, raw);
        // Accept "sha256=..." or raw hex
        const cleaned = provided.replace(/^sha256=/i, "").trim();
        signature_valid = timingSafeEqual(cleaned, expected);
        if (!signature_valid) signature_error = "signature mismatch";
      } catch (e) {
        signature_valid = false;
        signature_error = e instanceof Error ? e.message : String(e);
      }
    }
  }

  const source_ip = headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? null;
  const correlation_id = crypto.randomUUID();

  // Persist delivery (dedup via unique index)
  const { data: delivery, error: insErr } = await sb.from("webhook_deliveries").insert({
    tenant_id: endpoint.tenant_id,
    endpoint_id: endpoint.id,
    source_ip,
    headers,
    body,
    raw_body: raw,
    idempotency_key: idem,
    signature_valid,
    signature_error,
    status: "pending",
    correlation_id,
  }).select("id").maybeSingle();

  if (insErr) {
    // Duplicate idempotency key
    if (insErr.code === "23505") {
      return j({ ok: true, duplicate: true }, 200);
    }
    return j({ error: insErr.message }, 500);
  }

  const delivery_id = delivery!.id as string;

  if (signature_valid === false) {
    await sb.from("webhook_deliveries").update({ status: "rejected", error: signature_error }).eq("id", delivery_id);
    await sb.from("security_events").insert({
      tenant_id: endpoint.tenant_id,
      category: "ingress.signature_invalid",
      severity: "warn",
      subject_type: "webhook",
      subject_id: endpoint.id,
      message: signature_error ?? "invalid signature",
      details: { endpoint_key, source_ip },
    });
    return j({ error: "invalid signature" }, 401);
  }

  // Enqueue workflow
  const result = await enqueueFromTrigger(sb, {
    tenant_id: endpoint.tenant_id,
    workflow_version_id: endpoint.workflow_version_id,
    dag_id: endpoint.dag_id,
    payload: { event: body, headers, source: endpoint.source, endpoint_key },
    correlation_id,
    workflow_name: `webhook:${endpoint.source}:${endpoint_key}`,
    trigger_kind: "webhook",
    source_label: endpoint_key,
  });

  if (!result.ok) {
    await sb.from("webhook_deliveries").update({
      status: "failed", error: result.error ?? result.suppressed_reason ?? "enqueue failed",
    }).eq("id", delivery_id);
    await sb.from("workflow_incidents").insert({
      tenant_id: endpoint.tenant_id,
      severity: "error",
      category: "ingress_failure",
      summary: `Webhook enqueue failed: ${endpoint_key} — ${result.error ?? result.suppressed_reason}`,
    });
    return j({ error: result.error ?? "enqueue failed" }, 500);
  }

  await sb.from("webhook_deliveries").update({
    status: "enqueued", run_id: result.run_id,
  }).eq("id", delivery_id);

  return j({ ok: true, run_id: result.run_id, correlation_id }, 202);
});
