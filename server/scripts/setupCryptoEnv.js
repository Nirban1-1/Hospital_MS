import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(scriptDirectory, '..', '.env');
const existingText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const parsed = dotenv.parse(existingText);
const newline = existingText.includes('\r\n') ? '\r\n' : '\n';

const replaceOrAppend = (text, key, value) => {
  const serialized = JSON.stringify(value);
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, `${key}=${serialized}`);
  const separator = text && !text.endsWith('\n') ? newline : '';
  return `${text}${separator}${key}=${serialized}${newline}`;
};

let output = existingText;
const jwtSecret = parsed.JWT_SECRET || '';
if (!parsed.ENCRYPTION_KEY) {
  // This matches the legacy fallback exactly, so existing AES-encrypted fields remain readable.
  const compatibleKey = crypto.createHash('sha256')
    .update(jwtSecret || 'hms-development-encryption-key')
    .digest('hex');
  output = replaceOrAppend(output, 'ENCRYPTION_KEY', compatibleKey);
}

if (!parsed.SESSION_PRIVATE_KEY || !parsed.SESSION_PUBLIC_KEY) {
  const keys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  output = replaceOrAppend(output, 'SESSION_PRIVATE_KEY', keys.privateKey);
  output = replaceOrAppend(output, 'SESSION_PUBLIC_KEY', keys.publicKey);
}

fs.writeFileSync(envPath, output, { encoding: 'utf8', mode: 0o600 });
console.log('Crypto environment configured without changing the legacy data-encryption key.');
