import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export interface AiDecision {
  id: string;
  run_id: string | null;
  ts: string;
  model: string | null;
  prompt: string | null;
  decision: string | null;
  confidence: number | null;
  escalated: boolean;
  reasoning: string | null;
  risk: string | null;
}

interface DecisionTraceState {
  decisions: AiDecision[];
  connected: boolean;
  hydrate: () => Promise<void>;
  subscribe: () => () => void;
  override: (id: string, decision: string) => Promise<void>;
}

const MAX = 100;

export const useDecisionTrace = create<DecisionTraceState>((set, get) => ({
  decisions: [],
  connected: false,

  hydrate: async () => {
    const { data } = await supabase
      .from("ai_decision_trace")
      .select("*")
      .order("ts", { ascending: false })
      .limit(MAX);
    set({ decisions: (data ?? []) as unknown as AiDecision[] });
  },

  subscribe: () => {
    const channel = supabase
      .channel("ai_decision_trace_stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "glue", table: "ai_decision_trace" },
        (payload) => {
          const row = payload.new as unknown as AiDecision;
          if (payload.eventType === "INSERT") {
            set({ decisions: [row, ...get().decisions].slice(0, MAX) });
          } else if (payload.eventType === "UPDATE") {
            set({
              decisions: get().decisions.map((d) => (d.id === row.id ? { ...d, ...row } : d)),
            });
          }
        }
      )
      .subscribe((status) => set({ connected: status === "SUBSCRIBED" }));
    return () => {
      supabase.removeChannel(channel);
      set({ connected: false });
    };
  },

  override: async (id, decision) => {
    await supabase
      .from("ai_decision_trace")
      .update({ decision, escalated: false, reasoning: `[human override] ${decision}` } as never)
      .eq("id", id);
  },
}));
