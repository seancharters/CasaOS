'use client';

import { useState, useEffect } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import type { WidgetConfigs } from '@/lib/types';
import { TICKET_COLUMN_LABELS } from '@/components/dashboard/TicketsTable';
import { LOGIN_COLUMN_LABELS } from '@/components/dashboard/LoginStatusTable';

interface ConfigDrawerProps {
  widgetKey: keyof WidgetConfigs | null;
  configs: WidgetConfigs;
  onSave: (configs: WidgetConfigs) => void;
  onClose: () => void;
}

const CALL_METRIC_LABELS: Record<string, string> = {
  pctAnswered: '% Answered',
  answeredOverflow: 'Answered Overflow',
  missedCalls: 'Missed Calls',
  totalCalls: 'Total Calls',
  avgTalkDuration: 'Avg Talk Duration',
  avgCallDuration: 'Avg Call Duration',
  onCallEngineer: 'On-Call Engineer',
};

const ALL_METRIC_KEYS = Object.keys(CALL_METRIC_LABELS);

const WIDGET_TITLES: Record<keyof WidgetConfigs, string> = {
  loginStatus: 'Login Status',
  callStats: 'Call Stats',
  ticketStats: 'Ticket Stats',
  ticketsChart: 'Tickets Per Resource',
  priorityTickets: 'Priority Tickets',
};

const inputClass =
  'w-full bg-hud-bg border border-hud-border rounded-lg px-3 py-2 text-hud-text text-sm focus:outline-none focus:border-brand-purple transition-colors placeholder:text-hud-muted';

const labelClass = 'block text-xs font-semibold text-hud-muted-light uppercase tracking-wider mb-1.5';

const hintClass = 'text-xs text-hud-muted mt-1';

// ---- Column picker component ----

interface ColumnPickerProps {
  label: string;
  hint?: string;
  allColumns: Record<string, string>; // key → label
  value: string; // comma-separated visible column keys
  onChange: (value: string) => void;
}

