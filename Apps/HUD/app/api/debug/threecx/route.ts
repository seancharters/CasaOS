import { NextResponse } from 'next/server';
import { readConfig, isConfigured } from '@/lib/config';

export const dynamic = 'force-dynamic';

async function probe(label: string, fetchFn: () => Promise<Response>) {
  try {
    const res = await fetchFn();
    let body: unknown;
    const text = await res.text();
    try { body = JSON.parse(text); } catch { body = text; }
    return { label, status: res.status, ok: res.ok, body };
  } catch (e) {
    return { label, status: 0, ok: false, body: String(e) };
  }
}

export async function GET() {
  const config = readConfig();
  if (!isConfigured(config).threecx) {
    return NextResponse.json({ error: '3CX not configured' }, { status: 400 });
  }

  const cfg = config.threecx;
  const raw = cfg.host.trim();
  const base = /^https?:\/\//i.test(raw) ? raw.replace(/\/$/, '') : `https://${raw.replace(/\/$/, '')}`;

  // Step 1 — get token
  const body = [
    'grant_type=client_credentials',
    `client_id=${encodeURIComponent(cfg.clientId)}`,
    `client_secret=${encodeURIComponent(cfg.clientSecret)}`,
  ].join('&');

  const tokenResult = await probe('POST /connect/token', () =>
    fetch(`${base}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  );

  let token: string | null = null;
  if (tokenResult.ok && typeof tokenResult.body === 'object' && tokenResult.body !== null) {
    token = (tokenResult.body as Record<string, unknown>).access_token as string ?? null;
  }

  if (!token) {
    return NextResponse.json({ tokenResult, error: 'Could not get token' });
  }

  const authHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // Probe key endpoints
  const today = new Date().toISOString().slice(0, 10);
  const filter = encodeURIComponent(`StartTime ge ${today}T00:00:00Z and StartTime le ${today}T23:59:59Z`);

  const results = await Promise.all([
    probe('GET /xapi/v1/ExtensionStatus (first 3)', () =>
      fetch(`${base}/xapi/v1/ExtensionStatus?$top=3`, { headers: authHeaders })
    ),
    probe('GET /xapi/v1/ActiveCalls', () =>
      fetch(`${base}/xapi/v1/ActiveCalls`, { headers: authHeaders })
    ),
    probe(`GET /xapi/v1/ReportCallLogData?$top=3&$filter=today`, () =>
      fetch(`${base}/xapi/v1/ReportCallLogData?$top=3&$filter=${filter}`, { headers: authHeaders })
    ),
    probe('GET /xapi/v1/ReportCallLogData?$top=3 (no filter)', () =>
      fetch(`${base}/xapi/v1/ReportCallLogData?$top=3`, { headers: authHeaders })
    ),
  ]);

  return NextResponse.json({ base, tokenResult: { status: tokenResult.status, ok: tokenResult.ok }, results }, { status: 200 });
}
