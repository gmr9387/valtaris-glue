-- Register ServiceNow as a discoverable connector in the marketplace.
-- Adapter implementation: supabase/functions/_shared/connectors.ts (`servicenow`).
-- Generic Table API connector (createRecord/updateRecord/getRecord against
-- any table) -- deliberately table-agnostic, unlike DualPay's purpose-built
-- Scripted REST API integration for one specific record shape. OAuth
-- client-credentials, same SERVICENOW_INSTANCE_URL/CLIENT_ID/CLIENT_SECRET
-- secret names as DualPay's integration so one ServiceNow app registration
-- can serve both.
--
-- NOTE on schema: this repo's older migration history (20260520123805_...)
-- defines connector_catalog/workflow_templates in `public` with a fuller
-- column set (description, auth_model, featured, summary, category_key,
-- tags). That's not what's live -- the Sept 2026 ecosystem consolidation
-- (see README's Data Architecture section) put Glue's actual tables in a
-- `glue` schema on the shared nucleus-2 Supabase project, with a slimmer
-- reconciled column set. This migration targets that live shape.

INSERT INTO glue.connector_catalog (key, name, publisher, category) VALUES
  ('servicenow', 'ServiceNow', 'apiglue', 'support')
ON CONFLICT (key) DO NOTHING;

-- A composable template showing the connector in a real chain: classify an
-- inbound ticket, then open a ServiceNow Case for anything the confidence
-- gate doesn't auto-resolve.
INSERT INTO glue.workflow_templates (key, name) VALUES
  ('support_ticket_to_servicenow', 'AI triage -> ServiceNow case')
ON CONFLICT (key) DO NOTHING;
