import crypto from 'crypto';

const ENCRYPTION_PREFIX_V1 = 'enc:v1:';
const ENCRYPTION_PREFIX_V2 = 'enc:v2:';
let warnedAboutFallbackKey = false;

const getMasterKey = () => {
  const configuredKey = process.env.ENCRYPTION_KEY;

  if (configuredKey) {
    if (/^[a-f0-9]{64}$/i.test(configuredKey)) {
      return Buffer.from(configuredKey, 'hex');
    }

    const base64Key = Buffer.from(configuredKey, 'base64');
    if (base64Key.length === 32) {
      return base64Key;
    }
  }

  if (!warnedAboutFallbackKey) {
    console.warn('ENCRYPTION_KEY is not set or invalid. Falling back to JWT_SECRET-derived key.');
    warnedAboutFallbackKey = true;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex or base64 value in production');
  }

  return crypto
    .createHash('sha256')
    .update(process.env.JWT_SECRET || 'hms-development-encryption-key')
    .digest();
};

export const isEncrypted = (value) => (
  typeof value === 'string' &&
  (value.startsWith(ENCRYPTION_PREFIX_V1) || value.startsWith(ENCRYPTION_PREFIX_V2))
);

const hmac = (value) => crypto
  .createHmac('sha256', getMasterKey())
  .update(value)
  .digest('base64url');

export const encryptValue = (value) => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  if (isEncrypted(value)) {
    return value;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64')
  ].join(':');
  const mac = hmac(payload);

  return `${ENCRYPTION_PREFIX_V2}${payload}:${mac}`;
};

export const decryptValue = (value) => {
  if (!isEncrypted(value)) {
    return value;
  }

  try {
    const prefix = value.startsWith(ENCRYPTION_PREFIX_V2)
      ? ENCRYPTION_PREFIX_V2
      : ENCRYPTION_PREFIX_V1;
    const parts = value.slice(prefix.length).split(':');
    const [iv, tag, encrypted, mac] = parts;

    if (prefix === ENCRYPTION_PREFIX_V2) {
      const payload = [iv, tag, encrypted].join(':');
      if (!mac || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(hmac(payload)))) {
        throw new Error('ciphertext MAC verification failed');
      }
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getMasterKey(),
      Buffer.from(iv, 'base64')
    );

    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final()
    ]).toString('utf8');
  } catch (error) {
    console.error('Failed to decrypt protected field:', error.message);
    return undefined;
  }
};

export const blindIndex = (value) => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return undefined;
  }

  return crypto
    .createHmac('sha256', getMasterKey())
    .update(String(value).trim().toLowerCase())
    .digest('hex');
};

export const encryptedString = (options = {}) => ({
  ...options,
  type: String,
  set: (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalized = options.trim === false ? value : value.trim();
    return encryptValue(normalized);
  },
  get: decryptValue
});

export const encryptionSchemaOptions = {
  toJSON: { getters: true },
  toObject: { getters: true }
};
