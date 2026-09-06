# MediSecure Encryption Implementation Learning Guide

**CSE447 lab evaluation study document**

**Project root:** `C:\Projects\HMS`  
**Proposal source:** `H:\CSE447\CSE447 Project Proposal_Updated (1).pdf`  
**Implementation reviewed:** 2026-09-06

## Purpose and current conclusion

This guide teaches the cryptographic design implemented in MediSecure, identifies the exact source files, explains every important request flow, and provides commands and answers for a lab evaluation.

The proposal's cryptographic techniques and access-control flows are implemented for new and updated records:

- PBKDF2-HMAC-SHA256 password hashing with a random salt.
- One RSA-2048 keypair and one P-256 ECC keypair per user.
- Password-derived AES-256-GCM wrapping of private keys.
- RSA-OAEP encryption and hybrid RSA envelopes for structured metadata.
- ECIES-style P-256 ECDH encryption for clinical text.
- HKDF-SHA256 key derivation and HMAC-SHA256 tamper detection.
- RFC 6238 TOTP two-factor authentication.
- RSA-SHA256 signed and purpose-scoped session tokens.
- ECDSA-signed patient consent and doctor-specific record re-encryption.
- Server-side role and ownership checks.

Fifty-one eligible legacy documents have owner-specific envelopes. Nine rows associated with three old bcrypt accounts still require those users to complete one password reset. The affected legacy patient's two appointments, one prescription, one test booking, and one blood request are automatically reprotected during that reset.

## How to use this guide

Read Chapters 1 through 4 to learn the concepts. Use Chapters 5 through 8 to trace the implementation in code. Use Chapters 9 and 10 before the lab evaluation.

Never paste a real private key, MongoDB password, TOTP secret, session token, or `ENCRYPTION_KEY` into a report, screenshot, Git commit, or chat.

# 1 Security Concepts

## 1.1 Hashing is not encryption

Encryption is reversible when the correct key is available. Hashing is intentionally one-way. A password should therefore be hashed, not encrypted.

MediSecure stores a PBKDF2 result. During login, it derives a new result from the submitted password and stored salt, then compares the two values in constant time. The original password is never recovered.

## 1.2 Encryption provides confidentiality

Encryption changes readable plaintext into ciphertext. Only the correct decryption key should restore the plaintext.

MediSecure uses:

- AES-256-GCM for efficient authenticated symmetric encryption.
- RSA-2048 OAEP for asymmetric encryption of short values or random content keys.
- P-256 ECDH plus AES-256-GCM as an ECIES-style construction for clinical text.

## 1.3 A MAC provides integrity and authenticity

A Message Authentication Code detects unauthorized changes. MediSecure computes HMAC-SHA256 over the important envelope fields. If an attacker changes the ciphertext, IV, authentication tag, wrapped key, salt, algorithm name, or ephemeral public key, verification fails.

Encryption answers, "Who can read this?" A MAC answers, "Was this changed by someone without the MAC key?"

## 1.4 A digital signature is different from a MAC

A MAC uses a shared secret, so either holder of that secret can generate it. A digital signature uses a private key to sign and a public key to verify.

MediSecure uses ECDSA P-256 to prove that the patient approved a specific old-record request. The doctor can verify the signature but cannot create a valid patient signature.

## 1.5 Encoding is not security

Base64 and Base64URL only convert bytes into printable text. They do not hide data. The project uses Base64URL to store binary cryptographic components safely inside JSON and MongoDB strings, but security comes from the algorithms and keys.

# 2 Cryptographic Architecture

## 2.1 Layered design

```text
Password
  -> PBKDF2-SHA256
  -> password hash for authentication
  -> independent wrapping key for private-key protection

User registration
  -> RSA-2048 keypair
  -> P-256 ECC keypair
  -> public keys stored normally
  -> private keys AES-GCM wrapped with password-derived keys

Medical metadata
  -> random AES content key
  -> AES-GCM ciphertext
  -> content key wrapped with patient RSA-OAEP public key
  -> ECDH-derived HMAC-SHA256

Clinical text
  -> ephemeral P-256 keypair
  -> ECDH shared secret
  -> HKDF-SHA256
  -> AES-256-GCM encryption key plus HMAC-SHA256 key

Patient consent
  -> patient ECDSA signature
  -> fresh RSA and ECC copies encrypted to the approved doctor
```

## 2.2 Stored format prefixes

| Prefix | Meaning |
| --- | --- |
| `pbkdf2:v1:` | Salted PBKDF2 password hash |
| `wrapped:v1:` | Password-wrapped private key |
| `enc:v2:` | AES-GCM field ciphertext with HMAC |
| `rsa:v1:` | Direct RSA-OAEP ciphertext |
| `rsa-envelope:v1:` | Hybrid RSA-OAEP metadata envelope with HMAC |
| `ecc:v1:` | ECDH/HKDF/AES-GCM clinical envelope with HMAC |

Prefixes provide format and version identification. They allow decryptors and future migrations to choose the correct parser.

## 2.3 Why hybrid encryption is necessary

RSA cannot safely encrypt an arbitrarily large prescription or JSON document. With a 2048-bit RSA key and OAEP-SHA256, the plaintext limit is much smaller than a medical record.

MediSecure therefore uses envelope encryption:

1. Generate a random 32-byte AES content key.
2. Encrypt the large record with AES-256-GCM.
3. Encrypt only that 32-byte key with RSA-OAEP.
4. Store the wrapped key, IV, tag, ciphertext, salt, ephemeral ECC public key, and HMAC.

