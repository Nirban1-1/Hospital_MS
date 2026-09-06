import assert from 'node:assert/strict';
import crypto from 'crypto';
import test, { before } from 'node:test';
import dotenv from 'dotenv';
import {
  asymmetricPrefixes, decryptRsaEnvelope, deriveEcdhHmacKey, eccDecrypt, eccEncrypt,
  encryptRsaEnvelope, hmacCriticalRecord, rsaDecrypt, rsaEncrypt, signApproval,
  verifyApproval, verifyCriticalRecordHmac
} from '../utils/asymmetricEncryption.js';
import { generateUserKeyMaterial, rewrapUserPrivateKeys, unwrapPrivateKey } from '../utils/keyManagement.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateTotp, verifyTotp } from '../utils/totp.js';
import { protectPrescriptionForPatient } from '../utils/recordProtection.js';

dotenv.config();

let patient;
let doctor;
let patientRsaPrivate;
let patientEccPrivate;
let doctorEccPrivate;

before(async () => {
  [patient, doctor] = await Promise.all([
    generateUserKeyMaterial('PatientPass123!'),
    generateUserKeyMaterial('DoctorPass123!')
  ]);
  [patientRsaPrivate, patientEccPrivate, doctorEccPrivate] = await Promise.all([
    unwrapPrivateKey(patient.rsa_private_key_wrapped, 'PatientPass123!'),
    unwrapPrivateKey(patient.ecc_private_key_wrapped, 'PatientPass123!'),
    unwrapPrivateKey(doctor.ecc_private_key_wrapped, 'DoctorPass123!')
  ]);
});

const tamperCiphertext = (value, prefix) => {
  const envelope = JSON.parse(Buffer.from(value.slice(prefix.length), 'base64url').toString('utf8'));
  const bytes = Buffer.from(envelope.ciphertext, 'base64url');
  bytes[0] ^= 1;
  envelope.ciphertext = bytes.toString('base64url');
  return `${prefix}${Buffer.from(JSON.stringify(envelope)).toString('base64url')}`;
};

