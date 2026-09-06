# Encryption Proposal Compliance and Lab Guide

Date: 2026-09-06

This document records the current HMS encryption implementation and maps it to the exact CSE447 proposal. It is both an audit record and a study guide for the lab evaluation.

## Current Result

The proposal's required techniques are implemented for new and updated records:

- PBKDF2-SHA256 password hashing with a random salt.
- RSA-2048 OAEP encryption for metadata and large-record hybrid RSA envelopes.
- P-256 ECC encryption using an ECIES-style ECDH construction.
- HMAC-SHA256 over critical ciphertext, with MAC keys derived by ECDH.
- A per-user RSA keypair and P-256 keypair.
- Password-derived AES-256-GCM wrapping of private keys.
- TOTP two-factor authentication with the secret RSA-encrypted at rest.
- RSA-SHA256 signed session tokens without `jsonwebtoken`.
- ECDSA-signed patient approval and doctor-specific re-encryption of old records.
- Server-side RBAC for patient, doctor, donor, driver, staff category, and admin routes.

The database audit found 29 users, of whom 26 already have RSA/ECC keys. The migration was dry-run, applied, and audited again: 51 eligible legacy documents now have owner-specific envelopes, and the follow-up reported `protected: 0` and `alreadyProtected: 51`. Nine model rows were skipped because three legacy users lack keypairs; those users must change or reset their password once before their remaining rows can be protected.

## Important Storage Design

The app keeps its existing query references so MongoDB joins, appointment searches, and sorting continue to work. Each proposal-mapped record also stores an owner-specific cryptographic envelope that is the protected copy used for consent-based decryption.

Clinical values already used by the current UI remain protected by the earlier `enc:v2` AES-GCM field layer. The new RSA/ECC envelopes add proposal-exact asymmetric ownership and sharing without breaking existing encrypted rows.

Stored prefixes identify each format:

```text
pbkdf2:v1:...        password hash
wrapped:v1:...       password-wrapped private key
enc:v2:...           AES-GCM field ciphertext + HMAC
rsa:v1:...           direct RSA-OAEP ciphertext
rsa-envelope:v1:...  RSA-OAEP hybrid record envelope + HMAC
ecc:v1:...           ECDH/HKDF/AES-GCM clinical envelope + HMAC
```

## Proposal Data Mapping

| Proposal data | Implementation | Protected field |
| --- | --- | --- |
| Appointment references, date, time | RSA hybrid envelope encrypted to patient | `Appointment.patient_metadata_rsa_envelope` |
| Doctor specialization and qualification | RSA hybrid envelope encrypted to doctor | `Doctor.profile_rsa_envelope` |
| Doctor available schedule | RSA hybrid envelope encrypted to doctor | `Doctor.schedule_rsa_envelope` |
| Online test type, time, patient | RSA hybrid envelope encrypted to patient | `TestReport.patient_metadata_rsa_envelope` |
| Test result/report content | P-256 ECC envelope encrypted to patient | `Prescription.patient_clinical_ecc_envelope` |
| Prescription IDs and date | RSA hybrid envelope encrypted to patient | `Prescription.patient_metadata_rsa_envelope` |
| Medicine name, dosage, duration, timing, notes | P-256 ECC envelope encrypted to patient | `Prescription.patient_clinical_ecc_envelope` |
| Medicine catalog | Plain by proposal | `Medicine` collection |
| User name, email, contact, address, blood type | RSA hybrid profile envelope | `User.profile_rsa_envelope` |
| Admin role filtering | Plain is explicitly allowed by proposal | `User.role` |
| Staff schedule | RSA hybrid envelope encrypted to staff member | `StaffSchedule.staff_rsa_envelope` |
| Cabin/ICU/OT reservation metadata | RSA hybrid envelope encrypted to patient | `Reservation.patient_rsa_envelope` |
| Blood donor type, contact, availability | RSA hybrid envelope encrypted to donor | `BloodDonor.donor_rsa_envelope` |
| Blood request metadata | RSA hybrid envelope encrypted to patient | `BloodRequest.patient_metadata_rsa_envelope` |
| Blood urgency note | P-256 ECC envelope encrypted to patient | `BloodRequest.urgency_ecc_envelope` |
| Old-record request metadata | RSA hybrid envelope encrypted to patient | `RecordAccessRequest.request_metadata_rsa_envelope` |
| Old-record request reason | P-256 ECC envelope encrypted to patient | `RecordAccessRequest.request_reason_ecc_envelope` |
| Patient approval | ECDSA P-256 signature | `RecordAccessRequest.patient_signature` |
| Approved doctor copy | Fresh RSA and ECC envelopes for doctor | `doctor_metadata_rsa_envelope`, `doctor_clinical_ecc_envelope` |

