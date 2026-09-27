import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export interface WebhookEndpoint {
  id: string;
  endpoint_key: string;
  source: string;
  dag_id: string;
  workflow_version_id: string | null;
  description: string | null;
  active: boolean;
  paused: boolean;
  tenant_id: string;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  received_at: string;
  status: string;
  signature_valid: boolean | null;
  run_id: string | null;
  error: string | null;
}

export interface WorkflowSchedule {
  id: string;
  name: string;
  dag_id: string;
  workflow_version_id: string | null;
  schedule_kind: string;
  interval_seconds: number | null;
  cron_expression: string | null;
  state: string;
  next_run_at: string;
  last_run_at: string | null;
  consecutive_failures: number;
  tenant_id: string;
}

export interface TriggerActivation {
  id: string;
  trigger_kind: string;
  source_label: string | null;
  depth: number;
  suppressed: boolean;
  suppressed_reason: string | null;
  run_id: string | null;
  fired_at: string;
}

export interface EventTrigger {
  id: string;
  name: string;
  source_event_type: string;
  dag_id: string;
  workflow_version_id: string | null;
  enabled: boolean;
  cooldown_seconds: number;
  max_depth: number;
  last_fired_at: string | null;
  tenant_id: string;
  created_at: string;
}

export interface WorkflowVersionOption {
  id: string;
  state: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

async function invoke<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("control-plane", { body: { action, ...payload } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

interface ActivationState {
  endpoints: WebhookEndpoint[];
  deliveries: WebhookDelivery[];
  schedules: WorkflowSchedule[];
  activations: TriggerActivation[];
  triggers: EventTrigger[];
  workflowVersions: WorkflowVersionOption[];
  tenantId: string | null;
  loading: boolean;
  hydrate: () => Promise<void>;
  subscribe: () => () => void;
  resolveTenantId: () => Promise<string | null>;
  loadWorkflowVersions: () => Promise<void>;
  toggleEndpoint: (id: string, paused: boolean) => Promise<void>;
  setScheduleState: (id: string, state: "active" | "paused") => Promise<void>;
  replayDelivery: (id: string) => Promise<void>;
  tickScheduler: () => Promise<void>;
  createEndpoint: (args: {
    endpoint_key: string; source?: string; workflow_version_id: string; dag_id?: string; signing_secret?: string;
  }) => Promise<void>;
  createSchedule: (args: {
    name: string; workflow_version_id: string; dag_id?: string;
    schedule_kind: "interval" | "cron"; interval_seconds?: number; cron_expression?: string;
  }) => Promise<void>;
  createEventTrigger: (args: {
    name: string; source_event_type: string; workflow_version_id: string; dag_id?: string;
    cooldown_seconds?: number; max_depth?: number;
  }) => Promise<void>;
}

export const useActivation = create<ActivationState>((set, get) => ({
  endpoints: [],
  deliveries: [],
  schedules: [],
  activations: [],
  triggers: [],
  workflowVersions: [],
  tenantId: null,
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    const tenant_id = await get().resolveTenantId();
    const [eps, dels, scheds, acts, trigs] = await Promise.all([
      supabase.from("webhook_endpoints").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("webhook_deliveries").select("*").order("received_at", { ascending: false }).limit(50),
      supabase.from("workflow_schedules").select("*").order("next_run_at", { ascending: true }).limit(50),
      supabase.from("trigger_activations").select("*").order("fired_at", { ascending: false }).limit(50),
      tenant_id ? invoke<{ ok: boolean; triggers: EventTrigger[] }>("list_event_triggers", { tenant_id }).catch(() => ({ ok: false, triggers: [] })) : Promise.resolve({ ok: false, triggers: [] as EventTrigger[] }),
    ]);
    set({
      endpoints: (eps.data ?? []) as WebhookEndpoint[],
      deliveries: (dels.data ?? []) as WebhookDelivery[],
      schedules: (scheds.data ?? []) as WorkflowSchedule[],
      activations: (acts.data ?? []) as TriggerActivation[],
      triggers: trigs.triggers ?? [],
      loading: false,
    });
  },

  subscribe: () => {
    const ch = supabase
      .channel("activation")
      .on("postgres_changes", { event: "*", schema: "glue", table: "webhook_deliveries" }, () => get().hydrate())
      .on("postgres_changes", { event: "*", schema: "glue", table: "trigger_activations" }, () => get().hydrate())
      .on("postgres_changes", { event: "*", schema: "glue", table: "workflow_schedules" }, () => get().hydrate())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  },

  resolveTenantId: async () => {
    const existing = get().tenantId;
    if (existing) return existing;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data: m } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
    const tenant_id = m?.tenant_id ?? null;
    set({ tenantId: tenant_id });
    return tenant_id;
  },

  loadWorkflowVersions: async () => {
    const tenant_id = await get().resolveTenantId();
    if (!tenant_id) return;
    const result = await invoke<{ ok: boolean; versions: WorkflowVersionOption[] }>("list_workflow_versions", { tenant_id });
    set({ workflowVersions: result.versions ?? [] });
  },

  toggleEndpoint: async (id, paused) => {
    await supabase.functions.invoke("control-plane", {
      body: { action: paused ? "pause_webhook" : "resume_webhook", endpoint_id: id },
    });
    await get().hydrate();
  },

  setScheduleState: async (id, state) => {
    await supabase.functions.invoke("control-plane", {
      body: { action: "set_schedule_state", schedule_id: id, state },
    });
    await get().hydrate();
  },

  replayDelivery: async (id) => {
    await supabase.functions.invoke("control-plane", {
      body: { action: "replay_webhook_delivery", delivery_id: id },
    });
    await get().hydrate();
  },

  tickScheduler: async () => {
    await supabase.functions.invoke("scheduler-tick", { body: {} });
    await get().hydrate();
  },

  createEndpoint: async (args) => {
    const tenant_id = await get().resolveTenantId();
    if (!tenant_id) throw new Error("No tenant membership");
    await invoke("create_webhook_endpoint", { tenant_id, ...args });
    await get().hydrate();
  },

  createSchedule: async (args) => {
    const tenant_id = await get().resolveTenantId();
    if (!tenant_id) throw new Error("No tenant membership");
    await invoke("create_schedule", { tenant_id, ...args });
    await get().hydrate();
  },

  createEventTrigger: async (args) => {
    const tenant_id = await get().resolveTenantId();
    if (!tenant_id) throw new Error("No tenant membership");
    await invoke("create_event_trigger", { tenant_id, ...args });
    await get().hydrate();
  },
}));
