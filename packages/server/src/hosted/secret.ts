import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// A stored Anthropic key: base64 of iv (12 bytes) | tag (16 bytes) | ciphertext, AES-256-GCM under EDWARD_SECRET, with
// its account's id (in decimal) as additional authenticated data, so a key opens only for the account it was sealed for.
const IV = 12;
const TAG = 16;

/** Seals the account's `key` under `secret` (32 bytes) with a fresh iv, so two seals of one key differ. */
export function sealKey(secret: Buffer, key: string, accountId: number): string {
  const iv = randomBytes(IV);
  const cipher = createCipheriv('aes-256-gcm', secret, iv);
  cipher.setAAD(Buffer.from(String(accountId)));
  const text = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), text]).toString('base64');
}

/** The key `sealed` holds; throws a fixed message, never a value, when it is too short or doesn't open under `secret`
 * for `accountId`. */
export function openKey(secret: Buffer, sealed: string, accountId: number): string {
  const bytes = Buffer.from(sealed, 'base64');
  try {
    if (bytes.length <= IV + TAG) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', secret, bytes.subarray(0, IV));
    decipher.setAAD(Buffer.from(String(accountId)));
    decipher.setAuthTag(bytes.subarray(IV, IV + TAG));
    return Buffer.concat([decipher.update(bytes.subarray(IV + TAG)), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('stored key does not open');
  }
}
