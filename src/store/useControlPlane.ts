import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export interface WorkerRow {
  worker_id: string;
  region: string;
  capabilities: string[];
  active_jobs: number;
  max_concurrency: number;
  health_state: "active" | "draining" | "offline" | "degraded";
  last_heartbeat: string;
  started_at: string;
}

export interface PartitionRow {
  partition_key: string;
  paused: boolean;
  max_concurrency: number;
  description: string | null;
}

export interface HealthReport {
  workers_active: number;
  workers_draining: number;
  workers_offline: number;
  queue_depth: number;
  in_flight: number;
  dead_letter: number;
  paused_partitions: number;
  open_breaches: number;
  open_incidents: number;
  runs_running: number;
  sampled_at: string;
}

interface State {
  workers: WorkerRow[];
  partitions: PartitionRow[];
  health: HealthReport | null;
  hydrate: () => Promise<void>;
  subscribe: () => () => void;
  drainWorker: (workerId: string) => Promise<void>;
  togglePartition: (key: string, paused: boolean) => Promise<void>;
  reconcile: () => Promise<void>;
  aggregate: () => Promise<void>;
}

export const useControlPlane = create<State>((set, get) => ({
  workers: [],
  partitions: [],
  health: null,

  hydrate: async () => {
    const [w, p, h] = await Promise.all([
      supabase.from("worker_registry").select("*").order("started_at", { ascending: false }),
      supabase.from("queue_partitions").select("*").order("partition_key"),
      supabase.functions.invoke("control-plane", { body: { action: "health" } }),
    ]);
    set({
      workers: (w.data ?? []) as WorkerRow[],
      partitions: (p.data ?? []) as PartitionRow[],
      health: (h.data as { report?: HealthReport } | null)?.report ?? null,
    });
  },

  subscribe: () => {
    const ch = supabase
      .channel("control_plane_stream")
      .on("postgres_changes", { event: "*", schema: "glue", table: "worker_registry" }, () => get().hydrate())
      .on("postgres_changes", { event: "*", schema: "glue", table: "queue_partitions" }, () => get().hydrate())
      .subscribe();
    const iv = setInterval(() => get().hydrate(), 10_000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  },

  drainWorker: async (worker_id) => {
    await supabase.functions.invoke("control-plane", { body: { action: "drain_worker", worker_id } });
    await get().hydrate();
  },
  togglePartition: async (partition_key, paused) => {
    await supabase.functions.invoke("control-plane", {
      body: { action: paused ? "pause_partition" : "resume_partition", partition_key },
    });
    await get().hydrate();
  },
  reconcile: async () => {
    await supabase.functions.invoke("control-plane", { body: { action: "reconcile" } });
    await get().hydrate();
  },
  aggregate: async () => {
    await supabase.functions.invoke("control-plane", { body: { action: "aggregate" } });
    await get().hydrate();
  },
}));
