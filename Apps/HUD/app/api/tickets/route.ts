import { NextResponse } from 'next/server';
import { readConfig, isConfigured } from '@/lib/config';
import { defaultWidgetConfigs } from '@/lib/types';

export const dynamic = 'force-dynamic';

function buildBoardFilter(boards: string[]): string {
  if (boards.length === 0) return '';
  if (boards.length === 1) return ` AND board/name = "${boards[0]}"`;
  return ` AND board/name in (${boards.map((b) => `"${b}"`).join(',')})`;
}

function cwBase(siteUrl: string) {
  return `https://${siteUrl}/v4_6_release/apis/3.0`;
}

function cwHeaders(cfg: { companyId: string; publicKey: string; privateKey: string; clientId: string }) {
  const token = Buffer.from(`${cfg.companyId}+${cfg.publicKey}:${cfg.privateKey}`).toString('base64');
  return { Authorization: `Basic ${token}`, clientId: cfg.clientId, Accept: 'application/json' };
}

export async function GET(request: Request) {
  const config = readConfig();
  if (!isConfigured(config).connectwise) {
    return NextResponse.json({ tickets: [], total: 0 });
  }

  const cfg = config.connectwise;
  const widgetCfg = { ...defaultWidgetConfigs, ...(config.dashboard ?? {}) };
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') ?? 'open';
  const from   = searchParams.get('from');
  const to     = searchParams.get('to');

  // Build board filter matching the same logic used for KPI counts
  const selectedBoards = widgetCfg.ticketStats.boardNames
    .split(',').map((b) => b.trim()).filter(Boolean);
  const boardFilter = buildBoardFilter(selectedBoards);

  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const fromTs = from ? `${from}T00:00:00` : null;
  const toTs   = to   ? `${to}T23:59:59`   : null;

  let conditions: string;
  switch (filter) {
    case 'open':
      conditions = `closedFlag=false${boardFilter}`;
      break;
    case 'unassigned':
      conditions = `closedFlag=false AND owner/id = null${boardFilter}`;
      break;
    case 'p1':
      conditions = `closedFlag=false AND priority/name like "Priority 1%"${boardFilter}`;
      break;
    case 'p2':
      conditions = `closedFlag=false AND priority/name like "Priority 2%"${boardFilter}`;
      break;
    case 'p3':
      conditions = `closedFlag=false AND priority/name like "Priority 3%"${boardFilter}`;
      break;
    case 'noUpdate48h':
      conditions = `closedFlag=false AND _info/lastUpdated < [${cutoff48h}]${boardFilter}`;
      break;
    case 'openToday':
      conditions = fromTs && toTs
        ? `(closedFlag=true OR closedFlag=false) AND dateEntered>=[${fromTs}] AND dateEntered<=[${toTs}]${boardFilter}`
        : `(closedFlag=true OR closedFlag=false)${boardFilter}`;
      break;
    case 'closedToday':
      conditions = fromTs && toTs
        ? `closedFlag=true AND dateResolved>=[${fromTs}] AND dateResolved<=[${toTs}]${boardFilter}`
        : `closedFlag=true${boardFilter}`;
      break;
    default:
      conditions = `closedFlag=false${boardFilter}`;
  }

  const qs = new URLSearchParams({
    conditions,
    fields: 'id,summary,status,priority,company,owner,resources,_info',
    pageSize: '100',
    page: '1',
    orderBy: 'id desc',
  });

  try {
    const res = await fetch(`${cwBase(cfg.siteUrl)}/service/tickets?${qs}`, {
      headers: cwHeaders(cfg),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ tickets: [], total: 0, error: `CW ${res.status}` });
    }
    const raw = (await res.json()) as {
      id: number;
      summary: string;
      status: { name: string };
      priority: { name: string };
      company: { name: string };
      owner: { name: string } | null;
      resources: string | null;
      _info?: { lastUpdated?: string };
    }[];

    const tickets = raw.map((t) => ({
      id: t.id,
      summary: t.summary ?? '',
      status: t.status?.name ?? '',
      priority: t.priority?.name ?? '',
      company: t.company?.name ?? '',
      engineer: t.owner?.name ?? t.resources ?? '',
      lastUpdated: t._info?.lastUpdated ?? null,
    }));

    return NextResponse.json({
      tickets,
      total: tickets.length,
      cwSiteUrl: cfg.siteUrl,
      cwCompanyId: cfg.companyId,
    });
  } catch (e) {
    return NextResponse.json({ tickets: [], total: 0, error: String(e) });
  }
}
