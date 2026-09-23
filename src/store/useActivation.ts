import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export interface WebhookEndpoint {
  id: string;
  endpoint_key: string;
  source: string;
  dag_id: string;
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

interface ActivationState {
  endpoints: WebhookEndpoint[];
  deliveries: WebhookDelivery[];
  schedules: WorkflowSchedule[];
  activations: TriggerActivation[];
  loading: boolean;
  hydrate: () => Promise<void>;
  subscribe: () => () => void;
  toggleEndpoint: (id: string, paused: boolean) => Promise<void>;
  setScheduleState: (id: string, state: "active" | "paused") => Promise<void>;
  replayDelivery: (id: string) => Promise<void>;
  tickScheduler: () => Promise<void>;
}

export const useActivation = create<ActivationState>((set, get) => ({
  endpoints: [],
  deliveries: [],
  schedules: [],
  activations: [],
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    const [eps, dels, scheds, acts] = await Promise.all([
      supabase.from("webhook_endpoints").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("webhook_deliveries").select("*").order("received_at", { ascending: false }).limit(50),
      supabase.from("workflow_schedules").select("*").order("next_run_at", { ascending: true }).limit(50),
      supabase.from("trigger_activations").select("*").order("fired_at", { ascending: false }).limit(50),
    ]);
    set({
      endpoints: (eps.data ?? []) as WebhookEndpoint[],
      deliveries: (dels.data ?? []) as WebhookDelivery[],
      schedules: (scheds.data ?? []) as WorkflowSchedule[],
      activations: (acts.data ?? []) as TriggerActivation[],
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
}));
