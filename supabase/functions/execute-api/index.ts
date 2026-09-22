import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_SERVICES: Record<string, string[]> = {
  stripe: ["charge", "refund", "createCustomer"],
  openai: ["generateText", "generateImage"],
  sendgrid: ["sendEmail"],
  twilio: ["sendMessage"],
  nucleus: ["adjudicateClaim", "scoreOpportunity", "scoreRecommendation", "guardianStatus"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { service, action, data, user_id } = await req.json();

    if (!service || !action) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing "service" or "action"' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validActions = VALID_SERVICES[service];
    if (!validActions) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown service "${service}". Available: ${Object.keys(VALID_SERVICES).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown action "${action}" for ${service}. Available: ${validActions.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const start = Date.now();
    const isMock = !hasCredentials(service);
    let result: Record<string, unknown>;

    if (isMock) {
      console.log(`[execute-api] MOCK mode for ${service}.${action}`);
      result = { success: true, data: getMockResponse(service, action, data || {}), mock: true };
    } else {
      console.log(`[execute-api] LIVE mode for ${service}.${action}`);
      result = await executeAction(service, action, data || {});
    }

    const durationMs = Date.now() - start;

    // Log to database (fire-and-forget)
    logExecution(service, action, data || {}, result, isMock, durationMs, user_id ?? null).catch((e) =>
      console.error("[execute-api] Log failed:", e.message)
    );

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[execute-api] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── LOGGING ─────────────────────────────────────────────
async function logExecution(
  service: string,
  action: string,
  requestData: Record<string, unknown>,
  result: Record<string, unknown>,
  mock: boolean,
  durationMs: number,
  userId: string | null
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;

  const sb = createClient(supabaseUrl, serviceKey);
  await sb.from("api_requests").insert({
    service,
    action,
    request_data: requestData,
    response_data: result,
    success: !!result.success,
    mock,
    duration_ms: durationMs,
    user_id: userId,
  });
}

// ─── CREDENTIAL DETECTION ────────────────────────────────
function hasCredentials(service: string): boolean {
  switch (service) {
    case "stripe": return !!Deno.env.get("STRIPE_KEY");
    case "openai": return !!Deno.env.get("OPENAI_KEY");
    case "sendgrid": return !!Deno.env.get("SENDGRID_KEY");
    case "twilio": return !!Deno.env.get("TWILIO_SID") && !!Deno.env.get("TWILIO_TOKEN") && !!Deno.env.get("TWILIO_PHONE");
    case "nucleus": return !!Deno.env.get("NUCLEUS_API_KEY");
    default: return false;
  }
}

// ─── MOCK RESPONSES ─────────────────────────────────────
function getMockResponse(service: string, action: string, data: Record<string, unknown>): Record<string, unknown> {
  const mocks: Record<string, Record<string, (d: Record<string, unknown>) => Record<string, unknown>>> = {
    stripe: {
      charge: (d) => ({ id: "ch_mock_" + Date.now(), amount: d.amount || 1000, currency: d.currency || "usd", status: "succeeded" }),
      refund: (d) => ({ id: "re_mock_" + Date.now(), amount: d.amount || 1000, status: "succeeded" }),
      createCustomer: (d) => ({ id: "cus_mock_" + Date.now(), email: d.email || "mock@example.com", name: d.name || null }),
    },
    openai: {
      generateText: (d) => ({ text: `This is a mock AI-generated response based on: "${d.prompt || "no prompt"}"`, model: "gpt-4o-mini-mock", usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 } }),
      generateImage: (d) => ({ url: "https://via.placeholder.com/512x512.png?text=Mock+Image", revisedPrompt: d.prompt || "mock prompt" }),
    },
    sendgrid: {
      sendEmail: (d) => ({ sent: true, message: "Mock email sent successfully", to: d.to || "mock@example.com" }),
    },
    twilio: {
      sendMessage: (d) => ({ sid: "SM_mock_" + Date.now(), status: "sent", to: d.to || "+10000000000", body: d.body || "" }),
    },
    nucleus: {
      adjudicateClaim: (d) => ({
        decision: "allow",
        reason: "Mock adjudication — no contract lookup performed",
        adjudication: { status: "mock", allowed: d.billed_amount_cents || 0, plan_paid: 0, member_responsibility: 0, deductible_applied: 0, coinsurance: 0 },
        risk_tier: "low",
        used_empty_accumulators: true,
        contract_id: null,
        plan_id: null,
        timestamp: new Date().toISOString(),
      }),
      scoreOpportunity: () => ({ stage: "opportunity", score: 0, fired_rules: [], claim_id: null, timestamp: new Date().toISOString() }),
      scoreRecommendation: () => ({ stage: "recommendation", confidence: 0, action: "review", fired_rules: [], claim_id: null, timestamp: new Date().toISOString() }),
      guardianStatus: () => ({ safe_to_process: true, kill_switch_active: false, reason: null, activated_by: null, kill_switch_updated_at: null, timestamp: new Date().toISOString() }),
    },
  };
  return mocks[service]?.[action]?.(data) ?? { message: "Mock response" };
}

// ─── LIVE EXECUTION ──────────────────────────────────────
function getEnvOrThrow(name: string): string {
  const val = Deno.env.get(name);
  if (!val) throw new Error(`Server secret "${name}" is not configured.`);
  return val;
}

async function executeAction(service: string, action: string, data: Record<string, unknown>) {
  switch (service) {
    case "stripe": return executeStripe(action, data);
    case "openai": return executeOpenAI(action, data);
    case "sendgrid": return executeSendGrid(action, data);
    case "twilio": return executeTwilio(action, data);
    case "nucleus": return executeNucleus(action, data);
    default: return { success: false, error: `Unhandled service: ${service}` };
  }
}

async function executeStripe(action: string, data: Record<string, unknown>) {
  const key = getEnvOrThrow("STRIPE_KEY");
  const baseUrl = "https://api.stripe.com/v1";
  const endpoints: Record<string, string> = { charge: `${baseUrl}/charges`, refund: `${baseUrl}/refunds`, createCustomer: `${baseUrl}/customers` };
  const inputMappers: Record<string, (d: Record<string, unknown>) => Record<string, string>> = {
    charge: (d) => ({ amount: String(d.amount || ""), currency: String(d.currency || "usd"), source: String(d.source || ""), ...(d.description ? { description: String(d.description) } : {}) }),
    refund: (d) => ({ charge: String(d.chargeId || ""), ...(d.amount ? { amount: String(d.amount) } : {}) }),
    createCustomer: (d) => ({ email: String(d.email || ""), ...(d.name ? { name: String(d.name) } : {}), ...(d.description ? { description: String(d.description) } : {}) }),
  };
  const mapped = inputMappers[action](data);
  const resp = await fetch(endpoints[action], { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(mapped) });
  const body = await resp.json();
  if (!resp.ok) return { success: false, error: `Stripe ${action} failed [${resp.status}]: ${body?.error?.message || JSON.stringify(body)}` };
  const outputMappers: Record<string, (r: Record<string, unknown>) => Record<string, unknown>> = {
    charge: (r) => ({ id: r.id, amount: r.amount, status: r.status, currency: r.currency }),
    refund: (r) => ({ id: r.id, amount: r.amount, status: r.status }),
    createCustomer: (r) => ({ id: r.id, email: r.email, name: r.name }),
  };
  return { success: true, data: outputMappers[action](body) };
}

async function executeOpenAI(action: string, data: Record<string, unknown>) {
  const key = getEnvOrThrow("OPENAI_KEY");
  const baseUrl = "https://api.openai.com/v1";
  if (action === "generateText") {
    const resp = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: data.model || "gpt-4o-mini", messages: [{ role: "user", content: data.prompt }], max_tokens: data.maxTokens || 1000, temperature: data.temperature ?? 0.7 }) });
    const body = await resp.json();
    if (!resp.ok) return { success: false, error: `OpenAI error [${resp.status}]: ${body?.error?.message || JSON.stringify(body)}` };
    return { success: true, data: { text: body.choices?.[0]?.message?.content, model: body.model, usage: body.usage } };
  }
  if (action === "generateImage") {
    const resp = await fetch(`${baseUrl}/images/generations`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "dall-e-3", prompt: data.prompt, n: 1, size: data.size || "1024x1024" }) });
    const body = await resp.json();
    if (!resp.ok) return { success: false, error: `OpenAI error [${resp.status}]: ${body?.error?.message || JSON.stringify(body)}` };
    return { success: true, data: { url: body.data?.[0]?.url, revisedPrompt: body.data?.[0]?.revised_prompt } };
  }
  return { success: false, error: `Unknown OpenAI action: ${action}` };
}

