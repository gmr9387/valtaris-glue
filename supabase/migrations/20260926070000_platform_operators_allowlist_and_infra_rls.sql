-- Resolves the platform-operator decision flagged in
-- 20260926050000_tenant_scoped_select_for_dashboards.sql: worker_registry,
-- queue_partitions, connector_circuit_breakers, and sla_breaches carry
-- no tenant_id -- genuinely cross-tenant infrastructure state (one
-- worker/queue partition/circuit breaker serves many tenants at once).
-- Scoping access to "owner/admin of any tenant" (the guardian_kill_switch
-- pattern) would be wrong here: it would let any customer's own tenant
-- admin see every OTHER tenant's infra load/health, a real cross-tenant
-- leak. Instead: a small, explicit allowlist Glue's own team seeds
-- directly (no self-serve UI, no RLS write path for anyone) -- the
-- simplest thing to fix when someone needs access or is offboarded.
--
-- Already applied and verified live.
CREATE TABLE glue.platform_operators (
  user_id uuid PRIMARY KEY,
  added_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE glue.platform_operators ENABLE ROW LEVEL SECURITY;
-- Deliberately zero policies: only service_role (direct SQL) reads or
-- writes this table. It's consulted as a subquery from other tables'
-- policies, never queried directly by a client.

CREATE POLICY "platform-operator-select-worker-registry" ON glue.worker_registry
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.platform_operators po WHERE po.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "platform-operator-select-queue-partitions" ON glue.queue_partitions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.platform_operators po WHERE po.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "platform-operator-select-connector-circuit-breakers" ON glue.connector_circuit_breakers
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.platform_operators po WHERE po.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "platform-operator-select-sla-breaches" ON glue.sla_breaches
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM glue.platform_operators po WHERE po.user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON glue.worker_registry, glue.queue_partitions,
  glue.connector_circuit_breakers, glue.sla_breaches TO authenticated;
