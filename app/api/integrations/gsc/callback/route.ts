import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { exchangeCodeForTokens } from '@/lib/integrations/google-oauth';
import { encryptText, signPayload } from '@/lib/security/crypto';

interface ParsedState {
  websiteId: string;
  tenantId: string;
  nonce: string;
  exp: number;
}

function parseState(rawState: string): ParsedState {
  const [payload, sig] = rawState.split('.');
  if (!payload || !sig) throw new Error('Invalid OAuth state format.');

  const expected = signPayload(payload);
  if (sig !== expected) throw new Error('Invalid OAuth state signature.');

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as ParsedState;
  if (!decoded.websiteId || !decoded.tenantId || !decoded.exp) {
    throw new Error('Invalid OAuth state payload.');
  }
  if (Date.now() > decoded.exp) {
    throw new Error('OAuth state expired.');
  }

  return decoded;
}

function redirectWithStatus(status: string, message: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const url = new URL('/admin/websites', appUrl);
  url.searchParams.set('gsc', status);
  if (message) url.searchParams.set('message', message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return redirectWithStatus('error', `Google returned: ${error}`);
  }

  if (!code || !state) {
    return redirectWithStatus('error', 'Missing OAuth code/state.');
  }

  try {
    const parsedState = parseState(state);
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refreshToken) {
      return redirectWithStatus(
        'error',
        'No refresh token from Google. Reconnect with consent and account permissions.'
      );
    }

    const updateResult = await prisma.website.updateMany({
      where: {
        id: parsedState.websiteId,
        tenantId: parsedState.tenantId,
      },
      data: {
        gscRefreshTokenEnc: encryptText(tokens.refreshToken),
        gscConnectedAt: new Date(),
      },
    });
    if (updateResult.count !== 1) {
      throw new Error('Website not found for OAuth state.');
    }

    return redirectWithStatus('connected', 'Google Search Console connected successfully.');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GSC OAuth callback failed.';
    return redirectWithStatus('error', message);
  }
}
