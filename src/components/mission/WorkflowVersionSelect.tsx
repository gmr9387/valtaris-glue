import { useEffect } from "react";
import { useActivation } from "@/store/useActivation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function label(v: { id: string; state: string; metadata: Record<string, unknown> | null; created_at: string }) {
  const name = typeof v.metadata?.name === "string" ? v.metadata.name : null;
  const shortId = v.id.slice(0, 8);
  return `${name ?? `Version ${shortId}`} · ${v.state}`;
}

export function WorkflowVersionSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const workflowVersions = useActivation((s) => s.workflowVersions);
  const loadWorkflowVersions = useActivation((s) => s.loadWorkflowVersions);

  useEffect(() => {
    void loadWorkflowVersions();
  }, [loadWorkflowVersions]);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Select a workflow version..." />
      </SelectTrigger>
      <SelectContent>
        {workflowVersions.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            No workflow versions yet — publish one in Workflow Studio first.
          </div>
        ) : (
          workflowVersions.map((v) => (
            <SelectItem key={v.id} value={v.id} className="text-xs font-mono">
              {label(v)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