test('PBKDF2 uses random salts and verifies with SHA-256', async () => {
  const first = await hashPassword('StrongPass123!');
  const second = await hashPassword('StrongPass123!');
  assert.match(first, /^pbkdf2:v1:120000:/);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('StrongPass123!', first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
  assert.equal(await verifyPassword('StrongPass123!', 'pbkdf2:v1:120000:YWJj:'), false);
  assert.equal(
    await verifyPassword('StrongPass123!', first.replace(':120000:', ':999999999:')),
    false
  );
});

test('RSA-OAEP and hybrid envelopes round-trip and reject tampering', () => {
  assert.equal(rsaDecrypt(rsaEncrypt('metadata', patient.rsa_public_key), patientRsaPrivate), 'metadata');
  const value = { appointment_id: 'a1', date: '2026-09-06', notes: 'x'.repeat(1000) };
  const encrypted = encryptRsaEnvelope(value, patient.rsa_public_key, patient.ecc_public_key);
  assert.deepEqual(JSON.parse(decryptRsaEnvelope(encrypted, patientRsaPrivate, patientEccPrivate)), value);
  assert.throws(() => decryptRsaEnvelope(
    tamperCiphertext(encrypted, asymmetricPrefixes.rsaEnvelope), patientRsaPrivate, patientEccPrivate
  ), /HMAC verification failed/);
});

test('ECC envelope uses ECDH keys and rejects modified ciphertext', () => {
  const value = { test_report: 'CBC normal', prescription: ['Drug A', 'Drug B'] };
  const encrypted = eccEncrypt(value, patient.ecc_public_key);
  assert.deepEqual(JSON.parse(eccDecrypt(encrypted, patientEccPrivate)), value);
  assert.throws(() => eccDecrypt(
    tamperCiphertext(encrypted, asymmetricPrefixes.ecc), patientEccPrivate
  ), /HMAC verification failed/);
});

test('prescriptions split RSA metadata from ECC clinical content', () => {
  const record = {
    _id: 'prescription-1',
    appointment_id: 'appointment-1',
    doctor_id: 'doctor-1',
    patient_id: 'patient-1',
    date: new Date('2026-09-06T00:00:00.000Z'),
    notes: 'Follow up after seven days',
    medicines: [{
      medicine_id: 'medicine-1',
      medicine_name: 'Example medicine',
      dosage: '10 mg',
      duration: '7 days',
      timing: { morning: 1, noon: 0, night: 1 }
    }],
    tests: []
  };
  protectPrescriptionForPatient(record, { ...patient, key_version: 1 });
  const metadata = JSON.parse(decryptRsaEnvelope(
    record.patient_metadata_rsa_envelope, patientRsaPrivate, patientEccPrivate
  ));
  const clinical = JSON.parse(eccDecrypt(record.patient_clinical_ecc_envelope, patientEccPrivate));
  assert.equal(metadata.appointment_id, 'appointment-1');
  assert.equal(clinical.medicines[0].name, 'Example medicine');
  assert.equal(clinical.notes, 'Follow up after seven days');
});

test('ECDH derives the same HMAC key for patient and doctor', () => {
  const salt = crypto.randomBytes(16);
  const patientKey = deriveEcdhHmacKey(
    patientEccPrivate, doctor.ecc_public_key, salt, 'shared-medical-record'
  );
  const doctorKey = deriveEcdhHmacKey(
    doctorEccPrivate, patient.ecc_public_key, salt, 'shared-medical-record'
  );
  assert.deepEqual(patientKey, doctorKey);
  const mac = hmacCriticalRecord('critical ciphertext', patientKey);
  assert.equal(verifyCriticalRecordHmac('critical ciphertext', mac, doctorKey), true);
  assert.equal(verifyCriticalRecordHmac('modified ciphertext', mac, doctorKey), false);
});

test('patient approval is signed and verified with ECDSA P-256', () => {
  const statement = JSON.stringify({ request: 'r1', approved: true });
  const signature = signApproval(statement, patientEccPrivate);
  assert.equal(verifyApproval(statement, signature, patient.ecc_public_key), true);
  assert.equal(verifyApproval(`${statement}x`, signature, patient.ecc_public_key), false);
});

test('private keys are rewrapped, not replaced, on password change', async () => {
  const rewrapped = await rewrapUserPrivateKeys(patient, 'PatientPass123!', 'NewPatientPass123!');
  assert.equal(
    await unwrapPrivateKey(rewrapped.rsa_private_key_wrapped, 'NewPatientPass123!'),
    patientRsaPrivate
  );
  await assert.rejects(unwrapPrivateKey(rewrapped.rsa_private_key_wrapped, 'PatientPass123!'));
  await assert.rejects(
    unwrapPrivateKey(
      rewrapped.rsa_private_key_wrapped.replace(':120000:', ':999999999:'),
      'NewPatientPass123!'
    ),
    /Malformed wrapped key/
  );
});

test('TOTP matches RFC 6238 and enforces its time window', () => {
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(generateTotp(rfcSecret, { timestamp: 59000, digits: 8 }), '94287082');
  const token = generateTotp(rfcSecret, { timestamp: 120000 });
  assert.equal(verifyTotp(rfcSecret, token, { timestamp: 120000, window: 0 }), true);
  assert.equal(verifyTotp(rfcSecret, token, { timestamp: 180000, window: 0 }), false);
});

test('session tokens use RSA signatures and reject payload tampering', async () => {
  const { signSessionToken, verifySessionToken } = await import('../utils/sessionToken.js');
  const token = signSessionToken(
    { id: 'user-1', role: 'patient', scope: 'session' },
    { expiresInSeconds: 60 }
  );
  assert.equal(verifySessionToken(token).role, 'patient');
  assert.equal(verifySessionToken(token).scope, 'session');
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  payload.role = 'admin';
  parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
  assert.throws(() => verifySessionToken(parts.join('.')), /Invalid token signature/);
  assert.throws(() => verifySessionToken(`${token}.extra`), /Invalid token format/);
});