## Core Modules

### `server/utils/password.js`

Passwords are hashed, not encrypted. `hashPassword()` generates a random 16-byte salt and runs PBKDF2-HMAC-SHA256 for 120,000 iterations to produce a 32-byte result. `verifyPassword()` derives the candidate hash and compares it with `crypto.timingSafeEqual()`.

The stored format is:

```text
pbkdf2:v1:<iterations>:<base64url-salt>:<base64url-hash>
```

New registration, password change, password reset, admin setup, and active seed scripts use this module. Runtime authentication does not import `bcryptjs`.

### `server/utils/keyManagement.js`

`generateUserKeyMaterial()` creates:

- RSA-2048 keypair for encryption.
- P-256 (`prime256v1`) keypair for ECDH and ECDSA.
- AES-256-GCM wrapped RSA private key.
- AES-256-GCM wrapped ECC private key.

The wrapping key is independently derived from the user's password with PBKDF2-SHA256 and a random salt. Public keys remain readable because they are not secret. Private keys never enter MongoDB as plaintext.

`rewrapUserPrivateKeys()` first unwraps both existing private keys with the current password, then wraps those same keys with a key derived from the new password. The public keys and encrypted records therefore remain valid after an authenticated password change.

### `server/utils/asymmetricEncryption.js`

Direct RSA uses RSA-OAEP with SHA-256 and is used for the short TOTP secret.

Large metadata uses hybrid RSA:

1. Generate a random 256-bit content key.
2. Encrypt JSON with AES-256-GCM.
3. Wrap the content key with recipient RSA-OAEP-SHA256.
4. Generate an ephemeral P-256 keypair.
5. Derive a shared secret with ephemeral ECDH and recipient ECC public key.
6. Use HKDF-SHA256 to derive an independent HMAC key.
7. Store HMAC-SHA256 over algorithm fields and ciphertext.

ECC clinical encryption is ECIES-style:

1. Generate an ephemeral P-256 keypair.
2. Run ECDH with the recipient P-256 public key.
3. Run HKDF-SHA256 over the shared secret and random salt.
4. Split the output into an AES-256 key and HMAC-SHA256 key.
5. Encrypt with AES-256-GCM and authenticate the complete envelope with HMAC.

The decryptors verify HMAC before returning plaintext. Modified ciphertext, tag, key, or metadata is rejected.

### `server/utils/totp.js`

This is a dependency-free RFC 6238 TOTP implementation:

- 160-bit random Base32 secret.
- HMAC-SHA1, as required by standard authenticator apps.
- 30-second step and six digits.
- One-step clock-skew window.
- Constant-time code comparison.

Setup requires the account password. The server RSA-encrypts the pending secret with the user's public key. Confirmation requires a valid current code before the encrypted secret becomes active. Login verifies the password first, unwraps the user's RSA private key, decrypts the secret, and verifies the code before issuing a session token.

### `server/utils/sessionToken.js`

The token has the familiar `header.payload.signature` shape, but it is implemented with Node's built-in APIs. It uses `alg: RS256`, checks the header, verifies the RSA-SHA256 signature, and enforces `exp`. Authentication reloads the current user from MongoDB, so a forged role in a payload cannot bypass route RBAC.

Production fails closed if session keys or the 32-byte data-encryption key are absent. Login tokens carry an explicit `session` scope, and authentication middleware rejects password-reset tickets even though both are RSA-signed. Development mode can still create temporary keys to make setup failures clear without hiding them.

## Patient Consent Flow

The old-record access workflow is implemented in:

```text
server/models/RecordAccessRequest.js
server/controllers/recordAccessController.js
server/routes/recordAccessRoutes.js
client/src/components/RecordAccessPanel/RecordAccessPanel.jsx
```