async function executeSendGrid(action: string, data: Record<string, unknown>) {
  const key = getEnvOrThrow("SENDGRID_KEY");
  if (action === "sendEmail") {
    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: data.to }], subject: data.subject }], from: { email: data.from }, content: [{ type: data.html ? "text/html" : "text/plain", value: data.body || data.html || data.text }] }) });
    if (!resp.ok) { const body = await resp.text(); return { success: false, error: `SendGrid error [${resp.status}]: ${body}` }; }
    return { success: true, data: { sent: true } };
  }
  return { success: false, error: `Unknown SendGrid action: ${action}` };
}

async function executeTwilio(action: string, data: Record<string, unknown>) {
  const sid = getEnvOrThrow("TWILIO_SID");
  const token = getEnvOrThrow("TWILIO_TOKEN");
  const phoneNumber = getEnvOrThrow("TWILIO_PHONE");
  if (action === "sendMessage") {
    const encoded = btoa(`${sid}:${token}`);
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${encoded}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ To: String(data.to || ""), From: String(data.from || phoneNumber), Body: String(data.body || "") }) });
    const body = await resp.json();
    if (!resp.ok) return { success: false, error: `Twilio error [${resp.status}]: ${body?.message || JSON.stringify(body)}` };
    return { success: true, data: { sid: body.sid, status: body.status, to: body.to, body: body.body } };
  }
  return { success: false, error: `Unknown Twilio action: ${action}` };
}

