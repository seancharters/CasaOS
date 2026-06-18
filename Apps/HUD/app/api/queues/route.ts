import { NextResponse } from 'next/server';
import { readConfig, isConfigured } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = readConfig();
  if (!isConfigured(config).threecx) {
    return NextResponse.json({ queues: [] });
  }

  const cfg = config.threecx;
  const raw = cfg.host.trim();
  const base = /^https?:\/\//i.test(raw) ? raw.replace(/\/$/, '') : `https://${raw.replace(/\/$/, '')}`;

  try {
    // Get token
    const tokenRes = await fetch(`${base}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(cfg.clientId)}&client_secret=${encodeURIComponent(cfg.clientSecret)}`,
      cache: 'no-store',
    });
    if (!tokenRes.ok) return NextResponse.json({ queues: [] });
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const res = await fetch(`${base}/xapi/v1/Queues?$select=Id,Name`, {
      headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ queues: [], error: `3CX ${res.status}` });

    const data = (await res.json()) as { value: { Id: number; Name: string }[] };
    const queues = (data.value ?? [])
      .map((q) => ({ id: String(q.Id), name: q.Name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ queues });
  } catch (e) {
    return NextResponse.json({ queues: [], error: String(e) });
  }
}
