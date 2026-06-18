import { readConfig, isConfigured } from '@/lib/config';
import { fetchConnectWiseData } from '@/lib/connectwise';
import { fetch3CXData } from '@/lib/threecx';
import { fetchPostgresCallStats } from '@/lib/postgres';
import { emptyData, defaultWidgetConfigs } from '@/lib/types';
import { defaultDateRange, getPresetRange } from '@/lib/dateRange';
import type { DashboardData } from '@/lib/types';
import type { DateRange } from '@/lib/dateRange';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function parseDateRange(url: string): DateRange {
  try {
    const { searchParams } = new URL(url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from && to) return { preset: 'custom', from, to };
  } catch {}
  return defaultDateRange();
}

function parseDashboardKey(url: string): 'dashboard' | 'dashboardSales' {
  try {
    const { searchParams } = new URL(url);
    return searchParams.get('dashboard') === 'sales' ? 'dashboardSales' : 'dashboard';
  } catch {}
  return 'dashboard';
}

async function fetchData(dateRange: DateRange, dashboardKey: 'dashboard' | 'dashboardSales' = 'dashboard'): Promise<DashboardData> {
  const config = readConfig();
  const configured = isConfigured(config);
  const errors: string[] = [];
  const widgetCfg = config[dashboardKey] ?? defaultWidgetConfigs;

  let callStats = emptyData.callStats;
  let agentStatus = emptyData.agentStatus;
  let ticketStats = emptyData.ticketStats;
  let ticketsPerResource = emptyData.ticketsPerResource;
  let priorityTickets = emptyData.priorityTickets;
  const isDemo = !configured.connectwise && !configured.threecx;

  if (configured.threecx) {
    try {
      const data = await fetch3CXData(config.threecx, widgetCfg.callStats, dateRange);
      callStats = data.callStats;
      agentStatus = data.agentStatus;
      errors.push(...data.errors);
    } catch (e) {
      errors.push(`3CX: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Use PostgreSQL for call stats if configured and call log metrics are missing
  if (configured.postgres && config.postgres && callStats.totalCalls === null) {
    try {
      const pgData = await fetchPostgresCallStats(config.postgres, dateRange);
      callStats = { ...callStats, ...pgData.callStats };
      errors.push(...pgData.errors);
    } catch (e) {
      errors.push(`PostgreSQL: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (configured.connectwise) {
    try {
      const data = await fetchConnectWiseData(config.connectwise, widgetCfg, dateRange);
      ticketStats = data.ticketStats;
      ticketsPerResource = data.ticketsPerResource;
      priorityTickets = data.priorityTickets;
    } catch (e) {
      errors.push(`ConnectWise: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    callStats,
    agentStatus,
    ticketStats,
    ticketsPerResource,
    priorityTickets,
    lastUpdated: new Date().toISOString(),
    isDemo,
    errors,
  };
}

export async function GET(request: Request) {
  const dateRange = parseDateRange(request.url);
  const dashboardKey = parseDashboardKey(request.url);
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: DashboardData) => {
        if (!closed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }
      };

      const push = async () => {
        try {
          const data = await fetchData(dateRange, dashboardKey);
          send(data);
        } catch (e) {
          send({ ...emptyData, errors: [String(e)], lastUpdated: new Date().toISOString() });
        }
      };

      await push();

      const interval = setInterval(() => {
        if (closed) { clearInterval(interval); return; }
        push();
      }, 30000);

      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