This still gives RSA-based recipient ownership while using AES for data of any practical length.

# 3 Encryption Techniques

## 3.1 PBKDF2-HMAC-SHA256 password hashing

**Primary file:** `C:\Projects\HMS\server\utils\password.js`

`hashPassword(password)` performs these steps:

1. Generate a random 16-byte salt with `crypto.randomBytes(16)`.
2. Run PBKDF2 with HMAC-SHA256 for 120,000 iterations.
3. Derive a 32-byte result.
4. Store the version, iteration count, salt, and result.

```text
pbkdf2:v1:<iterations>:<base64url-salt>:<base64url-hash>
```

`verifyPassword(password, storedHash)` validates the stored structure, bounds the iteration count, checks salt and hash lengths, derives the candidate hash, and uses `crypto.timingSafeEqual()`.

Random salts ensure that two users with the same password receive different stored hashes. Iterations make each guessing attempt expensive.

## 3.2 AES-256-GCM field encryption

**Primary file:** `C:\Projects\HMS\server\utils\encryption.js`

AES is symmetric: the same secret key encrypts and decrypts. GCM is an authenticated mode that produces both ciphertext and an authentication tag.

`encryptValue()`:

1. Loads a 32-byte `ENCRYPTION_KEY`.
2. Generates a random 12-byte IV.
3. Encrypts with AES-256-GCM.
4. obtains the 16-byte GCM authentication tag.
5. Computes an additional HMAC-SHA256 over the stored payload.

```text
enc:v2:<iv>:<gcm-tag>:<ciphertext>:<hmac>
```

`encryptedString()` is a Mongoose schema helper. Its setter encrypts before MongoDB storage and its getter decrypts when the application reads the field.

`blindIndex()` creates a deterministic HMAC-SHA256 value for exact-match searches. Randomized encryption cannot be queried directly, so a blind index supports searches such as blood type or location without storing the searchable value in plaintext.

## 3.3 RSA-2048 OAEP

**Primary file:** `C:\Projects\HMS\server\utils\asymmetricEncryption.js`

RSA uses a public key for encryption and a private key for decryption. MediSecure uses:

- 2048-bit RSA keys.
- OAEP padding.
- SHA-256 as the OAEP hash.

`rsaEncrypt()` and `rsaDecrypt()` handle short values. `encryptRsaEnvelope()` and `decryptRsaEnvelope()` handle large JSON records by wrapping a random AES content key.

OAEP is probabilistic. Encrypting the same plaintext twice produces different ciphertext, which prevents simple equality analysis.

## 3.4 P-256 ECC and ECIES-style encryption

**Primary file:** `C:\Projects\HMS\server\utils\asymmetricEncryption.js`

ECC provides strong asymmetric security with smaller keys than RSA. Node names the selected NIST P-256 curve `prime256v1`.

The project implements an ECIES-style construction:

1. Generate a new ephemeral P-256 keypair for the record.
2. Combine the ephemeral private key with the recipient public key using ECDH.
3. Derive 64 bytes with HKDF-SHA256 and a random salt.
4. Use the first 32 bytes as an AES-256-GCM key.
5. Use the remaining 32 bytes as an HMAC-SHA256 key.
6. Store the ephemeral public key so the recipient can derive the same secret.

```text
ephemeral private key + recipient public key -> ECDH shared secret
shared secret + salt + context -> HKDF-SHA256
HKDF output -> AES key || HMAC key
```

The ephemeral private key is discarded after encryption. The patient combines their persistent private key with the stored ephemeral public key during decryption.

## 3.5 ECDH and HKDF

ECDH is a key-agreement operation. Two parties derive the same shared secret without transmitting that secret.

```text
ECDH(patient private key, doctor public key)
  ==
ECDH(doctor private key, patient public key)
```

Raw ECDH output is not used directly. HKDF-SHA256 converts it into independent, purpose-specific keys. Context labels such as `hms:ecc-envelope:v1` prevent one key from being reused accidentally for another purpose.

## 3.6 HMAC-SHA256

The envelope code authenticates a canonical ordered list of algorithm and ciphertext fields. During decryption it derives the expected MAC and compares it with `crypto.timingSafeEqual()`.

HMAC verification happens before plaintext is returned. Tampered envelopes produce an error instead of corrupted or attacker-controlled medical data.

## 3.7 ECDSA patient signatures

`signApproval()` signs the canonical approval statement with the patient's P-256 private key. `verifyApproval()` checks it with the patient's public key.

The signed statement binds:

- Request ID.
- Prescription ID.
- Patient ID.
- Doctor ID.
- Approval timestamp.
- Patient key version.

Changing any bound value invalidates the signature.

## 3.8 Per-user key generation and private-key wrapping

**Primary file:** `C:\Projects\HMS\server\utils\keyManagement.js`

`generateUserKeyMaterial(password)` creates:

- One RSA-2048 keypair for metadata encryption.
- One P-256 keypair for ECDH encryption and ECDSA signatures.
- One separately wrapped RSA private key.
- One separately wrapped ECC private key.

Public keys are not secrets and remain available for encryption and signature verification. Private keys are PKCS8 PEM strings before wrapping and are never intentionally stored in MongoDB as plaintext.

Each private key is wrapped as follows:

```text
password + random 16-byte salt
  -> PBKDF2-HMAC-SHA256, 120000 iterations
  -> 32-byte wrapping key
  -> AES-256-GCM(private-key PEM, random 12-byte IV)
  -> wrapped:v1 record
```