Flow:

1. A verified doctor requests one prior prescription and supplies a reason.
2. The server verifies that the doctor has an appointment relationship with that patient.
3. Request metadata is RSA-encrypted to the patient; the reason is ECC-encrypted to the patient.
4. The patient opens the request with their password-protected private keys.
5. On approval, the server decrypts the patient-owned record only after password verification.
6. A canonical approval statement is signed with the patient's ECDSA private key.
7. Metadata is encrypted again with the requesting doctor's RSA public key.
8. Clinical text is encrypted again with the requesting doctor's ECC public key.
9. The doctor supplies their password to unwrap their private keys.
10. The server verifies the patient's signature before decrypting the doctor-specific copies.

An admin has no route that accepts an admin role for patient or doctor private-key operations. Admin authorization permits management and verification, not medical decryption.

## Password Changes and Key Rotation

Authenticated password change:

```text
PUT /api/users/change-password
```

This verifies the current password and rewraps the same private keys. `key_version` remains unchanged because the cryptographic identity did not change.

Forgotten-password reset is different. Without the old password, the old private keys cannot be decrypted. The reset flow therefore creates new RSA/ECC pairs, increments `key_version`, timestamps the rotation, disables 2FA until it is configured again, and immediately rebuilds the user's owner envelopes from the still-readable AES operational layer. Pending consent requests encrypted to the lost key are rejected, and doctor grants are revoked when a doctor's keypair rotates.

The reset endpoint requires a short-lived RSA-signed reset token issued after the existing identity check. A hidden per-user reset version makes the ticket single-use and invalidates older tickets whenever a new one is issued. Supplying only an email address is no longer enough to reset a password.

## RBAC Enforcement

The middleware now includes:

```text
requireAuth
requireVerified
requireAdmin
requireRole(...roles)
requireStaffCategory(...categories)
```

Important boundaries:

- Patient: own appointments, blood requests, payments, prescriptions, uploads, consent decisions.
- Doctor: own dashboard, slots, assigned appointments, prescriptions, medicine/test search, access requests.
- Donor: donor dashboard and blood donation request actions.
- Ambulance driver: driver queue and assigned ambulance actions.
- Staff: own schedule only.
- Receptionist: cabin/ICU/OT booking and non-clinical patient lookup only.
- Admin: user verification/removal and staff scheduling, with no prescription decrypt route.

Controllers also check record ownership. Role middleware alone is not treated as sufficient authorization.

## Security API Endpoints

Two-factor authentication:

```text
POST /api/users/2fa/setup       { password }
POST /api/users/2fa/confirm     { password, otp }
POST /api/users/2fa/disable     { password, otp }
POST /api/users/login           { email, password, otp }
```

Password lifecycle:

```text
PUT  /api/users/change-password { currentPassword, newPassword }
POST /api/users/verify-user     { email, phone, name }
POST /api/users/reset-password  { resetToken, newPassword }
```

Old-record consent:

```text
POST /api/record-access/requests                 doctor creates request
GET  /api/record-access/requests/doctor          doctor lists own requests
GET  /api/record-access/requests/patient         patient lists own requests
POST /api/record-access/requests/:id/view        patient decrypts request
POST /api/record-access/requests/:id/approve     patient signs approval
POST /api/record-access/requests/:id/reject      patient rejects request
POST /api/record-access/requests/:id/decrypt     approved doctor decrypts copy
POST /api/record-access/prescriptions/:id/decrypt patient decrypts own envelope
```

The Account page exposes 2FA, password rewrapping, and old-record access controls for lab demonstration.

## Environment Setup

Run from `C:\Projects\HMS\server`:

```powershell
node scripts\setupCryptoEnv.js
```

The script creates any missing values for:

```text
ENCRYPTION_KEY
SESSION_PRIVATE_KEY
SESSION_PUBLIC_KEY
```

For this existing database, the script deliberately derives the initial explicit `ENCRYPTION_KEY` from the former `JWT_SECRET` fallback. That preserves the exact old AES key, so adding the environment variable does not make existing `enc:v2` fields unreadable. It does not print secret values.

The session PEM values and encryption key are present in the local ignored `.env`. Never commit that file.

## Existing-Data Migration

Dry run:

