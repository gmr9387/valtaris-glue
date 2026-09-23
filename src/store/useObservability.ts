import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export interface SlaBreachRow {
  id: string;
  run_id: string | null;
  scope: string;
  target: string;
  observed_ms: number;
  budget_ms: number;
  severity: string;
  detected_at: string;
  resolved_at: string | null;
}

export interface HeartbeatRow {
  worker_id: string;
  last_seen_at: string;
  jobs_processed: number;
  status: string;
}

interface State {
  breaches: SlaBreachRow[];
  heartbeats: HeartbeatRow[];
  queueDepth: number;
  hydrate: () => Promise<void>;
  subscribe: () => () => void;
}

export const useObservability = create<State>((set) => ({
  breaches: [],
  heartbeats: [],
  queueDepth: 0,
  hydrate: async () => {
    const [b, h, q] = await Promise.all([
      supabase.from("sla_breaches").select("*").order("detected_at", { ascending: false }).limit(20),
      supabase.from("worker_heartbeats").select("*").order("last_seen_at", { ascending: false }).limit(10),
      supabase.from("workflow_jobs").select("id", { count: "exact", head: true })
        .in("state", ["queued", "retrying", "delayed", "claimed", "running"]),
    ]);
    set({
      breaches: (b.data ?? []) as SlaBreachRow[],
      heartbeats: (h.data ?? []) as HeartbeatRow[],
      queueDepth: q.count ?? 0,
    });
  },
  subscribe: () => {
    const ch = supabase
      .channel("observability_stream")
      .on("postgres_changes", { event: "*", schema: "glue", table: "sla_breaches" }, () => useObservability.getState().hydrate())
      .on("postgres_changes", { event: "*", schema: "glue", table: "worker_heartbeats" }, () => useObservability.getState().hydrate())
      .on("postgres_changes", { event: "*", schema: "glue", table: "workflow_jobs" }, () => useObservability.getState().hydrate())
      .subscribe();
    const iv = setInterval(() => useObservability.getState().hydrate(), 15_000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  },
}));