`unwrapUserPrivateKeys()` requires the current password. A wrong password causes AES-GCM authentication to fail.

## 3.9 Password change versus forgotten-password reset

An authenticated password change knows the old password. The application unwraps the existing RSA and ECC private keys and encrypts those same keys under keys derived from the new password. Public keys and existing record envelopes remain valid.

A forgotten-password reset cannot decrypt the old private keys. It therefore:

1. Verifies a short-lived, RSA-signed, single-use reset ticket.
2. Generates new RSA and ECC keypairs.
3. Increments `key_version`.
4. Records `key_rotated_at`.
5. Disables 2FA because the old TOTP secret was encrypted to the lost RSA key.
6. Rebuilds the user's owner envelopes from the existing operational field layer.
7. Rejects pending patient requests or revokes doctor copies made for obsolete keys.

This difference is a key lab concept: **password change rewraps keys; forgotten-password reset rotates keys.**

## 3.10 RFC 6238 TOTP two-factor authentication

**Primary file:** `C:\Projects\HMS\server\utils\totp.js`

MediSecure implements:

- A random 160-bit secret.
- Base32 encoding for authenticator applications.
- HMAC-SHA1, which is the interoperable RFC 6238 default.
- A 30-second time step.
- Six decimal digits.
- A plus-or-minus one-step clock-skew window.
- Constant-time code comparison.

The TOTP secret is RSA-encrypted at rest. Setup remains pending until the user submits a valid current code. Login checks the password first, decrypts the secret through the password-wrapped RSA private key, validates the OTP, and only then issues a session token.

TOTP uses HMAC-SHA1 because that is the standard authenticator format. This does not replace the proposal's HMAC-SHA256 record-integrity mechanism; they solve different problems.

## 3.11 RSA-signed session tokens

**Primary file:** `C:\Projects\HMS\server\utils\sessionToken.js`

The token uses three Base64URL sections:

```text
header.payload.signature
```

The header declares `RS256`. The server signs `header.payload` with its RSA private key and verifies each request with the public key.

The verifier checks:

- Exactly three non-empty sections.
- Header algorithm `RS256`.
- Header type `JWT`.
- RSA-SHA256 signature.
- Expiration time.

Login tokens contain `scope: "session"`. Password-reset tickets contain `scope: "password-reset"`. Authentication middleware accepts only the session scope, preventing a reset ticket from becoming a bearer login token.

The project does not import `jsonwebtoken`.

# 4 Proposal Data Mapping

| Proposal feature and data | Required technique | Implemented protected field |
| --- | --- | --- |
| Appointment patient, doctor, date, time | RSA | `Appointment.patient_metadata_rsa_envelope` |
| Online test type, time, patient | RSA | `TestReport.patient_metadata_rsa_envelope` |
| Test result or report text | ECC | `Prescription.patient_clinical_ecc_envelope` |
| Prescription medicine, dose, duration, timing, notes | ECC | `Prescription.patient_clinical_ecc_envelope` |
| Prescription patient, doctor, appointment, date | RSA | `Prescription.patient_metadata_rsa_envelope` |
| Doctor name, specialization, qualification | RSA | `Doctor.profile_rsa_envelope` |
| Doctor availability schedule | RSA | `Doctor.schedule_rsa_envelope` |
| Medicine catalog | Plain by proposal | `Medicine` collection |
| User profile fields | RSA | `User.profile_rsa_envelope` |
| Role filter | Plain allowed | `User.role` |
| Staff schedule | RSA | `StaffSchedule.staff_rsa_envelope` |
| Cabin, ICU, or OT booking | RSA | `Reservation.patient_rsa_envelope` |
| Blood donor details and availability | RSA | `BloodDonor.donor_rsa_envelope` |
| Blood request metadata | RSA | `BloodRequest.patient_metadata_rsa_envelope` |
| Blood urgency note | ECC | `BloodRequest.urgency_ecc_envelope` |
| Old-record request metadata | RSA | `RecordAccessRequest.request_metadata_rsa_envelope` |
| Old-record request reason | ECC | `RecordAccessRequest.request_reason_ecc_envelope` |
| Patient approval | ECDSA | `RecordAccessRequest.patient_signature` |
| Doctor-approved copy | RSA plus ECC | `doctor_metadata_rsa_envelope` and `doctor_clinical_ecc_envelope` |

The protected envelope is the patient- or role-owned cryptographic copy. Existing application reference fields remain available for MongoDB relations, search, and scheduling compatibility. Clinical strings used by the ordinary UI are also protected by the `enc:v2` AES-GCM field layer.

# 5 Complete File Map

All paths below are rooted at `C:\Projects\HMS`.

## 5.1 Core cryptography utilities

### `C:\Projects\HMS\server\utils\password.js`

Implements PBKDF2-HMAC-SHA256 password hashing, random salts, strict format validation, bounded iterations, and timing-safe verification.

### `C:\Projects\HMS\server\utils\encryption.js`

Implements AES-256-GCM field encryption, the `enc:v2` format, HMAC-SHA256, blind indexes, Mongoose encrypted-string setters/getters, and production key validation.

### `C:\Projects\HMS\server\utils\keyManagement.js`

Generates per-user RSA and P-256 keypairs; wraps, unwraps, and rewraps private keys with password-derived AES-GCM keys.

### `C:\Projects\HMS\server\utils\asymmetricEncryption.js`

