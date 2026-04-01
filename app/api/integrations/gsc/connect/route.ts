import crypto from 'node:crypto';
import { AdminRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { prisma } from '@/lib/db';
import { buildGscAuthUrl } from '@/lib/integrations/google-oauth';
import { signPayload } from '@/lib/security/crypto';

interface ConnectState {
  websiteId: string;
  tenantId: string;
  nonce: string;
  exp: number;
}

function encodeState(state: ConnectState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  const sig = signPayload(payload);
  return `${payload}.${sig}`;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;
    const { auth } = authResult;

    const body = await request.json();
    const websiteId = String(body.websiteId || '').trim();
    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { id: true, tenantId: true },
    });

    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    if (!auth.isGlobal && auth.tenantId !== website.tenantId) {
      return NextResponse.json({ error: 'Forbidden: website outside tenant scope' }, { status: 403 });
    }

    const state = encodeState({
      websiteId: website.id,
      tenantId: website.tenantId,
      nonce: crypto.randomBytes(12).toString('hex'),
      exp: Date.now() + 10 * 60 * 1000,
    });

    const authUrl = buildGscAuthUrl(state);
    return NextResponse.json({ success: true, authUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start GSC connection' },
      { status: 500 }
    );
  }
}
