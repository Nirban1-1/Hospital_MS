import crypto from 'crypto';

const RSA_VALUE_PREFIX = 'rsa:v1:';
const RSA_ENVELOPE_PREFIX = 'rsa-envelope:v1:';
const ECC_ENVELOPE_PREFIX = 'ecc:v1:';
const CURVE = 'prime256v1';

const encodeEnvelope = (prefix, value) => (
  `${prefix}${Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')}`
);

const decodeEnvelope = (value, prefix) => {
  if (typeof value !== 'string' || !value.startsWith(prefix)) {
    throw new Error('Unsupported encrypted envelope format');
  }

  try {
    return JSON.parse(Buffer.from(value.slice(prefix.length), 'base64url').toString('utf8'));
  } catch {
    throw new Error('Malformed encrypted envelope');
  }
};

const asPlaintextBuffer = (value) => Buffer.from(
  typeof value === 'string' ? value : JSON.stringify(value),
  'utf8'
);

const deriveKeys = (sharedSecret, salt, purpose) => {
  const material = Buffer.from(crypto.hkdfSync(
    'sha256',
    sharedSecret,
    salt,
    Buffer.from(`hms:${purpose}:v1`, 'utf8'),
    64
  ));

  return {
    encryptionKey: material.subarray(0, 32),
    hmacKey: material.subarray(32)
  };
};

const deriveContentKeyMac = (contentKey, salt) => Buffer.from(crypto.hkdfSync(
  'sha256',
  contentKey,
  salt,
  Buffer.from('hms:rsa-envelope-hmac:v1', 'utf8'),
  32
));

const createMac = (key, values) => crypto
  .createHmac('sha256', key)
  .update(values.join('.'))
  .digest('base64url');

const macMatches = (expected, actual) => {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false;
  const expectedBytes = Buffer.from(expected, 'base64url');
  const actualBytes = Buffer.from(actual, 'base64url');
  return expectedBytes.length === actualBytes.length && crypto.timingSafeEqual(expectedBytes, actualBytes);
};

const exportEcPublicKey = (key) => key.export({ type: 'spki', format: 'der' }).toString('base64url');

const importEcPublicKey = (encodedKey) => crypto.createPublicKey({
  key: Buffer.from(encodedKey, 'base64url'),
  type: 'spki',
  format: 'der'
});

const encryptAesGcm = (plaintext, key, iv, aad) => {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, tag: cipher.getAuthTag() };
};

const decryptAesGcm = (ciphertext, key, iv, tag, aad) => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

export const rsaEncrypt = (value, publicKeyPem) => {
  const ciphertext = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    asPlaintextBuffer(value)
  );

  return `${RSA_VALUE_PREFIX}${ciphertext.toString('base64url')}`;
};

export const rsaDecrypt = (encryptedValue, privateKeyPem) => {
  if (typeof encryptedValue !== 'string' || !encryptedValue.startsWith(RSA_VALUE_PREFIX)) {
    throw new Error('Unsupported RSA ciphertext format');
  }

  return crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(encryptedValue.slice(RSA_VALUE_PREFIX.length), 'base64url')
  ).toString('utf8');
};