Implements RSA-OAEP, hybrid RSA envelopes, ECIES-style ECC envelopes, ECDH, HKDF, HMAC-SHA256, ECDSA signing, and envelope version prefixes.

### `C:\Projects\HMS\server\utils\totp.js`

Implements Base32, RFC 6238 TOTP generation and verification, secret generation, and authenticator URI construction.

### `C:\Projects\HMS\server\utils\sessionToken.js`

Implements RSA-SHA256 session and reset tickets without `jsonwebtoken`, including algorithm, format, signature, and expiration checks.

### `C:\Projects\HMS\server\utils\recordProtection.js`

Builds proposal-specific RSA and ECC payloads for doctor schedules, prescriptions, online test bookings, metadata, and clinical text.

### `C:\Projects\HMS\server\utils\userRecordMigration.js`

Reprotects records after forgotten-password key rotation and invalidates access requests tied to obsolete keys.

## 5.2 User authentication and consent

### `C:\Projects\HMS\server\controllers\userController.js`

Changed registration, login, profile updates, password reset, password change, and 2FA. Registration now creates user keypairs. Login now verifies PBKDF2 and optional TOTP. Reset tickets are short-lived, versioned, single-use, and purpose-scoped.

### `C:\Projects\HMS\server\models\User.js`

Added encrypted profile fields and blind indexes from the field layer, RSA/ECC public keys, wrapped private keys, profile envelope, key version and rotation timestamps, 2FA fields, and `password_reset_version`.

### `C:\Projects\HMS\server\middleware\authMiddleware.js`

Replaced shared-secret JWT verification with RSA token verification. Added session-purpose validation, `requireRole()`, `requireStaffCategory()`, `requireAdmin`, and verified-account enforcement.

### `C:\Projects\HMS\server\routes\userRoutes.js`

Added password-change and 2FA endpoints and limited patient prescription listing to the patient role.

### `C:\Projects\HMS\server\models\RecordAccessRequest.js`

Stores encrypted request data, patient signatures, patient signing key, doctor-specific copies, status, and patient/doctor key versions.

### `C:\Projects\HMS\server\controllers\recordAccessController.js`

Implements doctor request, patient view, approval, rejection, ECDSA signing, doctor re-encryption, signature verification, and authorized decryption.

### `C:\Projects\HMS\server\routes\recordAccessRoutes.js`

Applies patient/doctor roles and verified-doctor checks to every old-record access endpoint.

## 5.3 Record models

### `C:\Projects\HMS\server\models\Appointment.js`

Added the patient RSA metadata envelope, patient key version, and crypto version.

### `C:\Projects\HMS\server\models\Doctor.js`

Added RSA envelopes for doctor profile information and available schedules.

### `C:\Projects\HMS\server\models\Prescription.js`

Added AES-protected clinical fields, encrypted medicine names, patient RSA metadata, patient ECC clinical data, and version fields.

### `C:\Projects\HMS\server\models\TestReport.js`

Added the patient RSA envelope and key/version fields for online test booking metadata.

### `C:\Projects\HMS\server\models\BloodDonor.js`

Added AES field protection and blind indexes for donor blood type/location plus a donor-owned RSA envelope.

### `C:\Projects\HMS\server\models\BloodRequest.js`

Added protected patient contact/request fields, patient RSA metadata, ECC urgency-note data, and patient key version.

### `C:\Projects\HMS\server\models\StaffSchedule.js`

Added the staff-owned RSA envelope and key version.

### `C:\Projects\HMS\server\models\Reservation.js`

Added the patient-owned RSA envelope and key version for cabin, ICU, and OT bookings.

### `C:\Projects\HMS\server\models\AmbulanceCall.js`

Added field-level protection for sensitive ambulance request values.

## 5.4 Record controllers

### `C:\Projects\HMS\server\controllers\appointmentController.js`

Encrypts appointment metadata to the patient during booking, cancellation, and treatment updates. It also refreshes the doctor's encrypted schedule when booked counts change.

### `C:\Projects\HMS\server\controllers\doctorController.js`

Encrypts specialization/profile changes, schedule changes, prescription metadata and clinical text, test suggestions, and uploaded report content. Ownership checks ensure a doctor acts only on their own appointments and prescriptions.

### `C:\Projects\HMS\server\controllers\testReportController.js`

Protects test-booking metadata with the patient's keys and verifies that the requesting doctor owns the linked prescription.

### `C:\Projects\HMS\server\controllers\bloodRequestController.js`

Protects blood request metadata with RSA and urgency notes with ECC whenever a request is created, accepted, or completed.

### `C:\Projects\HMS\server\controllers\donorController.js`

Protects donor registration and availability with a donor-owned RSA envelope and uses blind indexes for matching blood type and location.

### `C:\Projects\HMS\server\controllers\adminController.js`

Protects newly assigned staff schedules with the selected staff member's public keys. Admin routes manage accounts and schedules but do not receive a private-key medical decrypt endpoint.

### `C:\Projects\HMS\server\controllers\receptionController.js`

Encrypts reservation metadata to the patient when reception books or checks out a cabin, ICU bed, or OT.

### `C:\Projects\HMS\server\controllers\paymentController.js`

Restricts prescription payment operations to the owning patient.

### `C:\Projects\HMS\server\controllers\chatbotController.js`

Removed logging of patient symptom text and restricted chatbot endpoints to authenticated patients.

## 5.5 RBAC route files

These files now apply `requireAuth`, `requireVerified`, `requireRole`, `requireAdmin`, or `requireStaffCategory` as appropriate:

