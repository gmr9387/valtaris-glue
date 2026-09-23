import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveRuns } from "@/store/useLiveRuns";
import { DEMO_GRAPH, stateTone, type GraphStep } from "@/runtime/orchestration";
import type { RunState, WorkflowStepRun } from "@/runtime/types";
import { Badge } from "@/components/ui/badge";
import { GitBranch, ShieldCheck, RotateCcw, Zap } from "lucide-react";

const TONE_CLASS: Record<string, string> = {
  idle: "border-border bg-muted/20 text-muted-foreground",
  active: "border-primary bg-primary/10 text-foreground animate-pulse",
  ok: "border-success/50 bg-success/10 text-foreground",
  warn: "border-warning/60 bg-warning/10 text-foreground",
  error: "border-destructive bg-destructive/10 text-foreground",
};

function StepNode({ step, state, durationMs }: { step: GraphStep; state?: RunState; durationMs?: number | null }) {
  const tone = stateTone(state);
  return (
    <div className={`relative rounded-md border px-3 py-2.5 min-w-[160px] ${TONE_CLASS[tone]} transition-colors`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{step.connector}</span>
        <div className="flex items-center gap-1">
          {step.approvalRequired && <ShieldCheck className="h-3 w-3 text-warning" />}
          {step.rollbackCheckpoint && <RotateCcw className="h-3 w-3 text-muted-foreground" />}
          {step.parallel && <Zap className="h-3 w-3 text-accent" />}
        </div>
      </div>
      <div className="text-xs font-medium text-foreground truncate">{step.name}</div>
      <div className="mt-1 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {state ?? "queued"}
        </span>
        {durationMs != null && (
          <span className="font-mono text-[9px] tabular-nums text-muted-foreground">{durationMs}ms</span>
        )}
      </div>
      {tone === "active" && (
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-ping" />
      )}
    </div>
  );
}

export function OrchestrationGraph() {
  const runs = useLiveRuns((s) => s.runs);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [stepRuns, setStepRuns] = useState<WorkflowStepRun[]>([]);

  // Default to most recent run
  useEffect(() => {
    if (selectedRunId) return;
    const r = runs[0];
    if (r) setSelectedRunId(r.id);
  }, [runs, selectedRunId]);

  // Subscribe to step runs for the selected run
  useEffect(() => {
    if (!selectedRunId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("workflow_step_runs")
        .select("*")
        .eq("run_id", selectedRunId)
        .order("step_index", { ascending: true });
      if (!cancelled) setStepRuns((data ?? []) as unknown as WorkflowStepRun[]);
    };
    load();

    const channel = supabase
      .channel(`step_runs_${selectedRunId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "glue", table: "workflow_step_runs", filter: `run_id=eq.${selectedRunId}` },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selectedRunId]);

  const stateByName = useMemo(() => {
    const map = new Map<string, WorkflowStepRun>();
    for (const sr of stepRuns) map.set(sr.name, sr);
    return map;
  }, [stepRuns]);

  const recentRuns = runs.slice(0, 8);

  return (
    <section className="panel p-5 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base font-semibold text-foreground">Orchestration Graph</h2>
            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider">live DAG</Badge>
          </div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
            dependsOn · parallel · approval · rollback
          </p>
        </div>
      </header>

      <div className="flex gap-2 flex-wrap">
        {recentRuns.length === 0 ? (
          <span className="text-[11px] font-mono text-muted-foreground">No runs yet.</span>
        ) : (
          recentRuns.map((r) => {
            const selected = r.id === selectedRunId;
            const tone = stateTone(r.state as RunState);
            return (
              <button
                key={r.id}
                onClick={() => setSelectedRunId(r.id)}
                className={`px-2.5 py-1 rounded border font-mono text-[10px] tabular-nums transition-colors ${
                  selected ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${
                  tone === "ok" ? "bg-success" : tone === "error" ? "bg-destructive" : tone === "active" ? "bg-primary animate-pulse" : "bg-muted-foreground"
                }`} />
                {r.id.slice(0, 8)}
              </button>
            );
          })
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-stretch gap-3 min-w-fit py-2">
          {DEMO_GRAPH.steps.map((step, i) => {
            const sr = stateByName.get(step.name);
            return (
              <div key={step.id} className="flex items-center gap-3">
                <StepNode step={step} state={sr?.state as RunState | undefined} durationMs={sr?.duration_ms} />
                {i < DEMO_GRAPH.steps.length - 1 && (
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <span className="font-mono text-[9px]">→</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 pt-2 border-t border-border/40 text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-warning" /> approval gate</span>
        <span className="flex items-center gap-1.5"><RotateCcw className="h-3 w-3" /> rollback checkpoint</span>
        <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-accent" /> parallel fan-out</span>
      </div>
    </section>
  );
}
