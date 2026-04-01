import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error('APP_ENCRYPTION_KEY is required for encrypted integrations.');
  }

  try {
    const key = Buffer.from(raw, 'base64');
    if (key.length === 32) return key;
  } catch {
    // Fall through to utf8/hash path below.
  }

  // Backward-friendly fallback: if not base64-32, derive fixed 32 bytes from provided string.
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptText(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptText(payload: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted payload format.');
  }
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function signPayload(rawPayload: string): string {
  const secret = process.env.APP_ENCRYPTION_KEY?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) {
    throw new Error('APP_ENCRYPTION_KEY (or CRON_SECRET) is required for signing.');
  }
  return crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
}
