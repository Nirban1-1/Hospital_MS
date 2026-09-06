import crypto from 'crypto';

let devKeyPair;
let warnedAboutDevKeys = false;

const base64UrlJson = (value) => Buffer
  .from(JSON.stringify(value))
  .toString('base64url');

const readKey = (key) => key?.replace(/\\n/g, '\n');

const getSigningKeys = () => {
  const configuredPrivateKey = readKey(process.env.SESSION_PRIVATE_KEY);
  const configuredPublicKey = readKey(process.env.SESSION_PUBLIC_KEY);

  if (configuredPrivateKey && configuredPublicKey) {
    return { privateKey: configuredPrivateKey, publicKey: configuredPublicKey };
  }

  if (!devKeyPair) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_PRIVATE_KEY and SESSION_PUBLIC_KEY are required in production');
    }
    if (!warnedAboutDevKeys) {
      console.warn('SESSION_PRIVATE_KEY/SESSION_PUBLIC_KEY not set. Using temporary development RSA keys.');
      warnedAboutDevKeys = true;
    }

    devKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
  }

  return devKeyPair;
};

export const signSessionToken = (payload, options = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = options.expiresInSeconds || 7 * 24 * 60 * 60;
  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(body)}`;
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(signingInput), getSigningKeys().privateKey)
    .toString('base64url');

  return `${signingInput}.${signature}`;
};

export const verifySessionToken = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error('Invalid token format');
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;


  const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
  if (header.alg !== 'RS256' || header.typ !== 'JWT') {
    throw new Error('Unsupported token algorithm');
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const verified = crypto.verify(
    'RSA-SHA256',
    Buffer.from(signingInput),
    getSigningKeys().publicKey,
    Buffer.from(encodedSignature, 'base64url')
  );

  if (!verified) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
};
