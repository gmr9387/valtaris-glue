import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export interface ApprovalRow {
  id: string;
  run_id: string;
  job_id: string | null;
  dag_node_id: string | null;
  state: "pending" | "approved" | "rejected" | "expired";
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  expires_at: string | null;
  reason: string | null;
}

interface State {
  approvals: ApprovalRow[];
  hydrate: () => Promise<void>;
  subscribe: () => () => void;
  decide: (id: string, decision: "approve" | "reject", reason?: string) => Promise<void>;
}

export const useApprovals = create<State>((set, get) => ({
  approvals: [],
  hydrate: async () => {
    const { data } = await supabase
      .from("workflow_approvals")
      .select("*")
      .order("requested_at", { ascending: false })
      .limit(50);
    set({ approvals: (data ?? []) as ApprovalRow[] });
  },
  subscribe: () => {
    const ch = supabase
      .channel("approvals_stream")
      .on("postgres_changes", { event: "*", schema: "glue", table: "workflow_approvals" }, () => {
        get().hydrate();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  },
  decide: async (id, decision, reason) => {
    // Operator identity is derived from the caller's JWT by the edge function.
    await supabase.functions.invoke("approval-decision", {
      body: { approval_id: id, decision, reason },
    });
    await get().hydrate();
  },
}));
