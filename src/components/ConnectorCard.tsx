import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApiStore } from '@/store/useApiStore';
import { CheckCircle, Plug, CreditCard, Brain, Mail, MessageSquare, Hash, Cloud, Ticket } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/ui/status-badge';

interface ConnectorDef {
  name: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const CONNECTORS: ConnectorDef[] = [
  { name: 'stripe', label: 'Stripe', icon: CreditCard, description: 'Payment processing — charge, refund, create customers.' },
  { name: 'openai', label: 'OpenAI', icon: Brain, description: 'AI models — generate text, create images.' },
  { name: 'sendgrid', label: 'SendGrid', icon: Mail, description: 'Email delivery — send transactional emails.' },
  { name: 'twilio', label: 'Twilio', icon: MessageSquare, description: 'SMS & messaging — send text messages.' },
  { name: 'slack', label: 'Slack', icon: Hash, description: 'Team chat — post messages, manage channels.' },
  { name: 'salesforce', label: 'Salesforce', icon: Cloud, description: 'CRM — manage leads, opportunities, accounts.' },
  { name: 'servicenow', label: 'ServiceNow', icon: Ticket, description: 'ITSM — create, update, and look up Cases or Incidents.' },
];

export function ConnectorCard({ connector }: { connector: typeof CONNECTORS[0] }) {
  const connect = useApiStore(s => s.connect);
  const disconnect = useApiStore(s => s.disconnect);
  const connectedServices = useApiStore(s => s.connectedServices);
  const [busy, setBusy] = useState(false);

  const connected = connectedServices.find(s => s.name === connector.name);
  const Icon = connector.icon;

  const handleConnect = () => {
    setBusy(true);
    const result = connect(connector.name);
    setBusy(false);
    if (result.success) {
      toast({ title: `${connector.label} connected`, description: 'Service is ready. Credentials stay on the server.' });
    } else {
      toast({ title: 'Connection failed', description: result.error, variant: 'destructive' });
    }
  };

  const handleDisconnect = () => {
    disconnect(connector.name);
    toast({ title: `${connector.label} disconnected` });
  };

  return (
    <div className="panel p-5 flex flex-col h-full transition-shadow hover:shadow-elev-md">
      <div className="flex items-start justify-between mb-4">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${connected ? 'bg-primary/10' : 'bg-muted'}`}>
          <Icon className={`h-5 w-5 ${connected ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        {connected ? (
          <StatusBadge tone="success" dot>Connected</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Not connected</StatusBadge>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <h3 className="font-display font-semibold text-foreground">{connector.label}</h3>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{connector.description}</p>
        {connected && (
          <p className="text-[11px] font-mono text-muted-foreground mt-3 truncate">
            <span className="uppercase tracking-wider">Actions:</span> {connected.actions.join(', ')}
          </p>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-border">
        {connected ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 text-success" />
              Keys on server
            </span>
            <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-xs text-muted-foreground hover:text-danger h-7">
              Disconnect
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={handleConnect} disabled={busy}>
            <Plug className="h-3.5 w-3.5 mr-1.5" /> Connect
          </Button>
        )}
      </div>
    </div>
  );
}

export { CONNECTORS };
