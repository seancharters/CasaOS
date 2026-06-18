'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import TicketsBarChart from '@/components/dashboard/TicketsBarChart';
import TicketsTable from '@/components/dashboard/TicketsTable';
import TicketListModal from '@/components/dashboard/TicketListModal';
import TicketDetailModal from '@/components/dashboard/TicketDetailModal';
import { emptyData, defaultWidgetConfigs } from '@/lib/types';
import type { DashboardData, WidgetConfigs } from '@/lib/types';
import { useCallback } from 'react';
import { defaultDateRange } from '@/lib/dateRange';
import type { DateRange } from '@/lib/dateRange';
import { Phone, Users, AlertTriangle } from 'lucide-react';
import ConfigDrawer from '@/components/dashboard/ConfigDrawer';

// ─── small helpers ────────────────────────────────────────────────────────────

function KpiLarge({
  label,
  value,
  color,
  onClick,
}: {
  label: string;
  value: string | number | null;
  color: string;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={`flex flex-col gap-1 ${onClick ? 'cursor-pointer group' : ''}`}
    >
      <span className={`text-hud-muted text-xs font-semibold uppercase tracking-wider transition-colors ${onClick ? 'group-hover:text-hud-text' : ''}`}>
        {label}
      </span>
      <span className={`text-5xl font-bold tabular-nums leading-none transition-opacity ${color} ${onClick ? 'group-hover:opacity-80' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function KpiSmall({
  label,
  value,
  color = 'text-hud-text',
  onClick,
}: {
  label: string;
  value: string | number | null;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={`flex flex-col gap-0.5 ${onClick ? 'cursor-pointer group' : ''}`}
    >
      <span className={`text-hud-muted text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${onClick ? 'group-hover:text-hud-text' : ''}`}>
        {label}
      </span>
      <span className={`text-2xl font-bold tabular-nums leading-none transition-opacity ${color} ${onClick ? 'group-hover:opacity-80' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function cleanCallParty(s: string): string {
  const match = s.match(/\(([^)]+)\)\s*$/);
  return match ? match[1] : s;
}

function PhoneStat({
  label,
  value,
  color = 'text-hud-text',
}: {
  label: string;
  value: string | number | null;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-hud-muted text-xs font-semibold uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-semibold tabular-nums ${color}`}>{value ?? '—'}</span>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData]               = useState<DashboardData>(emptyData);
  const [connected, setConnected]     = useState(false);
  const [widgetConfigs, setWidgetConfigs] = useState<WidgetConfigs>(defaultWidgetConfigs);
  const [dateRange, setDateRange]     = useState<DateRange>(defaultDateRange);
  const [cwSiteUrl, setCwSiteUrl]     = useState('');
  const [cwCompanyId, setCwCompanyId] = useState('');
  const [editingWidget, setEditingWidget] = useState<keyof WidgetConfigs | null>(null);

  // Modal state — both can coexist; detail renders on top (z-[60/70] vs z-[40/50])
  const [listModal, setListModal]       = useState<{ filter: string; label: string } | null>(null);
  const [detailTicketId, setDetailTicketId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg?.dashboard) setWidgetConfigs({ ...defaultWidgetConfigs, ...cfg.dashboard });
        if (cfg?.connectwise?.siteUrl)   setCwSiteUrl(cfg.connectwise.siteUrl);
        if (cfg?.connectwise?.companyId) setCwCompanyId(cfg.connectwise.companyId);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to, dashboard: 'support' });
    const es = new EventSource(`/api/sse?${params}`);
    es.onopen    = () => setConnected(true);
    es.onmessage = (e) => { try { setData(JSON.parse(e.data as string) as DashboardData); setConnected(true); } catch {} };
    es.onerror   = () => setConnected(false);
    return () => es.close();
  }, [dateRange.from, dateRange.to]);

  const handleSaveConfig = useCallback(
    async (newConfigs: WidgetConfigs) => {
      setWidgetConfigs(newConfigs);
      setEditingWidget(null);
      try {
        const current = await fetch('/api/settings').then((r) => r.json());
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...current, dashboard: newConfigs }),
        });
      } catch {}
      try {
        const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to, dashboard: 'support' });
        const refreshed = await fetch(`/api/data?${params}`).then((r) => r.json()) as DashboardData;
        setData(refreshed);
      } catch {}
    },
    [dateRange.from, dateRange.to]
  );

  const { callStats, ticketStats, ticketsPerResource, priorityTickets } = data;

  const filteredAgents = data.agentStatus.filter((a) => {
    const excluded = widgetConfigs.loginStatus.excludeExtensions.split(',').map((e) => e.trim()).filter(Boolean);
    return !excluded.includes(a.extension);
  });
  const agentsOnline  = filteredAgents.filter((a) => a.status === 'LoggedIn').length;
  const agentsOffline = filteredAgents.filter((a) => a.status === 'LoggedOut').length;

  const maxChartEntries = Math.max(1, parseInt(widgetConfigs.ticketsChart.maxEntries, 10) || 10);
  const maxRows         = Math.max(1, parseInt(widgetConfigs.priorityTickets.maxRows, 10) || 20);
  const ticketColumns   = widgetConfigs.priorityTickets.columns.split(',').map((c) => c.trim()).filter(Boolean);

  const pctAnswered = callStats.pctAnswered;
  const missedCalls = callStats.missedCalls ?? 0;
  const p1Count     = ticketStats.p1Count ?? 0;
  const unassigned  = ticketStats.unassigned ?? 0;
  const noUpdate48h = ticketStats.noUpdateOver48h ?? 0;
  const p2Count     = ticketStats.p2Count ?? 0;

  const pctColor =
    pctAnswered === null ? 'text-hud-muted'
    : pctAnswered >= 90  ? 'text-green-400'
    : pctAnswered >= 70  ? 'text-brand-orange'
    : 'text-red-400';

  const openModal  = (filter: string, label: string) => setListModal({ filter, label });
  const openDetail = (id: number) => setDetailTicketId(id);
  const closeAll   = () => { setListModal(null); setDetailTicketId(null); };

  return (
    <div className="flex flex-col min-h-screen bg-hud-bg">
      <Header
        lastUpdated={data.lastUpdated}
        isDemo={data.isDemo}
        hasErrors={data.errors.length > 0}
        isConnected={connected}
        editMode={editingWidget !== null}
        onToggleEditMode={() => setEditingWidget((v) => v ? null : 'loginStatus')}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      <main className="flex-1 p-4">
        {data.errors.length > 0 && (
          <div className="mb-3 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
            <div className="text-red-400 text-xs space-y-0.5">
              {data.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-3">

          {/* ── LEFT: Team + Phone ────────────────────────────── */}
          <div className="col-span-4 flex flex-col gap-3">

            <div className="bg-hud-card border border-hud-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-hud-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={13} className="text-hud-muted" />
                  <span className="text-hud-text text-sm font-semibold">Team Status</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {agentsOnline} logged in
                  </span>
                  <span className="flex items-center gap-1.5 text-red-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {agentsOffline} logged out
                  </span>
                </div>
              </div>
              <div className="divide-y divide-hud-border/40">
                {filteredAgents.map((agent) => (
                  <div key={agent.extension} className="px-4 py-2.5 flex items-center gap-3 hover:bg-hud-border/10 transition-colors">
                    <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${agent.status === 'LoggedIn' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-hud-text text-base flex-1 min-w-0 truncate">{agent.name}</span>
                    <span className="text-hud-muted text-sm font-mono shrink-0">{agent.extension}</span>
                    <span className={`text-sm font-medium shrink-0 w-24 text-right ${agent.status === 'LoggedIn' ? 'text-green-400' : 'text-red-400'}`}>
                      {agent.status === 'LoggedIn' ? 'Logged In' : 'Logged Out'}
                    </span>
                  </div>
                ))}
                {filteredAgents.length === 0 && (
                  <div className="px-4 py-4 text-hud-muted text-sm text-center">No agents</div>
                )}
              </div>
            </div>

            <div className="bg-hud-card border border-hud-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-hud-border flex items-center gap-2">
                <Phone size={13} className="text-hud-muted" />
                <span className="text-hud-text text-sm font-semibold">Phone</span>
              </div>
              <div className="px-4 py-3 border-b border-hud-border/50">
                <div className="text-hud-muted text-[10px] font-semibold uppercase tracking-wider mb-1">On-Call Engineer</div>
                <div className={`text-sm font-semibold ${callStats.onCallEngineer ? 'text-green-400' : 'text-hud-muted'}`}>
                  {callStats.onCallEngineer ?? '—'}
                </div>
              </div>
              <div className="px-4 py-3 border-b border-hud-border/50">
                <div className="text-hud-muted text-[10px] font-semibold uppercase tracking-wider mb-1.5">Active Calls</div>
                {callStats.activeCalls.length === 0 ? (
                  <span className="text-hud-muted text-sm">None</span>
                ) : (
                  <div className="space-y-1.5">
                    {callStats.activeCalls.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-hud-text truncate">{cleanCallParty(c.caller)} → {cleanCallParty(c.callee)}</span>
                        <span className="text-hud-muted ml-2 shrink-0 font-mono">{c.duration}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 grid grid-cols-3 gap-x-4 gap-y-3">
                <PhoneStat label="Total Calls" value={callStats.totalCalls} />
                <PhoneStat label="Missed" value={callStats.missedCalls} color={missedCalls > 0 ? 'text-brand-orange' : 'text-hud-text'} />
                <PhoneStat label="% Answered" value={pctAnswered !== null ? `${pctAnswered}%` : null} color={pctColor} />
                <PhoneStat label="After Hours" value={callStats.afterHoursCalls} />
                <PhoneStat label="Avg Talk" value={callStats.avgTalkDuration} />
                <PhoneStat label="Avg Duration" value={callStats.avgCallDuration} />
                {widgetConfigs.callStats.voicemailExtension && (
                  <PhoneStat
                    label="Voicemails Today"
                    value={callStats.voicemailCount}
                    color={(callStats.voicemailCount ?? 0) > 0 ? 'text-brand-orange' : 'text-hud-text'}
                  />
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Tickets ────────────────────────────────── */}
          <div className="col-span-8 flex flex-col gap-3">

            <div className="bg-hud-card border border-hud-border rounded-xl p-4">
              <div className="grid grid-cols-3 gap-6 pb-4 border-b border-hud-border/50 mb-4">
                <KpiLarge
                  label="Open Tickets" value={ticketStats.open} color="text-brand-purple"
                  onClick={() => openModal('open', 'Open Tickets')}
                />
                <KpiLarge
                  label="Unassigned" value={ticketStats.unassigned}
                  color={unassigned === 0 ? 'text-green-400' : unassigned <= 5 ? 'text-brand-orange' : 'text-red-400'}
                  onClick={() => openModal('unassigned', 'Unassigned Tickets')}
                />
                <KpiLarge
                  label="P1 Tickets" value={p1Count}
                  color={p1Count > 0 ? 'text-red-400' : 'text-green-400'}
                  onClick={() => openModal('p1', 'P1 Tickets')}
                />
              </div>
              <div className="grid grid-cols-5 gap-4">
                <KpiSmall
                  label="P2" value={ticketStats.p2Count}
                  color={p2Count === 0 ? 'text-green-400' : p2Count <= 3 ? 'text-brand-orange' : 'text-red-400'}
                  onClick={() => openModal('p2', 'P2 Tickets')}
                />
                <KpiSmall
                  label="P3" value={ticketStats.p3Count} color="text-hud-muted-light"
                  onClick={() => openModal('p3', 'P3 Tickets')}
                />
                <KpiSmall
                  label=">48h No Update" value={ticketStats.noUpdateOver48h}
                  color={noUpdate48h === 0 ? 'text-hud-text' : noUpdate48h <= 5 ? 'text-brand-orange' : 'text-red-400'}
                  onClick={() => openModal('noUpdate48h', 'No Update >48h')}
                />
                <KpiSmall
                  label="Open Today" value={ticketStats.openToday}
                  onClick={() => openModal('openToday', 'Opened Today')}
                />
                <KpiSmall
                  label="Closed Today" value={ticketStats.closedToday} color="text-green-400"
                  onClick={() => openModal('closedToday', 'Closed Today')}
                />
              </div>
            </div>

            <div className="bg-hud-card border border-hud-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-hud-border">
                <span className="text-hud-text text-sm font-semibold">Open Tickets Per Resource</span>
              </div>
              <div className="p-3">
                <TicketsBarChart data={ticketsPerResource.slice(0, maxChartEntries)} />
              </div>
            </div>

            <div className="bg-hud-card border border-hud-border rounded-xl overflow-hidden flex-1">
              <div className="px-4 py-3 border-b border-hud-border">
                <span className="text-hud-text text-sm font-semibold">
                  Open Priority Tickets
                  {priorityTickets.length > 0 && (
                    <span className="ml-2 text-hud-muted text-xs font-normal">{priorityTickets.length}</span>
                  )}
                </span>
              </div>
              <TicketsTable
                tickets={priorityTickets.slice(0, maxRows)}
                visibleColumns={ticketColumns}
                onTicketClick={openDetail}
                cwSiteUrl={cwSiteUrl}
                cwCompanyId={cwCompanyId}
              />
            </div>
          </div>

        </div>
      </main>

      {/* List modal — z-40/50 */}
      {listModal && (
        <TicketListModal
          filter={listModal.filter}
          label={listModal.label}
          from={dateRange.from}
          to={dateRange.to}
          onClose={() => setListModal(null)}
          onTicketClick={openDetail}
        />
      )}

      {/* Detail modal — z-[60/70], sits above list modal */}
      {detailTicketId !== null && (
        <TicketDetailModal
          ticketId={detailTicketId}
          onClose={closeAll}
          onBack={listModal ? () => setDetailTicketId(null) : undefined}
        />
      )}

      {/* Config drawer */}
      <ConfigDrawer
        widgetKey={editingWidget}
        configs={widgetConfigs}
        onSave={handleSaveConfig}
        onClose={() => setEditingWidget(null)}
      />
    </div>
  );
}