```powershell
node scripts\migrateProposalEncryption.js
```

Apply after the dry-run count is acceptable:

```powershell
node scripts\migrateProposalEncryption.js --apply
```

The migration covers users, doctors, doctor schedules, appointments, prescriptions, online test bookings, donors, blood requests, staff schedules, and reservations. It is additive and skips records already protected. It never invents private keys for a user whose password is unavailable.

The migration was applied on 2026-09-06 after a clean dry run. Its follow-up dry run reported 51 already-protected rows, no additional eligible rows, and 9 rows skipped for owners without keys. Node's SRV DNS lookup was unreliable during the run, so the verification used the same Atlas cluster through its resolved replica hosts without changing the stored URI or exposing credentials.

## Verification

Run the complete crypto and RBAC suite:

```powershell
npm test
```

It currently contains thirteen passing checks across the crypto and RBAC suites:

- Random-salt PBKDF2 and password verification.
- RSA-OAEP and long hybrid RSA records.
- ECC/ECDH encryption round trip.
- HMAC rejection after ciphertext tampering.
- RSA metadata and ECC clinical-data separation for prescriptions.
- Equal ECDH-derived keys for patient and doctor.
- ECDSA approval verification and modified-message rejection.
- Private-key rewrapping with the old password rejected afterward.
- RFC 6238 TOTP vector, time window, and RSA session tamper rejection.
- Doctor/patient/admin role isolation.
- Receptionist staff-category isolation.
- Verified-account enforcement.

The frontend production build was also run successfully with the local Vite binary. The only remaining notice is the existing large-bundle warning; it is unrelated to encryption and does not fail the build.

A disposable live patient account was also tested end to end and deleted afterward. Registration returned 201, TOTP setup and confirmation returned 200, login without a code returned 401 with `requiresTwoFactor`, login with a current code returned 200, password change returned 200, and login with the new password plus the same TOTP secret returned 200. Raw database checks confirmed the `pbkdf2:v1`, `rsa:v1`, `wrapped:v1`, and `rsa-envelope:v1` prefixes. The RSA public key stayed identical while the wrapped private-key ciphertext changed, proving rewrapping rather than key replacement.

The live RBAC smoke test confirmed that the configured admin can log in and use an admin route, while the same token receives 403 from patient-only and doctor-only routes. Public registration with role `admin` returns 400.

A second disposable account verified forgotten-password rotation with an owned blood request. Identity verification and reset returned 200, the old password then returned 401, the new password returned 200, `key_version` increased to 2, and the reset response reported one protected record. Database inspection confirmed that both the RSA metadata and ECC urgency-note envelopes were freshly re-encrypted at version 2. The temporary account and request were deleted afterward.

## Lab Explanation

> Every user gets RSA and P-256 keypairs at registration. Their public keys can be stored normally, while each private key is AES-GCM wrapped with a PBKDF2-derived key from the user's password. Proposal metadata is stored in hybrid RSA-OAEP envelopes, while medical text and reports use an ECIES-style P-256 ECDH envelope. ECDH plus HKDF produces separate encryption and HMAC keys, so changed ciphertext is rejected. Passwords use salted PBKDF2, login can require a standards-compatible TOTP code whose secret is RSA-encrypted, and sessions are signed with RSA without a JWT library. For old records, patient approval is ECDSA-signed and the record is re-encrypted to the approved doctor's keys; an admin role alone cannot decrypt it.

## Honest Limitations

- Fifty-one eligible legacy rows are migrated; nine rows tied to three keyless legacy users remain intentionally skipped. The skipped set includes the current legacy patient's two appointments, one prescription, one online test booking, and one blood request; those values remain encrypted by the existing AES field layer where applicable.
- Those three legacy users must complete a password reset once. The reset handler now creates their keys and automatically rebuilds every owner envelope, so no separate manual data command is needed afterward.
- Query references and scheduling projections remain available to server code so the current MongoDB relations and UI continue to work. The protected asymmetric envelope is the consent-controlled copy; clinical text fields are also encrypted by the field layer.
- A forgotten-password reset rotates keys because the old password-derived wrapping key cannot be reconstructed. Production systems normally add a separately protected recovery mechanism if old ciphertext must survive forgotten passwords.
