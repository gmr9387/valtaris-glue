// Security events feed — surfaces authz denials, operator actions, and replay
// access in the operator console. Read-only; tenant-scoped via RLS.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldAlert, ShieldCheck, UserCheck, History } from "lucide-react";

interface SecurityEvent {
  id: string;
  ts: string;
  category: string;
  severity: "info" | "warn" | "error";
  subject_type: string | null;
  subject_id: string | null;
  message: string | null;
  actor_user_id: string | null;
}

const catIcon = (c: string) =>
  c === "authz.denied" ? <ShieldAlert className="h-4 w-4 text-red-500" />
    : c === "operator.action" ? <UserCheck className="h-4 w-4 text-emerald-500" />
    : c === "replay.access" ? <History className="h-4 w-4 text-blue-500" />
    : <ShieldCheck className="h-4 w-4 text-muted-foreground" />;

export function SecurityEventsFeed() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("security_events")
        .select("id, ts, category, severity, subject_type, subject_id, message, actor_user_id")
        .order("ts", { ascending: false })
        .limit(50);
      if (mounted) setEvents((data ?? []) as SecurityEvent[]);
    };
    load();
    const ch = supabase
      .channel("security_events_stream")
      .on("postgres_changes", { event: "INSERT", schema: "glue", table: "security_events" }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Security Events</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72">
          {events.length === 0 && (
            <p className="text-xs text-muted-foreground">No security events recorded.</p>
          )}
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-2 rounded-md border p-2 text-xs">
                {catIcon(e.category)}
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono">{e.category}</span>
                    <span className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{e.message ?? "—"}</p>
                  {e.subject_type && (
                    <div className="mt-1 flex gap-1">
                      <Badge variant="outline" className="text-[10px]">{e.subject_type}</Badge>
                      {e.subject_id && (
                        <Badge variant="outline" className="text-[10px] font-mono truncate max-w-[12rem]">
                          {e.subject_id.slice(0, 12)}…
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
