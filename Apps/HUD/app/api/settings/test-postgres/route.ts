import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/postgres';
import type { HudConfig } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NonNullable<HudConfig['postgres']>;
    const result = await testConnection(body);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
