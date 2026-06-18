import { ExternalLink } from 'lucide-react';
import type { PriorityTicket } from '@/lib/types';

interface Props {
  tickets: PriorityTicket[];
  visibleColumns: string[];
  onTicketClick?: (id: number) => void;
  cwSiteUrl?: string;
  cwCompanyId?: string;
}

interface ColDef {
  key: string;
  label: string;
  className?: string;
  render: (t: PriorityTicket) => React.ReactNode;
}

function getPriorityPill(priority: string) {
  const p = priority.toLowerCase();
  if (priority.includes('1') || p.includes('critical')) {
    return { label: 'P1', className: 'bg-red-500/20 text-red-400 border border-red-500/40' };
  }
  if (priority.includes('2') || p.includes('high')) {
    return { label: 'P2', className: 'bg-brand-orange/20 text-brand-orange border border-brand-orange/40' };
  }
  if (priority.includes('3') || p.includes('medium')) {
    return { label: 'P3', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' };
  }
  if (priority.includes('4') || p.includes('low')) {
    return { label: 'P4', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/40' };
  }
  const num = priority.match(/\d+/)?.[0];
  return { label: num ? `P${num}` : '?', className: 'bg-hud-border/50 text-hud-muted border border-hud-border' };
}

export const TICKET_COLUMN_LABELS: Record<string, string> = {
  id: 'Ticket', priority: 'Priority', status: 'Status',
  company: 'Company', engineer: 'Engineer', summary: 'Summary',
};

export default function TicketsTable({ tickets, visibleColumns, onTicketClick, cwSiteUrl, cwCompanyId }: Props) {
  const cwUrl = (id: number) =>
    cwSiteUrl && cwCompanyId
      ? `https://${cwSiteUrl}/v4_6_release/services/system_io/Service/fv_sr100_request.rails?service_recid=${id}&companyName=${cwCompanyId}`
      : null;

  const ALL_COLUMNS: ColDef[] = [
    {
      key: 'id',
      label: 'Ticket',
      render: (t) => {
        const url = cwUrl(t.id);
        return (
          <div className="flex items-center gap-1.5 group/id">
            <button
              onClick={() => onTicketClick?.(t.id)}
              className={`font-mono text-sm font-medium transition-colors ${onTicketClick ? 'text-brand-purple hover:text-hud-text cursor-pointer' : 'text-brand-purple cursor-default'}`}
            >
              #{t.id}
            </button>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-hud-muted hover:text-hud-text transition-colors opacity-0 group-hover/id:opacity-100"
                title="Open in ConnectWise"
              >
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        );
      },
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (t) => {
        const pill = getPriorityPill(t.priority);
        return (
          <span className={`text-xs px-2 py-0.5 rounded font-bold ${pill.className}`}>
            {pill.label}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (t) => (
        <span className="text-xs px-2 py-0.5 rounded border bg-hud-border/40 text-hud-muted-light border-hud-border">
          {t.status || '—'}
        </span>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      render: (t) => <span className="text-hud-text text-sm">{t.company}</span>,
    },
    {
      key: 'engineer',
      label: 'Engineer',
      render: (t) => <span className="text-hud-muted-light text-sm">{t.engineer}</span>,
    },
    {
      key: 'summary',
      label: 'Summary',
      className: 'max-w-md',
      render: (t) => (
        <span className="text-hud-text text-sm truncate block max-w-md" title={t.summary}>
          {t.summary}
        </span>
      ),
    },
  ];

  const cols = ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key));

  return (
    <div className="bg-hud-card border border-hud-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-hud-border">
        <h2 className="text-hud-text text-sm font-semibold">Open Priority Tickets</h2>
      </div>
      {tickets.length === 0 ? (
        <div className="px-4 py-6 text-hud-muted text-sm">No priority tickets — great work!</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-hud-border">
                {cols.map((c) => (
                  <th key={c.key} className="text-left text-hud-muted text-xs font-semibold px-4 py-2 uppercase tracking-wider whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-hud-border/40 last:border-0 hover:bg-hud-border/20 transition-colors">
                  {cols.map((c) => (
                    <td key={c.key} className={`px-4 py-2.5 ${c.className ?? ''}`}>
                      {c.render(t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