// RSA encrypts the random content key; AES-GCM handles records larger than one RSA block.
// When an ECC key is supplied, the independent ciphertext MAC key comes from ephemeral ECDH.
export const encryptRsaEnvelope = (value, rsaPublicKeyPem, eccPublicKeyPem) => {
  const contentKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const salt = crypto.randomBytes(16);
  const { ciphertext, tag } = encryptAesGcm(
    asPlaintextBuffer(value),
    contentKey,
    iv,
    'hms:rsa-envelope:v1'
  );
  const wrappedKey = crypto.publicEncrypt(
    {
      key: rsaPublicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    contentKey
  );

  let ephemeralPublicKey = '';
  let hmacKey;
  let macMethod = 'content-key';

  if (eccPublicKeyPem) {
    const ephemeralKeys = crypto.generateKeyPairSync('ec', { namedCurve: CURVE });
    const sharedSecret = crypto.diffieHellman({
      privateKey: ephemeralKeys.privateKey,
      publicKey: crypto.createPublicKey(eccPublicKeyPem)
    });
    hmacKey = deriveKeys(sharedSecret, salt, 'rsa-envelope').hmacKey;
    ephemeralPublicKey = exportEcPublicKey(ephemeralKeys.publicKey);
    macMethod = 'ecdh-p256';
  } else {
    hmacKey = deriveContentKeyMac(contentKey, salt);
  }

  const envelope = {
    algorithm: 'RSA-OAEP-256+A256GCM',
    macMethod,
    wrappedKey: wrappedKey.toString('base64url'),
    ephemeralPublicKey,
    salt: salt.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    ciphertext: ciphertext.toString('base64url')
  };
  envelope.mac = createMac(hmacKey, [
    envelope.algorithm,
    envelope.macMethod,
    envelope.wrappedKey,
    envelope.ephemeralPublicKey,
    envelope.salt,
    envelope.iv,
    envelope.tag,
    envelope.ciphertext
  ]);

  return encodeEnvelope(RSA_ENVELOPE_PREFIX, envelope);
};

export const decryptRsaEnvelope = (encryptedValue, rsaPrivateKeyPem, eccPrivateKeyPem) => {
  const envelope = decodeEnvelope(encryptedValue, RSA_ENVELOPE_PREFIX);
  const contentKey = crypto.privateDecrypt(
    {
      key: rsaPrivateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(envelope.wrappedKey, 'base64url')
  );
  const salt = Buffer.from(envelope.salt, 'base64url');
  let hmacKey;

  if (envelope.macMethod === 'ecdh-p256') {
    if (!eccPrivateKeyPem || !envelope.ephemeralPublicKey) {
      throw new Error('ECC private key is required to authenticate this RSA envelope');
    }
    const sharedSecret = crypto.diffieHellman({
      privateKey: crypto.createPrivateKey(eccPrivateKeyPem),
      publicKey: importEcPublicKey(envelope.ephemeralPublicKey)
    });
    hmacKey = deriveKeys(sharedSecret, salt, 'rsa-envelope').hmacKey;
  } else if (envelope.macMethod === 'content-key') {
    hmacKey = deriveContentKeyMac(contentKey, salt);
  } else {
    throw new Error('Unsupported RSA envelope MAC method');
  }

  const expectedMac = createMac(hmacKey, [
    envelope.algorithm,
    envelope.macMethod,
    envelope.wrappedKey,
    envelope.ephemeralPublicKey || '',
    envelope.salt,
    envelope.iv,
    envelope.tag,
    envelope.ciphertext
  ]);
  if (!macMatches(expectedMac, envelope.mac)) {
    throw new Error('RSA envelope HMAC verification failed');
  }

  return decryptAesGcm(
    Buffer.from(envelope.ciphertext, 'base64url'),
    contentKey,
    Buffer.from(envelope.iv, 'base64url'),
    Buffer.from(envelope.tag, 'base64url'),
    'hms:rsa-envelope:v1'
  ).toString('utf8');
};

// ECIES-style encryption: ephemeral P-256 ECDH, HKDF-SHA256, AES-GCM and HMAC-SHA256.
export const eccEncrypt = (value, recipientPublicKeyPem) => {
  const ephemeralKeys = crypto.generateKeyPairSync('ec', { namedCurve: CURVE });
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const sharedSecret = crypto.diffieHellman({
    privateKey: ephemeralKeys.privateKey,
    publicKey: crypto.createPublicKey(recipientPublicKeyPem)
  });
  const { encryptionKey, hmacKey } = deriveKeys(sharedSecret, salt, 'ecc-envelope');
  const { ciphertext, tag } = encryptAesGcm(
    asPlaintextBuffer(value),
    encryptionKey,
    iv,
    'hms:ecc-envelope:v1'
  );
  const envelope = {
    algorithm: 'ECDH-P256+HKDF-SHA256+A256GCM',
    ephemeralPublicKey: exportEcPublicKey(ephemeralKeys.publicKey),
    salt: salt.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    ciphertext: ciphertext.toString('base64url')
  };
  envelope.mac = createMac(hmacKey, [
    envelope.algorithm,
    envelope.ephemeralPublicKey,
    envelope.salt,
    envelope.iv,
    envelope.tag,
    envelope.ciphertext
  ]);

  return encodeEnvelope(ECC_ENVELOPE_PREFIX, envelope);
};

export const eccDecrypt = (encryptedValue, recipientPrivateKeyPem) => {
  const envelope = decodeEnvelope(encryptedValue, ECC_ENVELOPE_PREFIX);
  const salt = Buffer.from(envelope.salt, 'base64url');
  const sharedSecret = crypto.diffieHellman({
    privateKey: crypto.createPrivateKey(recipientPrivateKeyPem),
    publicKey: importEcPublicKey(envelope.ephemeralPublicKey)
  });
  const { encryptionKey, hmacKey } = deriveKeys(sharedSecret, salt, 'ecc-envelope');
  const expectedMac = createMac(hmacKey, [
    envelope.algorithm,
    envelope.ephemeralPublicKey,
    envelope.salt,
    envelope.iv,
    envelope.tag,
    envelope.ciphertext
  ]);
  if (!macMatches(expectedMac, envelope.mac)) {
    throw new Error('ECC envelope HMAC verification failed');
  }

  return decryptAesGcm(
    Buffer.from(envelope.ciphertext, 'base64url'),
    encryptionKey,
    Buffer.from(envelope.iv, 'base64url'),
    Buffer.from(envelope.tag, 'base64url'),
    'hms:ecc-envelope:v1'
  ).toString('utf8');
};

export const deriveEcdhHmacKey = (privateKeyPem, publicKeyPem, salt, context = 'record') => {
  const sharedSecret = crypto.diffieHellman({
    privateKey: crypto.createPrivateKey(privateKeyPem),
    publicKey: crypto.createPublicKey(publicKeyPem)
  });
  return deriveKeys(sharedSecret, Buffer.from(salt), context).hmacKey;
};

export const hmacCriticalRecord = (value, key) => crypto
  .createHmac('sha256', key)
  .update(asPlaintextBuffer(value))
  .digest('base64url');

export const verifyCriticalRecordHmac = (value, mac, key) => (
  macMatches(hmacCriticalRecord(value, key), mac)
);

export const signApproval = (value, eccPrivateKeyPem) => crypto
  .sign('sha256', asPlaintextBuffer(value), {
    key: eccPrivateKeyPem,
    dsaEncoding: 'ieee-p1363'
  })
  .toString('base64url');

export const verifyApproval = (value, signature, eccPublicKeyPem) => crypto.verify(
  'sha256',
  asPlaintextBuffer(value),
  { key: eccPublicKeyPem, dsaEncoding: 'ieee-p1363' },
  Buffer.from(signature, 'base64url')
);

export const asymmetricPrefixes = {
  rsa: RSA_VALUE_PREFIX,
  rsaEnvelope: RSA_ENVELOPE_PREFIX,
  ecc: ECC_ENVELOPE_PREFIX
};
