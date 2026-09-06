import crypto from 'crypto';

const WRAPPED_KEY_PREFIX = 'wrapped:v1';
const ITERATIONS = 120000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

const deriveWrappingKey = (password, salt, iterations = ITERATIONS) => new Promise((resolve, reject) => {
  crypto.pbkdf2(password, salt, iterations, KEY_LENGTH, DIGEST, (error, key) => {
    if (error) reject(error);
    else resolve(key);
  });
});

export const wrapPrivateKey = async (privateKeyPem, password) => {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = await deriveWrappingKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKeyPem, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    WRAPPED_KEY_PREFIX,
    ITERATIONS,
    salt.toString('base64url'),
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url')
  ].join(':');
};

export const unwrapPrivateKey = async (wrappedPrivateKey, password) => {
  const parts = String(wrappedPrivateKey || '').split(':');
  if (typeof password !== 'string' || parts.length !== 7) {
    throw new Error('Malformed wrapped key');
  }
  const [prefix, version, iterationText, encodedSalt, encodedIv, encodedTag, encodedKey] = parts;
  const salt = Buffer.from(encodedSalt, 'base64url');
  const iv = Buffer.from(encodedIv, 'base64url');
  const tag = Buffer.from(encodedTag, 'base64url');
  const encrypted = Buffer.from(encodedKey, 'base64url');
  if (
    prefix !== 'wrapped' ||
    version !== 'v1' ||
    Number(iterationText) !== ITERATIONS ||
    salt.length !== 16 ||
    iv.length !== 12 ||
    tag.length !== 16 ||
    encrypted.length === 0
  ) {
    throw new Error('Malformed wrapped key');
  }

  const key = await deriveWrappingKey(password, salt, ITERATIONS);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]).toString('utf8');
};

export const generateUserKeyMaterial = async (password) => {
  const rsaKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const eccKeys = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  return {
    rsa_public_key: rsaKeys.publicKey,
    rsa_private_key_wrapped: await wrapPrivateKey(rsaKeys.privateKey, password),
    ecc_public_key: eccKeys.publicKey,
    ecc_private_key_wrapped: await wrapPrivateKey(eccKeys.privateKey, password)
  };
};

export const unwrapUserPrivateKeys = async (user, password) => {
  if (!user?.rsa_private_key_wrapped || !user?.ecc_private_key_wrapped) {
    throw new Error('User cryptographic key material is missing');
  }

  const [rsaPrivateKey, eccPrivateKey] = await Promise.all([
    unwrapPrivateKey(user.rsa_private_key_wrapped, password),
    unwrapPrivateKey(user.ecc_private_key_wrapped, password)
  ]);

  return { rsaPrivateKey, eccPrivateKey };
};

export const rewrapUserPrivateKeys = async (user, currentPassword, newPassword) => {
  const { rsaPrivateKey, eccPrivateKey } = await unwrapUserPrivateKeys(user, currentPassword);
  const [rsaPrivateKeyWrapped, eccPrivateKeyWrapped] = await Promise.all([
    wrapPrivateKey(rsaPrivateKey, newPassword),
    wrapPrivateKey(eccPrivateKey, newPassword)
  ]);

  return {
    rsa_private_key_wrapped: rsaPrivateKeyWrapped,
    ecc_private_key_wrapped: eccPrivateKeyWrapped
  };
};
