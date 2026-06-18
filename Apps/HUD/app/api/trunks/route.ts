import { NextResponse } from 'next/server';
import { readConfig, isConfigured } from '@/lib/config';
import { dayStart, dayEnd } from '@/lib/dateRange';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = readConfig();
  if (!isConfigured(config).threecx) {
    return NextResponse.json({ trunks: [] });
  }

  const cfg = config.threecx;
  const raw = cfg.host.trim();
  const base = /^https?:\/\//i.test(raw) ? raw.replace(/\/$/, '') : `https://${raw.replace(/\/$/, '')}`;

  try {
    const tokenRes = await fetch(`${base}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(cfg.clientId)}&client_secret=${encodeURIComponent(cfg.clientSecret)}`,
      cache: 'no-store',
    });
    if (!tokenRes.ok) return NextResponse.json({ trunks: [], error: `3CX auth ${tokenRes.status}` });
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const headers = { Authorization: `Bearer ${access_token}`, Accept: 'application/json' };

    // Try the dedicated Trunks endpoint first
    const trunkRes = await fetch(`${base}/xapi/v1/Trunks?$select=Id,Name`, { headers, cache: 'no-store' });
    if (trunkRes.ok) {
      const data = (await trunkRes.json()) as { value: { Id: number; Name: string }[] };
      const trunks = (data.value ?? []).map((t) => t.Name).filter(Boolean).sort();
      return NextResponse.json({ trunks });
    }

    // Fallback: derive unique trunk names from the last 30 days of call log
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const toDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const from = dayStart(toDate(thirtyDaysAgo));
    const to   = dayEnd(toDate(today));
    const filter = encodeURIComponent(`StartTime ge ${from} and StartTime le ${to}`);
    const logRes = await fetch(`${base}/xapi/v1/CallLogData?$filter=${filter}&$select=TrunkName`, { headers, cache: 'no-store' });
    if (!logRes.ok) return NextResponse.json({ trunks: [], error: `3CX call log ${logRes.status}` });

    const logData = (await logRes.json()) as { value: { TrunkName?: string }[] };
    const trunks = [...new Set(
      (logData.value ?? []).map((c) => c.TrunkName).filter((t): t is string => !!t)
    )].sort();

    return NextResponse.json({ trunks });
  } catch (e) {
    return NextResponse.json({ trunks: [], error: String(e) });
  }
}