function ColumnPicker({ label, hint, allColumns, value, onChange }: ColumnPickerProps) {
  const keys = Object.keys(allColumns);
  const visible = value.split(',').map((k) => k.trim()).filter(Boolean);

  const toggle = (key: string) => {
    const next = visible.includes(key)
      ? visible.filter((k) => k !== key)
      : [...visible, key];
    // Preserve original key order
    onChange(keys.filter((k) => next.includes(k)).join(','));
  };

  return (
    <div>
      <label className={labelClass}>{label}</label>
      {hint && <p className={hintClass + ' mb-2'}>{hint}</p>}
      <div className="rounded-lg border border-hud-border overflow-hidden">
        {keys.map((key) => {
          const checked = visible.includes(key);
          return (
            <label
              key={key}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-hud-border last:border-0 ${
                checked ? 'bg-brand-purple/10' : 'hover:bg-hud-border/40'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(key)}
                className="accent-brand-purple w-4 h-4 shrink-0"
              />
              <span className={`text-sm ${checked ? 'text-hud-text' : 'text-hud-muted'}`}>
                {allColumns[key]}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ---- Board picker component ----

interface BoardPickerProps {
  label: string;
  hint?: string;
  value: string; // comma-separated selected board names
  onChange: (value: string) => void;
}

function BoardPicker({ label, hint, value, onChange }: BoardPickerProps) {
  const [boards, setBoards] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/boards')
      .then((r) => r.json())
      .then((data: { boards: string[]; error?: string }) => {
        if (data.error) setError(data.error);
        setBoards(data.boards ?? []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const selected = value
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);

  const toggle = (board: string) => {
    const next = selected.includes(board)
      ? selected.filter((b) => b !== board)
      : [...selected, board];
    onChange(next.join(','));
  };

  const filtered = boards.filter((b) =>
    b.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <label className={labelClass}>{label}</label>
      {hint && <p className={hintClass + ' mb-2'}>{hint}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-hud-muted text-xs py-3">
          <Loader2 size={13} className="animate-spin" />
          <span>Loading boards…</span>
        </div>
      ) : error ? (
        <p className="text-red-400 text-xs py-2">
          Could not load boards — ConnectWise may not be configured.
        </p>
      ) : boards.length === 0 ? (
        <p className="text-hud-muted text-xs py-2">No boards found.</p>
      ) : (
        <div className="rounded-lg border border-hud-border overflow-hidden">
          {/* Search */}
          {boards.length > 6 && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-hud-border bg-hud-bg">
              <Search size={12} className="text-hud-muted shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search boards…"
                className="flex-1 bg-transparent text-hud-text text-xs focus:outline-none placeholder:text-hud-muted"
              />
            </div>
          )}

          {/* Board list */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-hud-muted text-xs px-3 py-3">No matching boards.</p>
            ) : (
              filtered.map((board) => {
                const checked = selected.includes(board);
                return (
                  <label
                    key={board}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-hud-border last:border-0 ${
                      checked
                        ? 'bg-brand-purple/10'
                        : 'hover:bg-hud-border/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(board)}
                      className="accent-brand-purple w-4 h-4 shrink-0"
                    />
                    <span className={`text-sm truncate ${checked ? 'text-hud-text' : 'text-hud-muted'}`}>
                      {board}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {/* Selected summary */}
          {selected.length > 0 && (
            <div className="px-3 py-2 border-t border-hud-border bg-hud-bg flex items-center justify-between">
              <span className="text-xs text-brand-purple font-medium">
                {selected.length} board{selected.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => onChange('')}
                className="text-xs text-hud-muted hover:text-hud-text transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Queue picker (single-select) ----

interface QueuePickerProps {
  label: string;
  hint?: string;
  value: string; // single queue id
  onChange: (value: string) => void;
}

function QueuePicker({ label, hint, value, onChange }: QueuePickerProps) {
  const [queues, setQueues] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/queues')
      .then((r) => r.json())
      .then((data: { queues: { id: string; name: string }[]; error?: string }) => {
        if (data.error) setError(data.error);
        setQueues(data.queues ?? []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <label className={labelClass}>{label}</label>
      {hint && <p className={hintClass + ' mb-2'}>{hint}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-hud-muted text-xs py-3">
          <Loader2 size={13} className="animate-spin" />
          <span>Loading queues…</span>
        </div>
      ) : error ? (
        <p className="text-red-400 text-xs py-2">Could not load queues — 3CX may not be configured.</p>
      ) : queues.length === 0 ? (
        <p className="text-hud-muted text-xs py-2">No queues found.</p>
      ) : (
        <div className="rounded-lg border border-hud-border overflow-hidden">
          {/* None option */}
          <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-hud-border ${
            value === '' ? 'bg-brand-purple/10' : 'hover:bg-hud-border/40'
          }`}>
            <input
              type="radio"
              name="onCallQueue"
              checked={value === ''}
              onChange={() => onChange('')}
              className="accent-brand-purple w-4 h-4 shrink-0"
            />
            <span className={`text-sm ${value === '' ? 'text-hud-text' : 'text-hud-muted'}`}>None</span>
          </label>
          {queues.map((q) => (
            <label
              key={q.id}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-hud-border last:border-0 ${
                value === q.id ? 'bg-brand-purple/10' : 'hover:bg-hud-border/40'
              }`}
            >
              <input
                type="radio"
                name="onCallQueue"
                checked={value === q.id}
                onChange={() => onChange(q.id)}
                className="accent-brand-purple w-4 h-4 shrink-0"
              />
              <span className={`text-sm ${value === q.id ? 'text-hud-text' : 'text-hud-muted'}`}>
                {q.name}
              </span>
              <span className="text-xs text-hud-muted ml-auto">#{q.id}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Trunk picker (multi-select) ----

interface TrunkPickerProps {
  label: string;
  hint?: string;
  value: string; // comma-separated selected trunk names
  onChange: (value: string) => void;
}

function TrunkPicker({ label, hint, value, onChange }: TrunkPickerProps) {
  const [trunks, setTrunks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/trunks')
      .then((r) => r.json())
      .then((data: { trunks: string[]; error?: string }) => {
        if (data.error) setError(data.error);
        setTrunks(data.trunks ?? []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const selected = value.split(',').map((t) => t.trim()).filter(Boolean);

  const toggle = (trunk: string) => {
    const next = selected.includes(trunk)
      ? selected.filter((t) => t !== trunk)
      : [...selected, trunk];
    onChange(next.join(','));
  };

  return (
    <div>
      <label className={labelClass}>{label}</label>
      {hint && <p className={hintClass + ' mb-2'}>{hint}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-hud-muted text-xs py-3">
          <Loader2 size={13} className="animate-spin" />
          <span>Loading trunks…</span>
        </div>
      ) : error ? (
        <p className="text-red-400 text-xs py-2">Could not load trunks — 3CX may not be configured.</p>
      ) : trunks.length === 0 ? (
        <p className="text-hud-muted text-xs py-2">No trunks found in recent call log.</p>
      ) : (
        <div className="rounded-lg border border-hud-border overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {trunks.map((trunk) => {
              const checked = selected.includes(trunk);
              return (
                <label
                  key={trunk}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-hud-border last:border-0 ${
                    checked ? 'bg-brand-purple/10' : 'hover:bg-hud-border/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(trunk)}
                    className="accent-brand-purple w-4 h-4 shrink-0"
                  />
                  <span className={`text-sm truncate ${checked ? 'text-hud-text' : 'text-hud-muted'}`}>
                    {trunk}
                  </span>
                </label>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="px-3 py-2 border-t border-hud-border bg-hud-bg flex items-center justify-between">
              <span className="text-xs text-brand-purple font-medium">
                {selected.length} trunk{selected.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => onChange('')}
                className="text-xs text-hud-muted hover:text-hud-text transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main drawer ----

const SECTIONS: { key: keyof WidgetConfigs; label: string }[] = [
  { key: 'loginStatus',     label: 'Team'     },
  { key: 'callStats',       label: 'Calls'    },
  { key: 'ticketStats',     label: 'Tickets'  },
  { key: 'ticketsChart',    label: 'Chart'    },
  { key: 'priorityTickets', label: 'Priority' },
];

export default function ConfigDrawer({
  widgetKey,
  configs,
  onSave,
  onClose,
}: ConfigDrawerProps) {
  const [local, setLocal] = useState<WidgetConfigs>(configs);
  const [activeSection, setActiveSection] = useState<keyof WidgetConfigs>(
    widgetKey ?? 'loginStatus'
  );

  useEffect(() => {
    setLocal(configs);
  }, [widgetKey, configs]);

  useEffect(() => {
    if (widgetKey) setActiveSection(widgetKey);
  }, [widgetKey]);

  const isOpen = widgetKey !== null;

  const handleSave = () => onSave(local);

  function updateLoginStatus<K extends keyof WidgetConfigs['loginStatus']>(
    key: K,
    value: WidgetConfigs['loginStatus'][K]
  ) {
    setLocal((prev) => ({ ...prev, loginStatus: { ...prev.loginStatus, [key]: value } }));
  }

  function updateCallStats(value: string) {
    setLocal((prev) => ({ ...prev, callStats: { ...prev.callStats, hiddenMetrics: value } }));
  }

  function updateTicketStatsBoardNames(value: string) {
    setLocal((prev) => ({ ...prev, ticketStats: { ...prev.ticketStats, boardNames: value } }));
  }

  function updateTicketsChart<K extends keyof WidgetConfigs['ticketsChart']>(
    key: K,
    value: WidgetConfigs['ticketsChart'][K]
  ) {
    setLocal((prev) => ({ ...prev, ticketsChart: { ...prev.ticketsChart, [key]: value } }));
  }

  function updatePriorityTickets<K extends keyof WidgetConfigs['priorityTickets']>(
    key: K,
    value: WidgetConfigs['priorityTickets'][K]
  ) {
    setLocal((prev) => ({ ...prev, priorityTickets: { ...prev.priorityTickets, [key]: value } }));
  }

  function getHiddenMetrics(): string[] {
    return local.callStats.hiddenMetrics.split(',').map((m) => m.trim()).filter(Boolean);
  }

  function toggleMetric(key: string) {
    const hidden = getHiddenMetrics();
    const next = hidden.includes(key) ? hidden.filter((m) => m !== key) : [...hidden, key];
    updateCallStats(next.join(','));
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 h-full w-96 bg-hud-card border-l border-hud-border z-50 flex flex-col shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-5 pt-4 border-b border-hud-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-hud-text font-semibold text-sm">Configure</h2>
            <button
              onClick={onClose}
              className="text-hud-muted hover:text-hud-text transition-colors p-1 rounded hover:bg-hud-border"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          {/* Section tabs */}
          <div className="flex gap-1 -mb-px">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-colors ${
                  activeSection === s.key
                    ? 'text-hud-text border-brand-purple bg-brand-purple/10'
                    : 'text-hud-muted border-transparent hover:text-hud-text hover:bg-hud-border/40'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {activeSection === 'loginStatus' && (
            <>
              <ColumnPicker
                label="Columns"
                value={local.loginStatus.columns}
                allColumns={LOGIN_COLUMN_LABELS}
                onChange={(v) => updateLoginStatus('columns', v)}
              />
              <div>
                <label className={labelClass}>Exclude Extensions</label>
                <input
                  type="text"
                  value={local.loginStatus.excludeExtensions}
                  onChange={(e) => updateLoginStatus('excludeExtensions', e.target.value)}
                  placeholder="100,101,102"
                  className={inputClass}
                />
                <p className={hintClass}>Comma-separated extension numbers to hide</p>
              </div>
              <div>
                <label className={labelClass}>Filter Status</label>
                <div className="space-y-2 mt-2">
                  {(
                    [
                      { value: 'all', label: 'All statuses' },
                      { value: 'LoggedIn', label: 'Logged In Only' },
                      { value: 'LoggedOut', label: 'Logged Out Only' },
                    ] as { value: WidgetConfigs['loginStatus']['filterStatus']; label: string }[]
                  ).map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="filterStatus"
                        value={opt.value}
                        checked={local.loginStatus.filterStatus === opt.value}
                        onChange={() => updateLoginStatus('filterStatus', opt.value)}
                        className="accent-brand-purple"
                      />
                      <span className="text-sm text-hud-text">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeSection === 'callStats' && (
            <>
              <QueuePicker
                label="On-Call Queue"
                hint="The queue whose assigned agents are shown as the On-Call Engineer."
                value={local.callStats.onCallQueueId}
                onChange={(v) => setLocal((prev) => ({ ...prev, callStats: { ...prev.callStats, onCallQueueId: v } }))}
              />
              <div>
                <label className={labelClass}>Voicemail Extension</label>
                <input
                  type="text"
                  value={local.callStats.voicemailExtension}
                  onChange={(e) => setLocal((prev) => ({ ...prev, callStats: { ...prev.callStats, voicemailExtension: e.target.value } }))}
                  placeholder="201"
                  className={inputClass}
                />
                <p className={hintClass}>Extension number whose voicemails are counted for today. Leave blank to hide.</p>
              </div>
              <TrunkPicker
                label="Trunk Filter"
                hint="Only count calls on selected trunks. Leave all unchecked to include all trunks."
                value={local.callStats.trunkFilter}
                onChange={(v) => setLocal((prev) => ({ ...prev, callStats: { ...prev.callStats, trunkFilter: v } }))}
              />
              <div>
                <label className={labelClass}>Visible Metrics</label>
                <p className={hintClass + ' mb-3'}>Uncheck to hide a metric from the call stats row</p>
                <div className="space-y-2">
                  {ALL_METRIC_KEYS.map((key) => {
                    const hidden = getHiddenMetrics();
                    const checked = !hidden.includes(key);
                    return (
                      <label key={key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMetric(key)}
                          className="accent-brand-purple w-4 h-4"
                        />
                        <span className="text-sm text-hud-text">{CALL_METRIC_LABELS[key]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeSection === 'ticketStats' && (
            <BoardPicker
              label="Boards"
              hint="Only tickets on selected boards will be counted. Leave all unchecked for all boards."
              value={local.ticketStats.boardNames}
              onChange={updateTicketStatsBoardNames}
            />
          )}

          {activeSection === 'ticketsChart' && (
            <>
              <div>
                <label className={labelClass}>Exclude Members</label>
                <input
                  type="text"
                  value={local.ticketsChart.excludeMembers}
                  onChange={(e) => updateTicketsChart('excludeMembers', e.target.value)}
                  placeholder="akarki,scharters"
                  className={inputClass}
                />
                <p className={hintClass}>Comma-separated member identifiers to exclude</p>
              </div>
              <div>
                <label className={labelClass}>Max Entries</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={local.ticketsChart.maxEntries}
                  onChange={(e) => updateTicketsChart('maxEntries', e.target.value)}
                  className={inputClass}
                />
                <p className={hintClass}>Maximum number of members to display (default 10)</p>
              </div>
            </>
          )}

          {activeSection === 'priorityTickets' && (
            <>
              <ColumnPicker
                label="Columns"
                value={local.priorityTickets.columns}
                allColumns={TICKET_COLUMN_LABELS}
                onChange={(v) => updatePriorityTickets('columns', v)}
              />
              <div>
                <label className={labelClass}>Priorities</label>
                <input
                  type="text"
                  value={local.priorityTickets.includePriorities}
                  onChange={(e) => updatePriorityTickets('includePriorities', e.target.value)}
                  placeholder="1,2"
                  className={inputClass}
                />
                <p className={hintClass}>Comma-separated: 1 = Critical, 2 = High, 3 = Medium</p>
              </div>
              <BoardPicker
                label="Boards"
                hint="Leave all unchecked to use the Ticket Stats board selection."
                value={local.priorityTickets.boardNames}
                onChange={(v) => updatePriorityTickets('boardNames', v)}
              />
              <div>
                <label className={labelClass}>Max Rows</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={local.priorityTickets.maxRows}
                  onChange={(e) => updatePriorityTickets('maxRows', e.target.value)}
                  className={inputClass}
                />
                <p className={hintClass}>Maximum rows to display (default 20)</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-hud-border shrink-0">
          <button
            onClick={handleSave}
            className="w-full bg-brand-purple hover:bg-brand-light-purple text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
          >
            Save &amp; Refresh
          </button>
        </div>
      </div>
    </>
  );
}
