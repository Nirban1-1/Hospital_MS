import crypto from 'crypto';

const PBKDF2_PREFIX = 'pbkdf2:v1';
const ITERATIONS = 120000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

const toBase64Url = (buffer) => buffer.toString('base64url');

export const isPbkdf2Hash = (value) => (
  typeof value === 'string' && value.startsWith(`${PBKDF2_PREFIX}:`)
);

export const hashPassword = async (password) => {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('Password must be a non-empty string');
  }

  const salt = crypto.randomBytes(16);
  const derivedKey = await new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });

  return `${PBKDF2_PREFIX}:${ITERATIONS}:${toBase64Url(salt)}:${toBase64Url(derivedKey)}`;
};

export const verifyPassword = async (password, storedHash) => {
  if (typeof password !== 'string' || !isPbkdf2Hash(storedHash)) {
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length !== 5) return false;
  const [, , iterationText, encodedSalt, encodedHash] = parts;
  if (
    Number(iterationText) !== ITERATIONS ||
    !/^[A-Za-z0-9_-]+$/.test(encodedSalt) ||
    !/^[A-Za-z0-9_-]+$/.test(encodedHash)
  ) {
    return false;
  }

  const salt = Buffer.from(encodedSalt, 'base64url');
  const expected = Buffer.from(encodedHash, 'base64url');
  if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;

  try {
    const derivedKey = await new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (error, key) => {
        if (error) reject(error);
        else resolve(key);
      });
    });
    return crypto.timingSafeEqual(expected, derivedKey);
  } catch {
    return false;
  }
};
