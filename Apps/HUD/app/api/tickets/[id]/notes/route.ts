import { NextResponse } from 'next/server';
import { readConfig, isConfigured } from '@/lib/config';

export const dynamic = 'force-dynamic';

function cwBase(siteUrl: string) {
  return `https://${siteUrl}/v4_6_release/apis/3.0`;
}

function cwHeaders(cfg: { companyId: string; publicKey: string; privateKey: string; clientId: string }) {
  const token = Buffer.from(`${cfg.companyId}+${cfg.publicKey}:${cfg.privateKey}`).toString('base64');
  return { Authorization: `Basic ${token}`, clientId: cfg.clientId, Accept: 'application/json' };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const config = readConfig();
  const cfg = config.connectwise;

  const ticketId = parseInt(id, 10);
  if (isNaN(ticketId)) {
    return NextResponse.json({ ticket: null, notes: [], cwUrl: '' }, { status: 400 });
  }

  const cwUrl = `https://${cfg.siteUrl}/v4_6_release/services/system_io/Service/fv_sr100_request.rails?service_recid=${ticketId}&companyName=${cfg.companyId}`;

  if (!isConfigured(config).connectwise) {
    return NextResponse.json({ ticket: null, notes: [], cwUrl });
  }

  const headers = cwHeaders(cfg);
  const base    = cwBase(cfg.siteUrl);

  try {
    const [ticketRes, notesRes] = await Promise.all([
      fetch(`${base}/service/tickets/${ticketId}?fields=id,summary,status,priority,company,owner,resources`, {
        headers, cache: 'no-store',
      }),
      fetch(`${base}/service/tickets/${ticketId}/notes?${new URLSearchParams({ pageSize: '100', orderBy: 'id asc' })}`, {
        headers, cache: 'no-store',
      }),
    ]);

    const ticketRaw = ticketRes.ok
      ? (await ticketRes.json()) as {
          id: number; summary: string;
          status: { name: string }; priority: { name: string };
          company: { name: string }; owner: { name: string } | null; resources: string | null;
        }
      : null;

    const notesRaw = notesRes.ok
      ? (await notesRes.json()) as {
          id: number; text: string; dateCreated: string; createdBy: string;
          internalAnalysisFlag: boolean; resolutionFlag: boolean; detailDescriptionFlag: boolean;
          member: { name: string } | null;
        }[]
      : [];

    return NextResponse.json({
      ticket: ticketRaw ? {
        id:       ticketRaw.id,
        summary:  ticketRaw.summary ?? '',
        status:   ticketRaw.status?.name ?? '',
        priority: ticketRaw.priority?.name ?? '',
        company:  ticketRaw.company?.name ?? '',
        engineer: ticketRaw.owner?.name ?? ticketRaw.resources ?? '',
      } : null,
      notes: notesRaw.map((n) => ({
        id:         n.id,
        text:       n.text ?? '',
        dateCreated: n.dateCreated ?? '',
        author:     n.member?.name ?? n.createdBy ?? '',
        isInternal: !!n.internalAnalysisFlag,
        isResolution: !!n.resolutionFlag,
      })),
      cwUrl,
    });
  } catch (e) {
    return NextResponse.json({ ticket: null, notes: [], cwUrl, error: String(e) });
  }
}
