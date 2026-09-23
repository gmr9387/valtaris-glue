import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { WorkflowEvent } from "@/runtime/types";
import { recentEvents } from "@/runtime/telemetry";

interface TelemetryStreamState {
  events: WorkflowEvent[];
  connected: boolean;
  hydrate: () => Promise<void>;
  subscribe: () => () => void;
  clear: () => void;
}

const MAX = 200;

export const useTelemetryStream = create<TelemetryStreamState>((set, get) => ({
  events: [],
  connected: false,

  hydrate: async () => {
    try {
      const evts = await recentEvents(100);
      set({ events: evts });
    } catch (e) {
      console.error("[telemetry] hydrate failed", e);
    }
  },

  subscribe: () => {
    const channel = supabase
      .channel("workflow_events_stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "glue", table: "workflow_events" },
        (payload) => {
          const evt = payload.new as unknown as WorkflowEvent;
          const next = [evt, ...get().events].slice(0, MAX);
          set({ events: next });
        }
      )
      .subscribe((status) => {
        set({ connected: status === "SUBSCRIBED" });
      });

    return () => {
      supabase.removeChannel(channel);
      set({ connected: false });
    };
  },

  clear: () => set({ events: [] }),
}));