// nucleus base URLs are not secret — only the x-api-key credential is.
// Points at valtaris-nucleus-2 (qrqekucwdfyqqzomuble) -- the old nucleus
// project (bpqukcsaoporhvdtfyza) is paused/superseded.
const NUCLEUS_BASE_URL = "https://qrqekucwdfyqqzomuble.supabase.co/functions/v1";

async function executeNucleus(action: string, data: Record<string, unknown>) {
  const key = getEnvOrThrow("NUCLEUS_API_KEY");

  if (action === "guardianStatus") {
    const resp = await fetch(`${NUCLEUS_BASE_URL}/guardian-status`, {
      method: "GET",
      headers: { "x-api-key": key },
    });
    const body = await resp.json();
    if (!resp.ok) return { success: false, error: `Nucleus guardian-status error [${resp.status}]: ${body?.reason || JSON.stringify(body)}` };
    return { success: true, data: body };
  }

  if (action === "adjudicateClaim") {
    const resp = await fetch(`${NUCLEUS_BASE_URL}/adjudicate-claim`, {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await resp.json();
    if (!resp.ok) return { success: false, error: `Nucleus adjudicate-claim error [${resp.status}]: ${body?.reason || JSON.stringify(body)}` };
    return { success: true, data: body };
  }

  if (action === "scoreOpportunity" || action === "scoreRecommendation") {
    const stage = action === "scoreOpportunity" ? "opportunity" : "recommendation";
    const resp = await fetch(`${NUCLEUS_BASE_URL}/weaver-score`, {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ stage, claim_id: data.claim_id ?? data.claimId, facts: data.facts ?? {} }),
    });
    const body = await resp.json();
    if (!resp.ok) return { success: false, error: `Nucleus weaver-score error [${resp.status}]: ${body?.reason || JSON.stringify(body)}` };
    return { success: true, data: body };
  }

  return { success: false, error: `Unknown Nucleus action: ${action}` };
}
