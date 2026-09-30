# Connector Adapters

## Purpose
Abstract third-party APIs behind a uniform `ConnectorAdapter` contract so the worker treats every step identically.

## Contract
`supabase/functions/_shared/connectors.ts`:
```ts
interface ConnectorAdapter {
  name: string;
  execute(action: string, input: Record<string, unknown>,
          opts?: { timeoutMs?: number; idempotencyKey?: string }): Promise<ConnectorResult>;
}

interface ConnectorResult {
  ok: boolean;
  output?: unknown;
  error?: ConnectorError;
  latency_ms: number;
  http_status?: number;
}

interface ConnectorError {
  kind: 'timeout' | 'auth' | 'rate_limit' | 'server' | 'client' | 'unknown';
  message: string;
  retryable: boolean;
}
```

## Implemented adapters
| Connector | Status | Notes |
|---|---|---|
| Stripe | Real | Requires `STRIPE_SECRET_KEY`. Customer + Charge + Refund. |
| OpenAI | Real | Routes through Lovable AI Gateway (no key needed). |
| SendGrid | Real | Requires `SENDGRID_API_KEY`. |
| Slack | Partial | Webhook post supported; OAuth scope flows not. |
| Twilio | Partial | SMS send supported. |
| Salesforce | Partial | Read flows supported, write flows mocked. |
| ServiceNow | Real | Requires `SERVICENOW_INSTANCE_URL`/`SERVICENOW_CLIENT_ID`/`SERVICENOW_CLIENT_SECRET`. Table API: createRecord/updateRecord/getRecord against any table. |

## Mock mode
If the connector secret is missing, the adapter returns a synthesized
`ConnectorResult` with realistic latency and a deterministic `output`. This
keeps the runtime exercisable in development without leaking placeholder
credentials.

## Telemetry contribution
Each `ConnectorResult` updates:
- `connector_state.latency_ms`, `.last_success_at`, `.failure_rate`, `.last_error`
- `workflow_step_runs.connector_response`, `.duration_ms`
- `workflow_incidents` opened on sustained failure (managed by `tick-connectors`)

## Known limitations
- No circuit breaker; backoff is per-step, not per-connector.
- No quota negotiation; `quota_used` is incremented but not enforced at claim time.
- No streaming response support (OpenAI streaming returns are buffered).