```text
C:\Projects\HMS\server\routes\adminRoutes.js
C:\Projects\HMS\server\routes\ambulanceRoutes.js
C:\Projects\HMS\server\routes\appointmentRoutes.js
C:\Projects\HMS\server\routes\bloodRoutes.js
C:\Projects\HMS\server\routes\chatbotRoutes.js
C:\Projects\HMS\server\routes\doctorRoutes.js
C:\Projects\HMS\server\routes\donorRoutes.js
C:\Projects\HMS\server\routes\driverRoutes.js
C:\Projects\HMS\server\routes\medicineRoutes.js
C:\Projects\HMS\server\routes\paymentRoutes.js
C:\Projects\HMS\server\routes\receptionRoutes.js
C:\Projects\HMS\server\routes\recordAccessRoutes.js
C:\Projects\HMS\server\routes\staffRoutes.js
C:\Projects\HMS\server\routes\testReportRoutes.js
C:\Projects\HMS\server\routes\testRoutes.js
C:\Projects\HMS\server\routes\userRoutes.js
```

Medicine and test catalog search remains available to doctors. The medicine catalog stays plaintext because the proposal classifies it as public reference data.

## 5.6 Frontend files

### `C:\Projects\HMS\client\src\pages\Login.jsx`

Handles the two-stage login response. When the backend returns `requiresTwoFactor`, the page asks for the authenticator code and retries login with the OTP.

### `C:\Projects\HMS\client\src\pages\ForgetPassword.jsx`

Stores the short-lived reset ticket returned by identity verification and sends that ticket with the new password.

### `C:\Projects\HMS\client\src\pages\Account.jsx`

Adds interfaces for TOTP setup, TOTP confirmation/disable, authenticated password change, and the old-record access panel.

### `C:\Projects\HMS\client\src\components\RecordAccessPanel\RecordAccessPanel.jsx`

Provides the patient and doctor consent workflow. Password input is held in component state and sent only for private-key operations.

### `C:\Projects\HMS\client\src\pages\Signup.jsx`

Passes doctor registration details needed for the encrypted doctor profile.

### `C:\Projects\HMS\client\src\pages\dashboard\DoctorDashboard.jsx`

Supports encrypted specialization and schedule updates, medicine/test selection, and old-record request workflow integration.

### `C:\Projects\HMS\client\src\pages\dashboard\PatientDashboard.jsx`

Uses the corrected specialization, appointment, prescription, and test-report endpoints under patient RBAC.

### `C:\Projects\HMS\client\src\components\PrescriptionPayment\PrescriptionPayment.jsx`

Uses patient-authorized prescription/payment data and the current protected record shape.

## 5.7 Setup and migration scripts

### `C:\Projects\HMS\server\scripts\setupCryptoEnv.js`

Creates missing `ENCRYPTION_KEY`, `SESSION_PRIVATE_KEY`, and `SESSION_PUBLIC_KEY` entries without printing secret values. For the existing project it preserves compatibility with the earlier JWT-secret-derived AES key.

### `C:\Projects\HMS\server\scripts\migrateProposalEncryption.js`

Dry-runs or applies proposal envelopes to existing users, doctors, appointments, prescriptions, test bookings, donors, blood requests, staff schedules, and reservations.

### `C:\Projects\HMS\server\scripts\upsertAdmin.js`

Creates or updates the configured admin with PBKDF2, RSA/ECC keys, a protected profile, and no hardcoded password.

### `C:\Projects\HMS\server\scripts\encryptExistingData.js`

Supports the earlier AES field-layer migration for sensitive strings.

## 5.8 Seed files

The active seed scripts were changed from asynchronous bcrypt assignments to awaited PBKDF2 hashes and user key generation. This fixes the earlier `Promise { <pending> }` password validation error.

```text
C:\Projects\HMS\server\seed\addDoctorSlots.js
C:\Projects\HMS\server\seed\checkAdmins.js
C:\Projects\HMS\server\seed\checkUser.js
C:\Projects\HMS\server\seed\createAdmins.js
C:\Projects\HMS\server\seed\createDemoAdmin.js
C:\Projects\HMS\server\seed\createDoctor.js
C:\Projects\HMS\server\seed\createDoctors.js
C:\Projects\HMS\server\seed\fixRivanAccount.js
C:\Projects\HMS\server\seed\seedFromMedicineJS.js
C:\Projects\HMS\server\seed\seedTestReports.js
C:\Projects\HMS\server\seed\seedTests.js
```

Admin passwords are read from environment variables instead of being embedded in source.

## 5.9 Configuration, package, and test files

### `C:\Projects\HMS\server\server.js`

Mounts `/api/record-access` and the existing protected route groups.

### `C:\Projects\HMS\server\package.json`

Adds crypto setup, migration, admin, and test commands. Removes `bcryptjs` and `jsonwebtoken`.

### `C:\Projects\HMS\server\package-lock.json`

No longer declares `bcryptjs` or `jsonwebtoken`.

### `C:\Projects\HMS\server\tests\crypto.test.js`

Tests PBKDF2, RSA, hybrid envelopes, ECC/ECDH, HMAC tamper rejection, ECDSA signatures, key rewrapping, TOTP, and session signatures.

### `C:\Projects\HMS\server\tests\rbac.test.js`

Tests role isolation, admin isolation, receptionist category enforcement, and verified-account rules.

### `C:\Projects\HMS\.gitignore`

### `C:\Projects\HMS\server\.gitignore`

