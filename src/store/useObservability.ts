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

/**
 * FIXED: this used to query a "worker_heartbeats" table that never
 * existed anywhere in the schema -- always returned an error, silently
 * swallowed to an empty array. worker_registry already tracks exactly
 * this per-worker state (see worker-health/index.ts's own read of the
 * same table), so this reads that instead of a phantom table.
 */
function mapWorkerRegistryToHeartbeats(
  rows: { worker_id: string; last_heartbeat: string; total_processed: number; health_state: string }[],
): HeartbeatRow[] {
  return rows.map((r) => ({
    worker_id: r.worker_id,
    last_seen_at: r.last_heartbeat,
    jobs_processed: r.total_processed,
    status: r.health_state,
  }));
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
      supabase.from("worker_registry")
        .select("worker_id,last_heartbeat,total_processed,health_state")
        .order("last_heartbeat", { ascending: false }).limit(10),
      supabase.from("workflow_jobs").select("id", { count: "exact", head: true })
        .in("state", ["queued", "retrying", "delayed", "claimed", "running"]),
    ]);
    set({
      breaches: (b.data ?? []) as SlaBreachRow[],
      heartbeats: mapWorkerRegistryToHeartbeats(h.data ?? []),
      queueDepth: q.count ?? 0,
    });
  },
  subscribe: () => {
    const ch = supabase
      .channel("observability_stream")
      .on("postgres_changes", { event: "*", schema: "glue", table: "sla_breaches" }, () => useObservability.getState().hydrate())
      .on("postgres_changes", { event: "*", schema: "glue", table: "worker_registry" }, () => useObservability.getState().hydrate())
      .on("postgres_changes", { event: "*", schema: "glue", table: "workflow_jobs" }, () => useObservability.getState().hydrate())
      .subscribe();
    const iv = setInterval(() => useObservability.getState().hydrate(), 15_000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  },
}));
