import type { HudConfig, WidgetConfigs } from './types';
import type { AgentStatus, CallStats, ActiveCall } from './types';
import { dayStart, dayEnd } from './dateRange';
import type { DateRange } from './dateRange';

let tokenCache: { token: string; expiresAt: number } | null = null;
let tokenInflight: Promise<string> | null = null;

function cxBaseUrl(cfg: HudConfig['threecx']): string {
  const raw = cfg.host.trim();
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
}

async function fetchNewToken(cfg: HudConfig['threecx']): Promise<string> {
  const base = cxBaseUrl(cfg);
  const body = [
    'grant_type=client_credentials',
    `client_id=${encodeURIComponent(cfg.clientId)}`,
    `client_secret=${encodeURIComponent(cfg.clientSecret)}`,
  ].join('&');

  const res = await fetch(`${base}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`3CX auth failed ${res.status}: ${text || '(empty response — check client ID/secret and host URL)'}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

async function getToken(cfg: HudConfig['threecx']): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.token;
  }
  // Deduplicate concurrent token fetches so only one HTTP request is made
  if (!tokenInflight) {
    tokenInflight = fetchNewToken(cfg).finally(() => { tokenInflight = null; });
  }
  return tokenInflight;
}

async function cxFetch(cfg: HudConfig['threecx'], path: string): Promise<{ data: unknown; status: number }> {
  const doFetch = async (token: string) => {
    const res = await fetch(`${cxBaseUrl(cfg)}/xapi/v1${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    return { data, status: res.status };
  };

  const result = await doFetch(await getToken(cfg));

  // Token may have been invalidated externally (3CX revokes previous token on new issue)
  // Clear cache and retry once with a fresh token
  if (result.status === 401) {
    tokenCache = null;
    return doFetch(await getToken(cfg));
  }

  return result;
}

function parseDuration(d: string | number | null | undefined): number {
  if (!d) return 0;
  // OData returns Duration as "PT2M30S" or seconds as number
  if (typeof d === 'number') return d;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? '0') * 3600) + (parseInt(m[2] ?? '0') * 60) + Math.round(parseFloat(m[3] ?? '0'));
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function mapStatus(
  queueStatus: string,
  isRegistered: boolean
): AgentStatus['status'] {
  if (!isRegistered) return 'LoggedOut';
  return queueStatus === 'LoggedIn' ? 'LoggedIn' : 'LoggedOut';
}

export async function fetch3CXData(
  cfg: HudConfig['threecx'],
  widgetCfg: WidgetConfigs['callStats'],
  dateRange: DateRange
): Promise<{
  callStats: CallStats;
  agentStatus: AgentStatus[];
  errors: string[];
}> {
  const errors: string[] = [];

  // --- Agent status via Users endpoint ---
  const { data: usersData, status: usersStatus } = await cxFetch(
    cfg,
    '/Users?$select=Number,DisplayName,CurrentProfileName,IsRegistered,QueueStatus'
  );

  let agentStatus: AgentStatus[] = [];
  if (usersStatus === 200) {
    const users = (usersData as { value: {
      Number: string;
      DisplayName: string;
      CurrentProfileName: string;
      IsRegistered: boolean;
      QueueStatus: string;
    }[] }).value ?? [];

    agentStatus = users
      .filter((u) => u.DisplayName && u.Number)
      .map((u) => ({
        name: u.DisplayName,
        extension: u.Number,
        status: mapStatus(u.QueueStatus, u.IsRegistered),
      }))
      .sort((a, b) => parseInt(a.extension) - parseInt(b.extension));
  } else {
    errors.push(`3CX Users ${usersStatus}: could not load agent status`);
  }

  // --- Active calls ---
  const { data: activeCallsData, status: activeCallsStatus } = await cxFetch(cfg, '/ActiveCalls');
  const activeCalls: ActiveCall[] = [];
  if (activeCallsStatus === 200) {
    const raw = (activeCallsData as { value: {
      Caller: string;
      Callee: string;
      Status: string;
      EstablishedAt: string | null;
      ServerNow: string;
    }[] }).value ?? [];
    for (const c of raw) {
      const durationSecs = c.EstablishedAt
        ? Math.floor((new Date(c.ServerNow).getTime() - new Date(c.EstablishedAt).getTime()) / 1000)
        : 0;
      activeCalls.push({ caller: c.Caller, callee: c.Callee, duration: formatDuration(durationSecs) });
    }
  }

  // --- On-call engineer from configured queue ---
  let onCallEngineer: string | null = null;
  const queueId = widgetCfg.onCallQueueId.trim();
  if (queueId) {
    const { data: queueData, status: queueStatus } = await cxFetch(cfg, `/Queues(${queueId})/Agents`);
    if (queueStatus === 200) {
      const agents = (queueData as { value: { Name: string; Number: string }[] }).value ?? [];
      if (agents.length > 0) {
        onCallEngineer = agents.map((a) => `${a.Name} (${a.Number})`).join(', ');
      }
    }
  }

  // --- Call log ---
  const from = dayStart(dateRange.from);
  const to   = dayEnd(dateRange.to);
  const filter = encodeURIComponent(`StartTime ge ${from} and StartTime le ${to}`);
  const { data: callLogData, status: callLogStatus } = await cxFetch(
    cfg,
    `/CallLogData?$filter=${filter}`
  );

  // --- Voicemail count ---
  let voicemailCount: number | null = null;
  const vmExt = widgetCfg.voicemailExtension.trim();
  if (vmExt) {
    const vmFilter = encodeURIComponent(
      `ExtensionNumber eq '${vmExt}' and ReceivedAt ge ${from} and ReceivedAt le ${to}`
    );
    const { data: vmData, status: vmStatus } = await cxFetch(cfg, `/Voicemails?$filter=${vmFilter}`);
    if (vmStatus === 200) {
      const vms = (vmData as { value: unknown[] }).value ?? [];
      voicemailCount = vms.length;
    }
    // 404 = endpoint not available; silently ignored
  }

  let callStats: CallStats = {
    pctAnswered: null,
    answeredOverflow: null,
    missedCalls: null,
    totalCalls: null,
    avgTalkDuration: null,
    avgCallDuration: null,
    onCallEngineer,
    afterHoursCalls: null,
    activeCalls,
    voicemailCount,
  };

  if (callLogStatus === 200) {
    const allCallLog = (callLogData as { value: {
      Direction: string;
      TalkingDuration: string | number | null;
      RingingDuration: string | number | null;
      Answered: boolean;
      CallType?: string;
      TrunkName?: string;
    }[] }).value ?? [];

    const trunks = widgetCfg.trunkFilter.split(',').map((t) => t.trim()).filter(Boolean);
    const callLog = trunks.length > 0
      ? allCallLog.filter((c) => c.TrunkName && trunks.includes(c.TrunkName))
      : allCallLog;

    const inbound = callLog.filter((c) => c.Direction === 'Inbound');
    const answered = inbound.filter((c) => c.Answered);
    const missed   = inbound.filter((c) => !c.Answered);

    const avgTalk = answered.length > 0
      ? Math.round(answered.reduce((s, c) => s + parseDuration(c.TalkingDuration), 0) / answered.length)
      : 0;
    const avgRing = inbound.length > 0
      ? Math.round(inbound.reduce((s, c) => s + parseDuration(c.RingingDuration), 0) / inbound.length)
      : 0;
    const pct = inbound.length > 0 ? Math.round((answered.length / inbound.length) * 100) : 0;

    callStats = {
      pctAnswered: pct,
      answeredOverflow: null,
      missedCalls: missed.length,
      totalCalls: inbound.length,
      avgTalkDuration: formatDuration(avgTalk),
      avgCallDuration: formatDuration(avgRing),
      onCallEngineer,
      afterHoursCalls: null,
      activeCalls,
      voicemailCount,
    };
  } else if (callLogStatus === 403) {
    errors.push('3CX call log: permission denied — grant the API client access to Call Log in 3CX Admin → Users & Auth → API');
  } else if (callLogStatus === 404) {
    // Endpoint removed in 3CX v20 — silently ignored, PostgreSQL provides call stats instead
  } else {
    errors.push(`3CX call log: unexpected error ${callLogStatus}`);
  }

  return { callStats, agentStatus, errors };
}
