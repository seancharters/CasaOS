import type { AgentStatus } from '@/lib/types';

interface Props {
  agents: AgentStatus[];
  visibleColumns: string[];
}

interface ColDef {
  key: string;
  label: string;
  render: (agent: AgentStatus) => React.ReactNode;
}

const statusConfig: Record<AgentStatus['status'], { dotClass: string; label: string; textClass: string }> = {
  LoggedIn:  { dotClass: 'bg-green-500 animate-pulse', label: 'Logged In',  textClass: 'text-green-400' },
  LoggedOut: { dotClass: 'bg-red-500 animate-pulse',   label: 'Logged Out', textClass: 'text-red-400'  },
};

const ALL_COLUMNS: ColDef[] = [
  {
    key: 'name',
    label: 'User',
    render: (a) => <span className="text-hud-text text-sm">{a.name}</span>,
  },
  {
    key: 'extension',
    label: 'Ext',
    render: (a) => <span className="text-hud-muted text-sm font-mono">{a.extension}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    render: (a) => {
      const cfg = statusConfig[a.status];
      return (
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotClass}`} />
          <span className={`text-xs font-medium ${cfg.textClass}`}>{cfg.label}</span>
        </div>
      );
    },
  },
];

export const LOGIN_COLUMN_LABELS: Record<string, string> = Object.fromEntries(
  ALL_COLUMNS.map((c) => [c.key, c.label])
);

export default function LoginStatusTable({ agents, visibleColumns }: Props) {
  const cols = ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key));

  return (
    <div className="bg-hud-card border border-hud-border rounded-lg overflow-hidden h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-hud-border shrink-0">
        <h2 className="text-hud-text text-sm font-semibold">
          Login Status{' '}
          <span className="text-brand-purple ml-1 text-xs font-normal uppercase tracking-wider">Live</span>
        </h2>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-hud-border">
              {cols.map((c) => (
                <th
                  key={c.key}
                  className="text-left text-hud-muted text-xs font-semibold px-4 py-2 uppercase tracking-wider"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr
                key={agent.extension}
                className="border-b border-hud-border/40 last:border-0 hover:bg-hud-border/20 transition-colors"
              >
                {cols.map((c) => (
                  <td key={c.key} className="px-4 py-2.5">
                    {c.render(agent)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
