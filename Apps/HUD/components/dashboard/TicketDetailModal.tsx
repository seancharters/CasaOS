'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, Loader2, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { marked } from 'marked';

interface TicketInfo {
  id: number;
  summary: string;
  status: string;
  priority: string;
  company: string;
  engineer: string;
}

interface TicketNote {
  id: number;
  text: string;
  dateCreated: string;
  author: string;
  isInternal: boolean;
  isResolution: boolean;
}

interface Props {
  ticketId: number;
  onClose: () => void;
  onBack?: () => void;
}

function formatDate(iso: string) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date(iso));
  } catch { return iso; }
}

// Detect whether the note text is HTML or markdown/plain text.
// ConnectWise rich-text notes contain block-level HTML tags; email-sourced notes arrive as markdown.
const HTML_TAG_RE = /<(p|div|table|ul|ol|li|br|h[1-6]|blockquote|hr)[\s/>]/i;

function noteToHtml(text: string): string {
  const isHtml = HTML_TAG_RE.test(text);
  let html: string;

  if (isHtml) {
    html = text;
  } else {
    marked.use({
      breaks: true,
      async: false,
      renderer: {
        link({ href, title, text }: { href: string; title?: string | null; text: string }) {
          const t = title ? ` title="${title}"` : '';
          return `<a href="${href}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`;
        },
      },
    });
    html = marked.parse(text) as string;
  }

  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove repeated legal disclaimer boilerplate from email footers
    .replace(/This email and any files transmitted with it[\s\S]*?any such entity\./gi, '')
    // Unwrap Microsoft SafeLinks to show actual destination URLs
    .replace(/href="https?:\/\/[a-z0-9.-]+\.safelinks\.protection\.outlook\.com\/\?url=([^&"]+)[^"]*"/gi,
      (_, encoded) => `href="${decodeURIComponent(encoded)}"`)
    // Remove empty paragraphs left after stripping
    .replace(/<p[^>]*>\s*(<br\s*\/?>)?\s*<\/p>/gi, '');
}

// Keep old name as a wrapper so NoteBody call site doesn't change
function sanitise(text: string): string {
  return noteToHtml(text);
}

function NoteBody({ html }: { html: string }) {
  const [expanded, setExpanded] = useState(false);
  const plainLen = html.replace(/<[^>]+>/g, '').length;
  const isLong = plainLen > 600;

  return (
    <div>
      <div
        className={`px-4 py-3 text-sm text-hud-muted-light leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_a]:text-brand-purple [&_a]:underline [&_a:hover]:text-hud-text overflow-hidden transition-[max-height] duration-300 ease-in-out ${isLong && !expanded ? 'max-h-52' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center justify-center gap-1 w-full px-4 py-1.5 text-xs text-brand-purple hover:text-hud-text border-t border-hud-border/40 bg-hud-bg/40 transition-colors"
        >
          {expanded ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Show more</>}
        </button>
      )}
    </div>
  );
}

export default function TicketDetailModal({ ticketId, onClose, onBack }: Props) {
  const [ticket, setTicket]   = useState<TicketInfo | null>(null);
  const [notes, setNotes]     = useState<TicketNote[]>([]);
  const [cwUrl, setCwUrl]     = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/tickets/${ticketId}/notes`)
      .then((r) => r.json())
      .then((d) => {
        setTicket(d.ticket ?? null);
        setNotes(d.notes ?? []);
        setCwUrl(d.cwUrl ?? '');
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [ticketId]);

  return (
    <>
      {/* Sits above the list modal (z-40/50) */}
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 pointer-events-none">
        <div className="bg-hud-card border border-hud-border rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl pointer-events-auto">

          {/* Header */}
          <div className="px-6 py-4 border-b border-hud-border flex items-center gap-3 shrink-0">
            {onBack && (
              <button onClick={onBack} className="text-hud-muted hover:text-hud-text transition-colors shrink-0" title="Back to list">
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <span className="text-brand-purple font-mono font-semibold text-xl shrink-0">#{ticketId}</span>
              {cwUrl && (
                <a
                  href={cwUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-orange/10 border border-brand-orange/30 rounded-lg text-brand-orange text-xs font-medium hover:bg-brand-orange/20 transition-colors shrink-0"
                >
                  <ExternalLink size={11} />
                  Open in ConnectWise
                </a>
              )}
              {ticket && (
                <span className="text-hud-muted text-sm truncate min-w-0">{ticket.summary}</span>
              )}
            </div>
            <button onClick={onClose} className="text-hud-muted hover:text-hud-text transition-colors shrink-0 p-1">
              <X size={16} />
            </button>
          </div>

          {/* Ticket meta strip */}
          {ticket && (
            <div className="px-6 py-3 border-b border-hud-border/50 grid grid-cols-4 gap-6 shrink-0 bg-hud-bg/40">
              {([
                ['Company',  ticket.company],
                ['Priority', ticket.priority],
                ['Status',   ticket.status],
                ['Engineer', ticket.engineer || '—'],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label}>
                  <div className="text-hud-muted text-[10px] font-semibold uppercase tracking-wider mb-0.5">{label}</div>
                  <div className="text-hud-text text-sm font-medium">{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div className="overflow-auto flex-1 p-5">
            {loading ? (
              <div className="flex items-center justify-center py-14 gap-2 text-hud-muted">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading notes…</span>
              </div>
            ) : error ? (
              <div className="py-14 text-center text-red-400 text-sm">{error}</div>
            ) : notes.length === 0 ? (
              <div className="py-14 text-center text-hud-muted text-sm">No notes on this ticket yet</div>
            ) : (
              <div className="space-y-3">
                <p className="text-hud-muted text-xs">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
                {notes.map((note) => (
                  <div key={note.id} className="border border-hud-border rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-hud-bg/60 border-b border-hud-border/50 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-hud-text text-xs font-semibold">{note.author}</span>
                        {note.isInternal && (
                          <span className="px-1.5 py-0.5 bg-brand-purple/10 border border-brand-purple/25 rounded text-brand-purple text-[10px] font-medium">
                            Internal
                          </span>
                        )}
                        {note.isResolution && (
                          <span className="px-1.5 py-0.5 bg-green-500/10 border border-green-500/25 rounded text-green-400 text-[10px] font-medium">
                            Resolution
                          </span>
                        )}
                      </div>
                      <span className="text-hud-muted text-xs shrink-0">{formatDate(note.dateCreated)}</span>
                    </div>
                    <NoteBody html={sanitise(note.text)} />
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