### `C:\Projects\HMS\client\.gitignore`

These were converted from UTF-16 to normal UTF-8 so Git actually honors their rules. They now exclude `.env`, nested `.env` files, `node_modules`, builds, logs, and generated review files. Real cryptographic keys therefore no longer appear as untracked commit candidates.

# 6 End-to-End Security Flows

## 6.1 Registration flow

```text
POST /api/users/register
  -> validate role and password length
  -> normalize email
  -> PBKDF2 hash password with random salt
  -> generate RSA-2048 keypair
  -> generate P-256 ECC keypair
  -> wrap each private key using password-derived AES-GCM key
  -> build RSA profile envelope
  -> store public keys, wrapped private keys, hash, and envelope
  -> issue RSA-signed session token
```

A public caller cannot register as admin. Doctor, donor, staff, and driver accounts remain subject to verification rules.

## 6.2 Login and 2FA flow

```text
email + password
  -> locate account
  -> verify PBKDF2 hash
  -> if 2FA disabled: issue scoped session token
  -> if 2FA enabled:
       require OTP
       unwrap RSA private key using password
       RSA-decrypt TOTP secret
       verify current RFC 6238 code
       issue scoped session token
```

The session is issued only after both factors succeed.

## 6.3 Authenticated password change

```text
current password
  -> verify PBKDF2
  -> unwrap existing RSA and ECC private keys
new password
  -> create new random wrapping salts and keys
  -> wrap the same private keys again
  -> create a new PBKDF2 password hash
```

The public keys do not change, so existing record envelopes stay decryptable.

## 6.4 Forgotten-password reset

```text
email + phone + name
  -> identity match
  -> increment hidden reset version
  -> issue 10-minute RSA-signed password-reset ticket
ticket + new password
  -> verify signature, expiry, scope, and version
  -> rotate RSA/ECC keypairs
  -> increment key version
  -> disable 2FA
  -> reprotect owner records
  -> invalidate the ticket
```

Reset and login tokens use the same server signing keys but different scopes. Route middleware accepts only `session`.

## 6.5 Prescription and test-result protection

```text
Doctor owns appointment
  -> create prescription
  -> RSA envelope: record IDs and dates
  -> ECC envelope: medicine, dosage, duration, timing, notes, tests
  -> save patient key version

Patient uploads test result
  -> verify patient owns prescription
  -> update test result
  -> rebuild patient ECC clinical envelope
```

## 6.6 Patient-approved old-record access

```text
Doctor requests old record
  -> verify doctor has an appointment relationship with patient
  -> RSA-encrypt request metadata to patient
  -> ECC-encrypt reason to patient

Patient approves with password
  -> unwrap patient keys
  -> decrypt patient-owned prescription envelopes
  -> sign canonical approval statement with ECDSA
  -> RSA-encrypt metadata to doctor
  -> ECC-encrypt clinical content to doctor

Doctor decrypts with password
  -> verify doctor identity and key version
  -> verify patient ECDSA signature
  -> unwrap doctor keys
  -> decrypt only the approved copies
```

An admin token cannot call these decrypt routes because the router requires a patient or verified doctor role and the controller verifies ownership.

# 7 API Reference for Demonstration

## 7.1 Authentication and key lifecycle

```text
POST /api/users/register
POST /api/users/login
GET  /api/users/profile
PUT  /api/users/profile
POST /api/users/verify-user
POST /api/users/reset-password
PUT  /api/users/change-password
```

## 7.2 Two-factor authentication

```text
POST /api/users/2fa/setup
     body: { "password": "current password" }

POST /api/users/2fa/confirm
     body: { "password": "current password", "otp": "123456" }

POST /api/users/2fa/disable
     body: { "password": "current password", "otp": "123456" }

POST /api/users/login
     body: { "email": "...", "password": "...", "otp": "123456" }
```

## 7.3 Old-record consent

```text
POST /api/record-access/requests
GET  /api/record-access/requests/doctor
GET  /api/record-access/requests/patient
POST /api/record-access/requests/:id/view
POST /api/record-access/requests/:id/approve
POST /api/record-access/requests/:id/reject
POST /api/record-access/requests/:id/decrypt
POST /api/record-access/prescriptions/:id/decrypt
```

Every protected endpoint expects:

```http
Authorization: Bearer <RSA-signed-session-token>
```

# 8 Setup, NPM, and Verification

## 8.1 Install packages

Open PowerShell:

```powershell
cd C:\Projects\HMS\server
npm install
```

If the global npm launcher is misconfigured on this machine, use:

```powershell
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install
```

The server intentionally depends on `cors`, `dotenv`, `express`, and `mongoose`. It does not depend on `bcryptjs` or `jsonwebtoken`.

## 8.2 Generate environment encryption values

```powershell
cd C:\Projects\HMS\server
node scripts\setupCryptoEnv.js
```

The local file is:

```text
C:\Projects\HMS\server\.env
```

It should contain values named:

```dotenv
ENCRYPTION_KEY=<32-byte key encoded as 64 hexadecimal characters>
SESSION_PRIVATE_KEY="<PKCS8 PEM with escaped newline characters>"
SESSION_PUBLIC_KEY="<SPKI PEM with escaped newline characters>"
```

Do not type ordinary words such as `myprivatekey`. Do not commit the real file. The setup script generates cryptographically random values and valid PEM key material.

## 8.3 Configure the administrator

```powershell
cd C:\Projects\HMS\server
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="a strong private password"
npm run admin:upsert
```

