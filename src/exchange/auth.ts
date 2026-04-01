import crypto from 'crypto';

export function createNonce(): string {
  return Date.now().toString() + crypto.randomInt(1000).toString().padStart(3, '0');
}

export function signRequest(
  path: string,
  nonce: string,
  postData: string,
  secret: string
): string {
  const sha256Hash = crypto
    .createHash('sha256')
    .update(nonce + postData)
    .digest();

  const hmac = crypto
    .createHmac('sha512', Buffer.from(secret, 'base64'))
    .update(Buffer.concat([Buffer.from(path), sha256Hash]))
    .digest('base64');

  return hmac;
}
