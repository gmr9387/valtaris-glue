import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export interface ConnectorState {
  id: string;
  connector: string;
  status: "healthy" | "degraded" | "retrying" | "down" | string;
  latency_ms: number | null;
  failure_rate: number;
  quota_used: number;
  quota_limit: number;
  backoff_until: string | null;
  last_success_at: string | null;
  last_error: string | null;
  updated_at: string;
}

interface ConnectorStateStore {
  connectors: ConnectorState[];
  connected: boolean;
  hydrate: () => Promise<void>;
  subscribe: () => () => void;
}

function upsert(list: ConnectorState[], next: ConnectorState): ConnectorState[] {
  const idx = list.findIndex((c) => c.id === next.id);
  if (idx === -1) return [...list, next];
  const copy = list.slice();
  copy[idx] = { ...copy[idx], ...next };
  return copy;
}

export const useConnectorState = create<ConnectorStateStore>((set, get) => ({
  connectors: [],
  connected: false,

  hydrate: async () => {
    const { data } = await supabase
      .from("connector_state")
      .select("*")
      .order("connector", { ascending: true });
    set({ connectors: (data ?? []) as unknown as ConnectorState[] });
  },

  subscribe: () => {
    const channel = supabase
      .channel("connector_state_stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "glue", table: "connector_state" },
        (payload) => {
          const row = payload.new as unknown as ConnectorState | undefined;
          if (!row) return;
          set({ connectors: upsert(get().connectors, row) });
        }
      )
      .subscribe((status) => set({ connected: status === "SUBSCRIBED" }));
    return () => {
      supabase.removeChannel(channel);
      set({ connected: false });
    };
  },
}));