The script rejects a missing or invalid `ADMIN_EMAIL`. The password is supplied through the environment, not embedded in source.

## 8.4 Run the application

Server:

```powershell
cd C:\Projects\HMS\server
npm start
```

Client:

```powershell
cd C:\Projects\HMS\client
npm run dev
```

After the session-scope hardening change, old browser tokens must be replaced by logging in again.

## 8.5 Run tests

```powershell
cd C:\Projects\HMS\server
npm test
```

Current result:

```text
tests: 13
passed: 13
failed: 0
```

The tests cover:

- Random salts and PBKDF2 verification.
- Malformed PBKDF2 and wrapped-key rejection.
- RSA-OAEP and hybrid RSA round trips.
- RSA envelope tamper rejection.
- ECC/ECDH round trip and tamper rejection.
- Prescription RSA/ECC data separation.
- Matching patient/doctor ECDH-derived HMAC keys.
- ECDSA approval and altered-message rejection.
- Private-key rewrapping without key replacement.
- RFC 6238 TOTP test vectors and time windows.
- RSA session signature and malformed-token rejection.
- Patient, doctor, admin, staff-category, and verification boundaries.

Frontend production build:

```powershell
cd C:\Projects\HMS\client
npm run build
```

The build passes. Vite reports only a non-failing large JavaScript chunk warning.

## 8.6 Verify prohibited dependencies are absent

```powershell
cd C:\Projects\HMS\server
npm ls bcryptjs jsonwebtoken --depth=0
```

The expected tree is empty.

## 8.7 Migrate existing data

Read-only dry run:

```powershell
cd C:\Projects\HMS\server
npm run crypto:migrate
```

Apply:

```powershell
npm run crypto:migrate:apply
```

The migration is additive. It skips records that already have proposal envelopes and does not invent private keys when a legacy user's password is unavailable.

Recorded migration state on 2026-09-06:

| Item | Count |
| --- | ---: |
| Users in audit | 29 |
| Users with RSA/ECC keys | 26 |
| Eligible protected documents | 51 |
| Additional eligible documents after apply | 0 |
| Rows skipped because owner keys are missing | 9 |

Three legacy bcrypt users need one password reset. For the legacy patient, the reset handler automatically protects two appointments, one prescription, one online test booking, and one blood request.

# 9 Lab Evaluation Walkthrough

## 9.1 Recommended five-minute demonstration

1. Open `server/utils/password.js` and explain the salt, iterations, SHA-256, stored format, and timing-safe comparison.
2. Open `server/utils/keyManagement.js` and show RSA/P-256 generation plus AES-GCM private-key wrapping.
3. Open `server/utils/asymmetricEncryption.js` and trace one RSA envelope and one ECC envelope.
4. Run `npm test` and point out the tamper-rejection, ECDH, signature, key-rewrap, TOTP, session, and RBAC tests.
5. Register a disposable patient and inspect only ciphertext prefixes in MongoDB. Never reveal actual key contents.
6. Enable 2FA, show that login without OTP fails, and show that a current authenticator code succeeds.
7. Change the password and explain that public keys remain the same while wrapped private-key ciphertext changes.
8. Demonstrate an old-record request: doctor requests, patient approves, doctor decrypts the approved copy.
9. Show that an admin token receives 403 from patient-only or doctor-only routes.

## 9.2 Short explanation to memorize

> Every user receives an RSA-2048 keypair and a P-256 keypair at registration. Public keys are stored for encryption and verification, while private keys are AES-GCM wrapped with keys derived from the user's password using PBKDF2-SHA256. Fixed metadata is stored in hybrid RSA-OAEP envelopes, and variable-length clinical data uses an ECIES-style P-256 ECDH construction. HKDF derives separate AES and HMAC keys, so ciphertext changes are detected. Passwords use random-salt PBKDF2, TOTP provides a second factor, and server sessions are signed with RSA. A patient signs old-record approval with ECDSA, after which fresh copies are encrypted to the approved doctor. RBAC and ownership checks prevent other roles, including admins, from using the medical decrypt endpoints.

## 9.3 Common questions and answers

### Why hash passwords instead of encrypting them?

The server only needs to verify a password, not recover it. A salted, slow password derivation function reduces the usefulness of a stolen password database.

### Why is the salt stored in plaintext?

The salt is not a secret. Its purpose is to make identical passwords produce different hashes and to defeat precomputed rainbow tables.

### Why PBKDF2 instead of one SHA-256 call?

PBKDF2 repeats the underlying operation many times. That deliberately makes password guessing more expensive while legitimate login remains practical.

### Why use both RSA and AES in the RSA envelope?

RSA safely encrypts only small values. AES efficiently encrypts the full JSON record, and RSA encrypts the random AES content key.

### Why use ECC for clinical text?

The proposal maps variable-length clinical information to ECC. ECIES itself is a construction, so MediSecure combines ephemeral P-256 ECDH, HKDF, AES-GCM, and HMAC.

### Does ECDH encrypt data directly?

No. ECDH derives a shared secret. HKDF turns that secret into keys, and AES-GCM performs the actual data encryption.

### Why have AES-GCM authentication and an HMAC?

GCM already authenticates its ciphertext. The explicit HMAC-SHA256 satisfies the proposal's MAC requirement and authenticates the complete serialized envelope, including algorithm and key-agreement fields.

### What is the difference between HMAC and ECDSA?

HMAC proves that someone with a shared secret generated a value. ECDSA proves that the holder of a particular private signing key approved a message, and anyone with the public key can verify it.

