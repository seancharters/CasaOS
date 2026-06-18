import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { HudConfig } from './types';
import { defaultConfig, defaultWidgetConfigs } from './types';

const CONFIG_DIR = process.env.HUD_CONFIG_DIR ?? join(homedir(), '.config', 'hud');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export function readConfig(): HudConfig {
  if (!existsSync(CONFIG_PATH)) {
    return defaultConfig;
  }
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<HudConfig>;
    return {
      connectwise: { ...defaultConfig.connectwise, ...(parsed.connectwise ?? {}) },
      threecx: { ...defaultConfig.threecx, ...(parsed.threecx ?? {}) },
      postgres: { ...defaultConfig.postgres!, ...(parsed.postgres ?? {}) },
      dashboard: {
        loginStatus: { ...defaultWidgetConfigs.loginStatus, ...(parsed.dashboard?.loginStatus ?? {}) },
        callStats: { ...defaultWidgetConfigs.callStats, ...(parsed.dashboard?.callStats ?? {}) },
        ticketStats: { ...defaultWidgetConfigs.ticketStats, ...(parsed.dashboard?.ticketStats ?? {}) },
        ticketsChart: { ...defaultWidgetConfigs.ticketsChart, ...(parsed.dashboard?.ticketsChart ?? {}) },
        priorityTickets: { ...defaultWidgetConfigs.priorityTickets, ...(parsed.dashboard?.priorityTickets ?? {}) },
      },
      dashboardSales: {
        loginStatus: { ...defaultWidgetConfigs.loginStatus, ...(parsed.dashboardSales?.loginStatus ?? {}) },
        callStats: { ...defaultWidgetConfigs.callStats, ...(parsed.dashboardSales?.callStats ?? {}) },
        ticketStats: { ...defaultWidgetConfigs.ticketStats, ...(parsed.dashboardSales?.ticketStats ?? {}) },
        ticketsChart: { ...defaultWidgetConfigs.ticketsChart, ...(parsed.dashboardSales?.ticketsChart ?? {}) },
        priorityTickets: { ...defaultWidgetConfigs.priorityTickets, ...(parsed.dashboardSales?.priorityTickets ?? {}) },
      },
    };
  } catch {
    return defaultConfig;
  }
}

export function writeConfig(config: HudConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function isConfigured(config: HudConfig): { connectwise: boolean; threecx: boolean; postgres: boolean } {
  return {
    connectwise: !!(
      config.connectwise.siteUrl &&
      config.connectwise.companyId &&
      config.connectwise.publicKey &&
      config.connectwise.privateKey &&
      config.connectwise.clientId
    ),
    threecx: !!(
      config.threecx.host &&
      config.threecx.clientId &&
      config.threecx.clientSecret
    ),
    postgres: !!(
      config.postgres?.host &&
      config.postgres?.database &&
      config.postgres?.username
    ),
  };
}
