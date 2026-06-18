'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';

interface TicketListItem {
  id: number;
  summary: string;
  status: string;
  priority: string;
  company: string;
  engineer: string;
  lastUpdated: string | null;
}

interface Props {
  filter: string;
  label: string;
  from: string;
  to: string;
  onClose: () => void;
  onTicketClick: (id: number) => void;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date(iso));
  } catch { return iso; }
}

function getPriorityPill(priority: string) {
  const p = priority.toLowerCase();
  if (priority.includes('1') || p.includes('critical')) {
    return { label: 'P1', cls: 'bg-red-500/20 text-red-400 border-red-500/40' };
  }
  if (priority.includes('2') || p.includes('high')) {
    return { label: 'P2', cls: 'bg-brand-orange/20 text-brand-orange border-brand-orange/40' };
  }
  if (priority.includes('3') || p.includes('medium')) {
    return { label: 'P3', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' };
  }
  if (priority.includes('4') || p.includes('low')) {
    return { label: 'P4', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
  }
  const num = priority.match(/\d+/)?.[0];
  return { label: num ? `P${num}` : '?', cls: 'bg-hud-border/50 text-hud-muted border-hud-border' };
}

export default function TicketListModal({ filter, label, from, to, onClose, onTicketClick }: Props) {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cwSiteUrl, setCwSiteUrl] = useState('');
  const [cwCompanyId, setCwCompanyId] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/tickets?${new URLSearchParams({ filter, from, to })}`)
      .then((r) => r.json())
      .then((d) => {
        setTickets(d.tickets ?? []);
        setCwSiteUrl(d.cwSiteUrl ?? '');
        setCwCompanyId(d.cwCompanyId ?? '');
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [filter, from, to]);

  const cwUrl = (id: number) =>
    cwSiteUrl && cwCompanyId
      ? `https://${cwSiteUrl}/v4_6_release/services/system_io/Service/fv_sr100_request.rails?service_recid=${id}&companyName=${cwCompanyId}`
      : null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div className="bg-hud-card border border-hud-border rounded-xl w-full max-w-5xl max-h-[80vh] flex flex-col shadow-2xl pointer-events-auto">

          {/* Header */}
          <div className="px-6 py-4 border-b border-hud-border flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-hud-text font-semibold text-base">{label}</h2>
              {!loading && (
                <p className="text-hud-muted text-xs mt-0.5">
                  {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
                  {tickets.length === 100 && ' (showing first 100)'}
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-hud-muted hover:text-hud-text transition-colors p-1">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-hud-muted">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading tickets…</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-16 text-red-400 text-sm">{error}</div>
            ) : tickets.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-hud-muted text-sm">No tickets found</div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-hud-card z-10">
                  <tr className="border-b border-hud-border">
                    {['Ticket', 'Priority', 'Status', 'Company', 'Engineer', ...(filter === 'noUpdate48h' ? ['Last Updated'] : []), 'Summary'].map((h) => (
                      <th key={h} className="text-left text-hud-muted text-xs font-semibold px-4 py-2.5 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const pill = getPriorityPill(t.priority);
                    const url  = cwUrl(t.id);
                    return (
                      <tr key={t.id} className="border-b border-hud-border/40 last:border-0 hover:bg-hud-border/10 transition-colors group">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onTicketClick(t.id)}
                              className="text-brand-purple hover:text-hud-text font-mono text-sm font-medium transition-colors"
                            >
                              #{t.id}
                            </button>
                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-hud-muted hover:text-hud-text transition-colors opacity-0 group-hover:opacity-100"
                                title="Open in ConnectWise"
                              >
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${pill.cls}`}>
                            {pill.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-hud-muted text-sm whitespace-nowrap">{t.status}</td>
                        <td className="px-4 py-3 text-hud-text text-sm whitespace-nowrap">{t.company}</td>
                        <td className="px-4 py-3 text-hud-muted text-sm whitespace-nowrap">{t.engineer || '—'}</td>
                        {filter === 'noUpdate48h' && (
                          <td className="px-4 py-3 text-hud-muted text-sm whitespace-nowrap">{formatDate(t.lastUpdated)}</td>
                        )}
                        <td className="px-4 py-3 text-hud-muted text-sm max-w-sm">
                          <span className="truncate block max-w-sm" title={t.summary}>{t.summary}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