### Why are private keys wrapped with the password?

Storing a raw private key would allow a database reader to decrypt patient data. Password-derived wrapping means the stored private-key text is ciphertext.

### What happens when the user changes their password?

The old password unwraps the existing keys. Those same keys are wrapped again under the new password, so encrypted records remain readable.

### What happens when the user forgets their password?

The old keys cannot be recovered from the forgotten password. The system rotates the keypairs, increments the key version, disables 2FA, and rebuilds owner envelopes from the operational encrypted data layer.

### Why is the TOTP secret RSA-encrypted?

The server must recover the TOTP secret to verify authenticator codes, so it cannot be one-way hashed. RSA encryption protects the short secret at rest.

### Why does TOTP use SHA-1 while records use SHA-256?

HMAC-SHA1 is the standard default expected by common RFC 6238 authenticator applications. Record integrity is a separate use case and uses HMAC-SHA256.

### How does the system stop a reset token from acting as a login token?

Every login token has `scope: "session"`. Every reset ticket has `scope: "password-reset"`. Authentication middleware rejects anything that is not a session.

### Can an admin decrypt patient prescriptions?

No supported route accepts the admin role for patient or doctor private-key operations. The admin manages accounts and schedules but does not possess the patient's wrapped-key password.

### How is tampering detected?

The decryptor recomputes the HMAC over the envelope. A changed ciphertext, IV, tag, salt, wrapped key, or ephemeral public key produces a different MAC and is rejected.

### What is a blind index?

A blind index is a deterministic HMAC of a normalized value. It supports exact-match searches over randomized encrypted fields without placing the original searchable value in the index.

# 10 Limitations and Remaining Actions

## 10.1 Legacy keyless users

The implementation cannot create a useful password-wrapped private key for an existing user without knowing that user's password. Three legacy users must complete one password reset. Until then, nine rows remain outside the new owner-envelope migration.

## 10.2 Operational query fields

The current application keeps database references and scheduling projections available so Mongoose relationships, appointment searches, and existing dashboards continue to work. The proposal-mapped protected copy is stored in an owner-specific RSA/ECC envelope, and clinical strings also use AES-GCM field encryption.

A literal interpretation of "never plaintext" for every relationship ID and scheduling field would require a larger design change: blind-indexed references plus password/private-key decryption in every affected read flow. This compatibility decision should be stated honestly during evaluation.

## 10.3 Forgotten-password recovery tradeoff

Private keys wrapped only by a forgotten password cannot be recovered. This implementation rotates keys and rebuilds records from the operational layer. A production zero-knowledge system would need a separate, carefully protected recovery key or recovery service.

## 10.4 Bearer token storage

RSA signing prevents token forgery; it does not make a stolen bearer token harmless. Production hardening should also use secure cookie policy, Content Security Policy, short lifetimes, revocation, and HTTPS.

# 11 Glossary

| Term | Meaning |
| --- | --- |
| AES | Fast symmetric block cipher |
| GCM | Authenticated encryption mode for AES |
| RSA | Public-key algorithm used here for OAEP encryption and signatures |
| OAEP | Randomized padding scheme for RSA encryption |
| ECC | Elliptic Curve Cryptography |
| P-256 | The elliptic curve also called `prime256v1` |
| ECDH | Elliptic Curve Diffie-Hellman key agreement |
| ECIES | Hybrid encryption design based on elliptic-curve key agreement |
| ECDSA | Elliptic Curve Digital Signature Algorithm |
| HKDF | Hash-based Key Derivation Function |
| HMAC | Keyed hash used as a message authentication code |
| PBKDF2 | Password-Based Key Derivation Function 2 |
| Salt | Random non-secret input that makes password hashes unique |
| IV | Initialization vector or nonce used by an encryption mode |
| Authentication tag | GCM output used to detect changes |
| Ciphertext | Encrypted form of plaintext |
| Envelope encryption | Encrypt data with a random content key, then encrypt that key asymmetrically |
| TOTP | Time-Based One-Time Password |
| RBAC | Role-Based Access Control |
| Blind index | Deterministic keyed digest used to search protected data |
| Key rotation | Replacing a cryptographic keypair and incrementing its version |
| Key rewrapping | Encrypting the same private key under a newly derived wrapping key |

# 12 Final Completion Checklist

- [x] PBKDF2-HMAC-SHA256 passwords with random salts.
- [x] Per-user RSA-2048 and P-256 keypairs.
- [x] Password-derived private-key wrapping.
- [x] Authenticated password-change rewrapping.
- [x] Forgotten-password key rotation and record reprotection.
- [x] RSA-OAEP metadata envelopes.
- [x] ECC/ECDH clinical envelopes.
- [x] HKDF-SHA256 key separation.
- [x] HMAC-SHA256 tamper detection.
- [x] ECDSA patient consent signatures.
- [x] RSA-signed, scoped session tokens.
- [x] RFC 6238 TOTP 2FA.
- [x] Patient, doctor, staff-category, donor, driver, and admin RBAC.
- [x] Patient ownership and doctor-assignment checks.
- [x] Admin denied medical decrypt routes.
- [x] `bcryptjs` and `jsonwebtoken` removed.
- [x] Stable local cryptographic environment values generated.
- [x] Secret files correctly ignored by Git.
- [x] Legacy migration script and automatic post-reset migration.
- [x] Thirteen passing crypto/RBAC tests.
- [ ] Three legacy users complete one password reset to protect the final nine rows.

