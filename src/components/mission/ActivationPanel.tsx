import { useEffect, useState } from "react";
import { useActivation } from "@/store/useActivation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { WorkflowVersionSelect } from "@/components/mission/WorkflowVersionSelect";
import { Webhook, Calendar, Zap, Pause, Play, RotateCw, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";

function age(iso: string | null) {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 0) return `in ${Math.abs(s)}s`;
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

const statusTone: Record<string, string> = {
  enqueued: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-info/15 text-info border-info/30",
  duplicate: "bg-muted text-muted-foreground border-border",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  failed_: "bg-destructive/15 text-destructive border-destructive/30",
};

export function ActivationPanel() {
  const {
    endpoints, deliveries, schedules, activations, triggers,
    hydrate, subscribe, toggleEndpoint, setScheduleState, replayDelivery, tickScheduler,
  } = useActivation();

  useEffect(() => {
    hydrate();
    return subscribe();
  }, [hydrate, subscribe]);

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Activation Surface</h3>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            webhooks · schedules · triggers
          </span>
        </div>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={tickScheduler}>
          <RefreshCw className="h-3 w-3 mr-1" /> Tick scheduler
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Webhook endpoints */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <Webhook className="h-3 w-3" /> Endpoints ({endpoints.length})
            </div>
            <NewEndpointDialog />
          </div>
          <ScrollArea className="h-[180px] rounded-md border border-border">
            {endpoints.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No webhook endpoints configured.</div>
            ) : (
              <ul className="divide-y divide-border">
                {endpoints.map((e) => (
                  <li key={e.id} className="p-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">{e.source}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono truncate">{e.endpoint_key}</div>
                      <div className="text-[10px] text-muted-foreground truncate">→ {e.dag_id}</div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${e.paused ? statusTone.paused : statusTone.active}`}>
                      {e.paused ? "paused" : "active"}
                    </Badge>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => toggleEndpoint(e.id, !e.paused)}>
                      {e.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Schedules */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <Calendar className="h-3 w-3" /> Schedules ({schedules.length})
            </div>
            <NewScheduleDialog />
          </div>
          <ScrollArea className="h-[180px] rounded-md border border-border">
            {schedules.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No schedules configured.</div>
            ) : (
              <ul className="divide-y divide-border">
                {schedules.map((s) => (
                  <li key={s.id} className="p-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono truncate">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.schedule_kind === "interval" ? `every ${s.interval_seconds}s` : s.cron_expression}
                        {" · next "}{age(s.next_run_at)}
                        {s.consecutive_failures > 0 && ` · ${s.consecutive_failures} fail`}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${statusTone[s.state] ?? ""}`}>{s.state}</Badge>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => setScheduleState(s.id, s.state === "active" ? "paused" : "active")}>
                      {s.state === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Recent deliveries */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <Webhook className="h-3 w-3" /> Recent deliveries
          </div>
          <ScrollArea className="h-[180px] rounded-md border border-border">
            {deliveries.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No deliveries yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {deliveries.map((d) => (
                  <li key={d.id} className="p-2 flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${statusTone[d.status] ?? ""}`}>{d.status}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono text-muted-foreground truncate">
                        {age(d.received_at)} ago
                        {d.signature_valid === false && " · sig invalid"}
                        {d.error && ` · ${d.error}`}
                      </div>
                    </div>
                    {(d.status === "failed" || d.status === "rejected") && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => replayDelivery(d.id)}>
                        <RotateCw className="h-3 w-3" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Event triggers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <Zap className="h-3 w-3" /> Event triggers ({triggers.length})
            </div>
            <NewEventTriggerDialog />
          </div>
          <ScrollArea className="h-[180px] rounded-md border border-border">
            {triggers.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No event triggers configured.</div>
            ) : (
              <ul className="divide-y divide-border">
                {triggers.map((t) => (
                  <li key={t.id} className="p-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono truncate">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        on {t.source_event_type} → {t.dag_id}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${t.enabled ? statusTone.active : statusTone.paused}`}>
                      {t.enabled ? "enabled" : "disabled"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Activations */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3 w-3" /> Trigger activations
          </div>
          <ScrollArea className="h-[180px] rounded-md border border-border">
            {activations.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No activations recorded.</div>
            ) : (
              <ul className="divide-y divide-border">
                {activations.map((a) => (
                  <li key={a.id} className="p-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">{a.trigger_kind}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono truncate">{a.source_label ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        depth {a.depth} · {age(a.fired_at)} ago
                        {a.suppressed && ` · suppressed (${a.suppressed_reason})`}
                      </div>
                    </div>
                    {a.suppressed && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">suppressed</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </div>
    </Card>
  );
}

function NewEndpointDialog() {
  const createEndpoint = useActivation((s) => s.createEndpoint);
  const [open, setOpen] = useState(false);
  const [endpointKey, setEndpointKey] = useState("");
  const [source, setSource] = useState("webhook");
  const [versionId, setVersionId] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setEndpointKey(""); setSource("webhook"); setVersionId(""); };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]"><Plus className="h-3 w-3 mr-0.5" />New</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New webhook endpoint</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Endpoint key</Label>
            <Input value={endpointKey} onChange={(e) => setEndpointKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className="font-mono text-xs h-8" placeholder="orders-inbound" />
          </div>
          <div>
            <Label className="text-xs">Source label</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} className="text-xs h-8" />
          </div>
          <div>
            <Label className="text-xs">Workflow version</Label>
            <WorkflowVersionSelect value={versionId} onChange={setVersionId} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!endpointKey || !versionId || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await createEndpoint({ endpoint_key: endpointKey, source, workflow_version_id: versionId });
                toast.success("Webhook endpoint created");
                setOpen(false); reset();
              } catch (e: any) { toast.error(e.message ?? "Failed to create endpoint"); }
              finally { setBusy(false); }
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewScheduleDialog() {
  const createSchedule = useActivation((s) => s.createSchedule);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"interval" | "cron">("interval");
  const [intervalSeconds, setIntervalSeconds] = useState("60");
  const [cronExpression, setCronExpression] = useState("");
  const [versionId, setVersionId] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setName(""); setKind("interval"); setIntervalSeconds("60"); setCronExpression(""); setVersionId(""); };
  const valid = name && versionId && (kind === "interval" ? Number(intervalSeconds) > 0 : cronExpression.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]"><Plus className="h-3 w-3 mr-0.5" />New</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New schedule</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-xs h-8" placeholder="nightly-reconciliation" />
          </div>
          <div>
            <Label className="text-xs">Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "interval" | "cron")}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="interval" className="text-xs">Interval</SelectItem>
                <SelectItem value="cron" className="text-xs">Cron expression</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {kind === "interval" ? (
            <div>
              <Label className="text-xs">Interval (seconds)</Label>
              <Input type="number" min={1} value={intervalSeconds} onChange={(e) => setIntervalSeconds(e.target.value)} className="text-xs h-8" />
            </div>
          ) : (
            <div>
              <Label className="text-xs">Cron expression</Label>
              <Input value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} className="font-mono text-xs h-8" placeholder="0 2 * * *" />
            </div>
          )}
          <div>
            <Label className="text-xs">Workflow version</Label>
            <WorkflowVersionSelect value={versionId} onChange={setVersionId} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await createSchedule({
                  name, workflow_version_id: versionId, schedule_kind: kind,
                  interval_seconds: kind === "interval" ? Number(intervalSeconds) : undefined,
                  cron_expression: kind === "cron" ? cronExpression : undefined,
                });
                toast.success("Schedule created");
                setOpen(false); reset();
              } catch (e: any) { toast.error(e.message ?? "Failed to create schedule"); }
              finally { setBusy(false); }
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewEventTriggerDialog() {
  const createEventTrigger = useActivation((s) => s.createEventTrigger);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("");
  const [versionId, setVersionId] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setName(""); setEventType(""); setVersionId(""); };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]"><Plus className="h-3 w-3 mr-0.5" />New</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New event trigger</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-xs h-8" placeholder="on-order-created" />
          </div>
          <div>
            <Label className="text-xs">Source event type</Label>
            <Input value={eventType} onChange={(e) => setEventType(e.target.value)} className="font-mono text-xs h-8" placeholder="order.created" />
          </div>
          <div>
            <Label className="text-xs">Workflow version</Label>
            <WorkflowVersionSelect value={versionId} onChange={setVersionId} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!name || !eventType || !versionId || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await createEventTrigger({ name, source_event_type: eventType, workflow_version_id: versionId });
                toast.success("Event trigger created");
                setOpen(false); reset();
              } catch (e: any) { toast.error(e.message ?? "Failed to create event trigger"); }
              finally { setBusy(false); }
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
