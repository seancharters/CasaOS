import type { HudConfig, WidgetConfigs } from './types';
import type { TicketStats, TicketResource, PriorityTicket } from './types';
import { dayStart, dayEnd } from './dateRange';
import type { DateRange } from './dateRange';

function cwHeaders(cfg: HudConfig['connectwise']): Record<string, string> {
  const credentials = Buffer.from(
    `${cfg.companyId}+${cfg.publicKey}:${cfg.privateKey}`
  ).toString('base64');
  return {
    Authorization: `Basic ${credentials}`,
    clientId: cfg.clientId,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function baseUrl(cfg: HudConfig['connectwise']): string {
  const host = cfg.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `https://${host}/v4_6_release/apis/3.0`;
}

async function cwFetch(
  cfg: HudConfig['connectwise'],
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${baseUrl(cfg)}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: cwHeaders(cfg),
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`ConnectWise API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function cwCount(
  cfg: HudConfig['connectwise'],
  path: string,
  conditions: string
): Promise<number> {
  const data = await cwFetch(cfg, `${path}/count`, { conditions }) as { count: number };
  return data.count ?? 0;
}

async function cwCountSafe(
  cfg: HudConfig['connectwise'],
  path: string,
  conditions: string
): Promise<number | null> {
  try {
    return await cwCount(cfg, path, conditions);
  } catch {
    return null;
  }
}

function cwDate(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return cwDate(d);
}

function hoursAgo(h: number): string {
  return cwDate(new Date(Date.now() - h * 60 * 60 * 1000));
}

function buildBoardFilter(boards: string[]): string {
  if (boards.length === 0) return '';
  if (boards.length === 1) return ` AND board/name = "${boards[0]}"`;
  return ` AND board/name in (${boards.map((b) => `"${b}"`).join(',')})`;
}

const PRIORITY_MAP: Record<string, string> = {
  '1': 'Priority 1 - Critical',
  '2': 'Priority 2 - High',
  '3': 'Priority 3 - Medium',
};

export async function fetchConnectWiseData(
  cfg: HudConfig['connectwise'],
  widgetCfg: WidgetConfigs,
  dateRange: DateRange
): Promise<{
  ticketStats: TicketStats;
  ticketsPerResource: TicketResource[];
  priorityTickets: PriorityTicket[];
}> {
  const base = `/service/tickets`;
  const open = `closedFlag=false`;

  // Board filter for ticket stats (supports multiple boards)
  const selectedBoards = widgetCfg.ticketStats.boardNames
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  const boardFilter = buildBoardFilter(selectedBoards);

  // Priority filter for priority tickets query
  const includePriorities = widgetCfg.priorityTickets.includePriorities
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const priorityNames = includePriorities
    .map((p) => PRIORITY_MAP[p])
    .filter(Boolean);
  const priorityCondition =
    priorityNames.length > 0
      ? priorityNames.map((n) => `"${n}"`).join(',')
      : '"Priority 1 - Critical","Priority 2 - High"';

  // Board filter for priority tickets (falls back to ticketStats boards)
  const priorityBoardsList = widgetCfg.priorityTickets.boardNames
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  const effectivePriorityBoards = priorityBoardsList.length > 0 ? priorityBoardsList : selectedBoards;
  const priorityBoardFilter = buildBoardFilter(effectivePriorityBoards);

  const from = dayStart(dateRange.from);
  const to   = dayEnd(dateRange.to);
  const inRange = `(closedFlag=true OR closedFlag=false) AND dateEntered >= [${from}] AND dateEntered <= [${to}]`;
  const closedInRange = `closedFlag=true AND dateResolved >= [${from}] AND dateResolved <= [${to}]`;

  const [
    openCount,
    unassignedCount,
    openTodayCount,
    noUpdateCount,
    p1Count,
    p2Count,
    p3Count,
    closedTodayCount,
    resourceTickets,
    p12Tickets,
  ] = await Promise.all([
    cwCount(cfg, base, `${open}${boardFilter}`),
    cwCountSafe(cfg, base, `${open}${boardFilter} AND owner/id = null`),
    cwCountSafe(cfg, base, `${inRange}${boardFilter}`),
    cwCountSafe(cfg, base, `${open}${boardFilter} AND _info/lastUpdated < [${hoursAgo(48)}]`),
    cwCount(cfg, base, `${open}${boardFilter} AND priority/name like "Priority 1%"`),
    cwCount(cfg, base, `${open}${boardFilter} AND priority/name like "Priority 2%"`),
    cwCount(cfg, base, `${open}${boardFilter} AND priority/name like "Priority 3%"`),
    cwCountSafe(cfg, base, `${closedInRange}${boardFilter}`),
    cwFetch(cfg, base, {
      conditions: `${open}${boardFilter}`,
      fields: 'id,owner/identifier',
      pageSize: '1000',
    }),
    cwFetch(cfg, base, {
      conditions: `${open}${priorityBoardFilter} AND priority/name in (${priorityCondition})`,
      fields: 'id,company/name,priority/name,owner/identifier,summary,status/name',
      pageSize: '50',
      orderBy: 'priority/sort asc',
    }),
  ]);

  // Build resource map
  const resourceMap: Record<string, number> = {};
  for (const t of resourceTickets as { owner?: { identifier: string } }[]) {
    const name = t.owner?.identifier ?? 'Unassigned';
    resourceMap[name] = (resourceMap[name] ?? 0) + 1;
  }

  // Exclude members
  const excludeMembers = widgetCfg.ticketsChart.excludeMembers
    .split(',')
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);

  const maxEntries = Math.max(1, parseInt(widgetCfg.ticketsChart.maxEntries, 10) || 10);

  const ticketsPerResource: TicketResource[] = Object.entries(resourceMap)
    .filter(([k]) => k !== 'Unassigned')
    .filter(([k]) => !excludeMembers.includes(k.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxEntries)
    .map(([name, count]) => ({ name, count }));

  const priorityTickets: PriorityTicket[] = (
    p12Tickets as {
      id: number;
      company?: { name: string };
      priority?: { name: string };
      owner?: { identifier: string };
      summary: string;
      status?: { name: string };
    }[]
  ).map((t) => ({
    id: t.id,
    company: t.company?.name ?? '',
    priority: t.priority?.name ?? '',
    engineer: t.owner?.identifier ?? 'Unassigned',
    summary: t.summary,
    status: t.status?.name ?? '',
  }));

  return {
    ticketStats: {
      open: openCount,
      unassigned: unassignedCount,
      openToday: openTodayCount,
      noUpdateOver48h: noUpdateCount,
      p1Count,
      p2Count,
      p3Count,
      closedToday: closedTodayCount,
    },
    ticketsPerResource,
    priorityTickets,
  };
}
