import { NextResponse } from 'next/server';
import { readConfig, isConfigured } from '@/lib/config';
import { fetchConnectWiseData } from '@/lib/connectwise';
import { fetch3CXData } from '@/lib/threecx';
import { fetchPostgresCallStats } from '@/lib/postgres';
import { emptyData, defaultWidgetConfigs } from '@/lib/types';
import { defaultDateRange } from '@/lib/dateRange';
import type { DashboardData } from '@/lib/types';
import type { DateRange } from '@/lib/dateRange';

export const dynamic = 'force-dynamic';

function parseDateRange(request: Request): DateRange {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from && to) return { preset: 'custom', from, to };
  } catch {}
  return defaultDateRange();
}

export async function GET(request: Request): Promise<NextResponse<DashboardData>> {
  const dateRange = parseDateRange(request);
  const { searchParams } = new URL(request.url);
  const dashboardKey = searchParams.get('dashboard') === 'sales' ? 'dashboardSales' : 'dashboard';
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

  return NextResponse.json({
    callStats,
    agentStatus,
    ticketStats,
    ticketsPerResource,
    priorityTickets,
    lastUpdated: new Date().toISOString(),
    isDemo,
    errors,
  });
}
