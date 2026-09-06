import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const encodeBase32 = (input) => {
  const bytes = Buffer.from(input);
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

export const decodeBase32 = (encoded) => {
  const normalized = String(encoded).toUpperCase().replace(/=|\s|-/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) throw new Error('Invalid base32 secret');
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

export const generateTotpSecret = () => encodeBase32(crypto.randomBytes(20));

export const generateTotp = (secret, options = {}) => {
  const stepSeconds = options.stepSeconds || 30;
  const digits = options.digits || 6;
  const timestamp = options.timestamp ?? Date.now();
  const counter = BigInt(Math.floor(timestamp / 1000 / stepSeconds));
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(counter);

  const digest = crypto
    .createHmac('sha1', decodeBase32(secret))
    .update(counterBytes)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  ) >>> 0;

  return String(binary % (10 ** digits)).padStart(digits, '0');
};

export const verifyTotp = (secret, token, options = {}) => {
  const normalizedToken = String(token ?? '').replace(/\s/g, '');
  const digits = options.digits || 6;
  if (!new RegExp(`^\\d{${digits}}$`).test(normalizedToken)) return false;

  const timestamp = options.timestamp ?? Date.now();
  const stepSeconds = options.stepSeconds || 30;
  const window = options.window ?? 1;

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotp(secret, {
      timestamp: timestamp + offset * stepSeconds * 1000,
      stepSeconds,
      digits
    });
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedToken))) {
      return true;
    }
  }

  return false;
};

export const createTotpUri = ({ secret, accountName, issuer = 'HMS' }) => {
  const label = `${issuer}:${accountName}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
};
