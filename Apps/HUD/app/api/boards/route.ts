import { NextResponse } from 'next/server';
import { readConfig, isConfigured } from '@/lib/config';

export const dynamic = 'force-dynamic';

interface CWBoard {
  id: number;
  name: string;
}

export async function GET() {
  const config = readConfig();
  if (!isConfigured(config).connectwise) {
    return NextResponse.json({ boards: [] });
  }

  const cfg = config.connectwise;
  const credentials = Buffer.from(`${cfg.companyId}+${cfg.publicKey}:${cfg.privateKey}`).toString('base64');
  const host = cfg.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${host}/v4_6_release/apis/3.0/service/boards?fields=id,name&pageSize=1000&orderBy=name asc`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${credentials}`,
        clientId: cfg.clientId,
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ boards: [], error: `ConnectWise ${res.status}` });
    }

    const data = (await res.json()) as CWBoard[];
    const boards = data.map((b) => b.name).filter(Boolean).sort();
    return NextResponse.json({ boards });
  } catch (e) {
    return NextResponse.json({ boards: [], error: String(e) });
  }
}
