# MediSecure Encryption Implementation Notes

> Historical note: this file describes the first encryption pass. The current, proposal-aligned implementation and lab guide is `docs/encryption-proposal-compliance.md`. Where the two documents differ, the compliance guide is authoritative.

Date: 2026-08-27

This document summarizes the encryption and security work implemented in the HMS/MediSecure project. It is written as a lab evaluation study note: what was added, why it was added, where it is located, and how to explain it.

## Project Security Goal

MediSecure is a MERN-stack hospital management system. The project proposal requires sensitive hospital data to be protected using encryption, hashing, MACs, asymmetric keys, session signing, and RBAC.

The main goal of today's implementation was:

- Protect sensitive database fields at rest.
- Keep app/API behavior normal by decrypting values automatically.
- Keep exact-match search working without storing plaintext searchable values.
- Replace password hashing with a custom PBKDF2-SHA256 implementation.
- Replace shared-secret JWT signing with RSA-signed session tokens.
- Add user RSA/ECC key material for future patient-approved record sharing.
- Provide a backfill script to encrypt existing plaintext data.

## Files Added

### `server/utils/encryption.js`

This is the main encryption helper module.

It implements:

- AES-256-GCM encryption.
- AES-GCM authentication tag.
- Extra HMAC-SHA256 over the ciphertext payload.
- Automatic decryption for stored encrypted strings.
- Blind indexes for searchable encrypted fields.
- Mongoose schema helpers for encrypted string fields.

Important functions:

- `encryptValue(value)`: encrypts plaintext and returns an `enc:v2:` string.
- `decryptValue(value)`: decrypts `enc:v1:` or `enc:v2:` strings.
- `blindIndex(value)`: creates deterministic HMAC-SHA256 hash for exact-match lookup.
- `encryptedString(options)`: Mongoose field helper that encrypts on set and decrypts on get.
- `encryptionSchemaOptions`: enables decrypted values in `toJSON()` and `toObject()`.

How to explain:

> Sensitive fields are encrypted before they are stored in MongoDB. The app still receives normal readable values because Mongoose getters decrypt them automatically. For tamper detection, the ciphertext payload includes a MAC. If the encrypted value is modified in the database, decryption fails.

## Encryption Format

Encrypted values are stored like this:

```text
enc:v2:<iv>:<authTag>:<ciphertext>:<mac>
```

Meaning:

- `enc:v2` identifies the encryption version.
- `iv` is a random initialization vector.
- `authTag` is produced by AES-GCM.
- `ciphertext` is the encrypted data.
- `mac` is an HMAC-SHA256 integrity check.

Example database value:

```text
enc:v2:q...:J...:k...:n...
```

The user should never see this in the frontend. The frontend/API should see normal data such as:

```text
01712345678
```

## Master Encryption Key

The encryption module reads:

```env
ENCRYPTION_KEY
```

It should be a 32-byte key, usually written as 64 hex characters.

Example generation command:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If `ENCRYPTION_KEY` is missing, the code falls back to a derived development key and prints a warning. This is only for development. For lab/demo and production, a stable `ENCRYPTION_KEY` must be set.

## Blind Indexes

Normal AES encryption is randomized. The same phone number encrypted twice will produce different ciphertext. This is good for security, but it breaks database search.

Example problem:

```js
User.findOne({ phone: '01712345678' })
```

This does not work reliably after encryption because MongoDB stores ciphertext, not plaintext.

Solution: blind indexes.

A blind index is a deterministic HMAC of a normalized value:

```js
blindIndex('01712345678')
```

The app stores:

```js
phone_hash
blood_type_hash
location_hash
```

These hashes are used only for exact-match lookup.

How to explain:

> We cannot search encrypted random ciphertext directly. So for fields that need exact-match search, we store an HMAC-based blind index. It lets the server find matching records without storing the original plaintext.

## Password Hashing

### `server/utils/password.js`

This module implements custom PBKDF2-SHA256 password hashing.

It implements:

- Random salt per password.
- PBKDF2 with SHA-256.
- 120,000 iterations.
- Constant-time comparison using `crypto.timingSafeEqual`.

Stored password format:

```text
pbkdf2:v1:<iterations>:<salt>:<hash>
```

Example:

```text
pbkdf2:v1:120000:abc...:xyz...
```

Important functions:

- `hashPassword(password)`
- `verifyPassword(password, storedHash)`
- `isPbkdf2Hash(value)`

How to explain:

> Passwords are not encrypted because encrypted data can be decrypted. Passwords are hashed with PBKDF2-SHA256 using a random salt, so even two users with the same password get different stored hashes.

## Legacy Bcrypt Compatibility

Before today's work, the app used `bcryptjs`.

To avoid locking out existing users:

- New registrations use PBKDF2.
- New password resets use PBKDF2.
- Login first checks PBKDF2.
- If the stored password is old bcrypt, login still works.
- After successful bcrypt login, the password is upgraded to PBKDF2.

Location:

```text
server/controllers/userController.js
```

How to explain:

> The migration is backward-compatible. Existing users can still log in, and after they log in successfully, their password hash is automatically upgraded to the new PBKDF2 format.

## Session Tokens

### `server/utils/sessionToken.js`

This module replaces shared-secret JWT signing with a custom RSA-signed JWT-like token.

It implements:

- Header/body/signature format.
- RS256-style signing using `RSA-SHA256`.
- Token expiry using `iat` and `exp`.
- Signature verification with the RSA public key.

Environment variables:

```env
SESSION_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SESSION_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
```

Important functions:

- `signSessionToken(payload)`
- `verifySessionToken(token)`

Used in:

```text
server/controllers/userController.js
server/middleware/authMiddleware.js
```

How to explain:

> Instead of signing sessions with one symmetric secret, the server signs tokens with an RSA private key and verifies them with the public key. If someone changes the token payload, the signature verification fails.

## Key Management

### `server/utils/keyManagement.js`

This module creates user key material at registration.

It implements:

- One RSA keypair per user.
- One ECC keypair per user.
- Password-derived wrapping key.
- AES-256-GCM wrapping of private keys.

Stored user key fields:

```js
rsa_public_key
rsa_private_key_wrapped
ecc_public_key
ecc_private_key_wrapped
```

The public keys can be stored in plaintext because public keys are not secret.

The private keys are wrapped/encrypted before being stored:

```text
wrapped:v1:<iterations>:<salt>:<iv>:<tag>:<ciphertext>
```

How to explain:

> Each user receives RSA and ECC keypairs. The public keys are stored normally, but private keys are encrypted using a key derived from the user's password. This supports the proposal's future design where patient medical records can be shared only with approved doctors.

## User Model Changes

### `server/models/User.js`

Encrypted fields:

```js
phone
location
blood_type
```

Blind index:

```js
phone_hash
```

Key-management fields:

```js
two_factor_enabled
two_factor_secret_encrypted
rsa_public_key
rsa_private_key_wrapped
ecc_public_key
ecc_private_key_wrapped
```

Pre-save hook:

```js
userSchema.pre('save', ...)
```

This hook updates `phone_hash` whenever `phone` changes.

How to explain:

> The user model encrypts contact and blood type information. A phone hash is stored separately so password reset/profile verification can still match the user's phone number.

## Blood Donor Model Changes

### `server/models/BloodDonor.js`

Encrypted fields:

```js
blood_type
location
```

Blind indexes:

```js
blood_type_hash
location_hash
```

Reason:

The donor matching feature searches by blood type and location. Since encrypted fields cannot be searched directly, blind indexes allow exact matching.

How to explain:

> Donor blood type and location are sensitive, so they are encrypted. Since patients need to search donors by blood group and location, we use blind indexes for matching.

## Blood Request Model Changes

### `server/models/BloodRequest.js`

Encrypted fields:

```js
phone
blood_group
note
```

Reason:

Blood requests contain patient contact and health-related information. These should not be stored as plaintext in MongoDB.

## Ambulance Call Model Changes

### `server/models/AmbulanceCall.js`

Encrypted field:

```js
pickup_location
```

Reason:

Pickup location is sensitive personal location data.

## Prescription Model Changes

### `server/models/Prescription.js`

Encrypted fields:

```js
notes
medicines.dosage
medicines.duration
tests.description
tests.test_report
```

Reason:

Prescriptions and test reports are medical data. They are part of the most sensitive information in a hospital management system.

How to explain:

> Prescription notes, medicine instructions, and test reports are encrypted at rest. Doctors and patients still see readable values through the API because Mongoose decrypts them when converting documents to JSON.

## Controller Changes

### Registration

Location:

```text
server/controllers/userController.js
```

During registration:

- Validate role.
- Hash password using PBKDF2.
- Generate RSA and ECC keypairs.
- Wrap private keys using the user's password.
- Save encrypted profile fields through Mongoose setters.
- Sign a session token using RSA.

### Login

During login:

- Find user by email.
- Verify PBKDF2 password.
- If old bcrypt hash exists, verify with bcrypt.
- If bcrypt login succeeds, upgrade stored password to PBKDF2.
- Sign and return RSA-based session token.

### Profile Update

During profile update:

- User confirms password.
- Phone/location are assigned normally.
- Mongoose setters encrypt the fields.
- `phone_hash` updates automatically.

### Verify User Info

The previous lookup used:

```js
User.findOne({ email, phone, name })
```

This would fail after encryption.

Now it uses:

```js
phone_hash: blindIndex(phone)
```

It also includes a fallback scan for old plaintext records that have not been migrated yet.

### Donor Matching

The previous lookup used:

```js
BloodDonor.find({ blood_type, location, available: true })
```

This would fail after encryption.

Now it uses:

```js
blood_type_hash: blindIndex(blood_type)
location_hash: blindIndex(location)
```

It also includes fallback support for old plaintext records.

## Authentication Middleware

### `server/middleware/authMiddleware.js`

Before:

```js
jwt.verify(token, process.env.JWT_SECRET)
```

Now:

```js
verifySessionToken(token)
```

Meaning:

The middleware verifies the RSA signature and expiry before loading the user.

How to explain:

> The middleware does not trust the token directly. It verifies the RSA signature first, then loads the user from the database and attaches it to `req.user`.

## Existing Data Backfill

### `server/scripts/encryptExistingData.js`

Purpose:

New data is encrypted automatically, but old data already in MongoDB may still be plaintext. This script re-saves existing documents so Mongoose setters encrypt the fields and pre-save hooks create blind indexes.

Run from:

```powershell
cd C:\Projects\HMS\server
node scripts\encryptExistingData.js
```

Or:

```powershell
npm run encrypt:existing
```

It processes:

- Users
- Blood donors
- Blood requests
- Ambulance calls
- Prescriptions

## Environment Variables Needed

Add these to:

```text
C:\Projects\HMS\server\.env
```

Required for app:

```env
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_existing_secret_or_any_strong_random_value
ENCRYPTION_KEY=64_hex_character_key
SESSION_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SESSION_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
```

`JWT_SECRET` is kept mostly for older fallback behavior and development fallback. The new session system uses RSA keys.

## How To Generate Keys

Use PowerShell:

```powershell
node -e "const crypto=require('crypto'); const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}}); console.log('ENCRYPTION_KEY='+crypto.randomBytes(32).toString('hex')); console.log('SESSION_PRIVATE_KEY='+JSON.stringify(keys.privateKey.replaceAll('\n','\\n'))); console.log('SESSION_PUBLIC_KEY='+JSON.stringify(keys.publicKey.replaceAll('\n','\\n')));"
```

Copy the three output lines exactly into `server/.env`.

Do not commit `.env` to GitHub.

## How To Check Encryption Works

### Check in MongoDB

Open MongoDB Compass or Atlas and inspect collections:

- `users`
- `prescriptions`
- `bloodrequests`
- `ambulancecalls`
- `blooddonors`

Sensitive values should look like:

```text
enc:v2:...
```

They should not look like:

```text
01712345678
Dhaka
A+
```

### Check through the API/app

The frontend/API should still show normal readable data because getters decrypt automatically.

Example:

- MongoDB stores: `enc:v2:...`
- API returns: `01712345678`

## How To Explain AES-GCM + HMAC

AES-GCM already provides authenticated encryption using an authentication tag. We also added an explicit HMAC-SHA256 over the ciphertext payload because the proposal specifically mentioned storing a MAC alongside ciphertext.

Good lab answer:

> AES-256-GCM encrypts the sensitive field and gives confidentiality plus authentication. We additionally compute HMAC-SHA256 over the encrypted payload and store it with the ciphertext, matching the proposal's ciphertext-plus-MAC requirement. If the database value is changed, the MAC check fails and the field is not decrypted.

## How To Explain Public vs Private Keys

Public key:

- Not secret.
- Can be stored in database.
- Used by others to encrypt data for a user or verify a signature.

Private key:

- Must stay secret.
- Can decrypt data or create signatures.
- In this project, private keys are stored only after being wrapped/encrypted with a password-derived key.

Good lab answer:

> Public keys can be stored openly, but private keys are encrypted before storage. The wrapping key is derived from the user's password, so the database does not store usable private keys in plaintext.

## What Is Fully Implemented

- Field encryption for sensitive MongoDB fields.
- Ciphertext integrity MAC.
- Blind indexes for searchable encrypted fields.
- PBKDF2 password hashing for new/updated passwords.
- Legacy bcrypt login compatibility.
- RSA-signed session tokens.
- Per-user RSA/ECC key generation.
- Password-wrapped private keys.
- Existing-data encryption backfill script.
- RBAC middleware still enforces route access based on role and verification status.

## What Is Partially Implemented

### Two-Factor Authentication

The `User` model now has:

```js
two_factor_enabled
two_factor_secret_encrypted
```

But the full 2FA flow is not implemented yet.

Still needed:

- Generate TOTP secret.
- Encrypt/store the TOTP secret.
- Ask for OTP code during login.
- Verify OTP before issuing session token.

### Patient-Approved Doctor Access

The proposal says doctors should request access to previous visits and prescriptions, and patients should approve.

The crypto foundation is ready because users now have public/private key material, but the full workflow is not implemented yet.

Still needed:

- Access request model.
- Doctor request API.
- Patient approval API/UI.
- Re-encryption or access grant logic.
- Doctor view for approved previous prescriptions.

### Per-Record RSA Encryption

Currently, prescription fields are encrypted with server-side AES-256-GCM. The proposal describes encrypting each patient's medical records with the patient's RSA public key and re-encrypting for approved doctors.

Today's implementation prepares key material for that design but does not fully replace prescription encryption with patient-public-key encryption.

## Lab Evaluation Short Script

Use this if asked to explain today's work:

> I implemented encryption at rest for sensitive hospital data. The backend uses AES-256-GCM to encrypt fields like phone, location, blood group, ambulance pickup location, prescription notes, dosage, duration, and test reports. Encrypted values are stored in MongoDB with an `enc:v2:` prefix, plus an HMAC-SHA256 MAC for tamper detection.
>
> For searchable encrypted fields, I added blind indexes. Since AES-GCM produces different ciphertext every time, we cannot directly search encrypted values. So for exact-match fields like phone, donor blood type, and location, the system stores an HMAC hash and searches using that.
>
> I also changed password handling from bcrypt for new users to custom PBKDF2-SHA256 with random salts. Existing bcrypt users can still log in, and after successful login their password is upgraded to PBKDF2.
>
> Session tokens are now signed with RSA using a private key and verified with the public key. This matches the proposal's asymmetric session management requirement.
>
> Finally, each user gets RSA and ECC keypairs at registration. Public keys are stored normally, while private keys are encrypted with a key derived from the user's password. This prepares the system for patient-approved medical record sharing with doctors.

## Testing Summary

The following checks were run:

- Syntax checks for crypto utilities.
- Syntax checks for changed controllers and middleware.
- Import sweep for models/controllers.
- PBKDF2 hash and verify smoke test.
- RSA session token sign and verify smoke test.
- Private key wrap and unwrap smoke test.
- Encrypted field smoke test.
- Tampered ciphertext MAC failure smoke test.
- Frontend Vite build using local Vite binary.

## Important Demo Checklist

Before showing the project:

1. Add stable keys to `server/.env`.
2. Start MongoDB/confirm Atlas connection.
3. Run:

```powershell
cd C:\Projects\HMS\server
node scripts\encryptExistingData.js
```

4. Register a new user.
5. Login.
6. Check MongoDB: sensitive fields should show `enc:v2:...`.
7. Check frontend/API: values should still appear readable.
8. Test donor matching and password reset/profile verification.

## Patient Appointment Dashboard Fix

The patient appointment flow depends on this sequence:

1. `GET /api/appointment/specialties` reads unique values from `Doctor.specialization`.
2. `GET /api/appointment/doctors/:specialty` returns matching doctor profiles and populated user details.
3. `GET /api/appointment/doctor/:doctorId/slots/:date` returns available slots.
4. `POST /api/appointment/book` creates the appointment and increments the slot booking count.

Two code problems were corrected:

- `PatientDashboard.jsx` called an undefined `setAvailables` variable after fetching doctors. This caused a runtime error immediately after a successful request.
- The appointment API now trims, deduplicates, and sorts specialization values. Doctor matching is case-insensitive and safely handles spaces. Orphaned Doctor records with no linked User are ignored instead of crashing the entire response.

The dashboard now also shows loading and API error states, validates array responses, and URL-encodes specialization names before requesting doctors.

The configured MongoDB database was checked during debugging and contained one patient but zero doctor users and zero Doctor profiles. Therefore, the specialization endpoint correctly returned an empty list even after the code fix.

For demo data, set a strong `DEMO_DOCTOR_PASSWORD` value with at least 12 characters and run:

```powershell
cd C:\Projects\HMS\server
npm run seed:doctors
npm run seed:doctor-slots
```

The updated doctor seed uses PBKDF2 passwords and creates the RSA/ECC key material described in the proposal. It is idempotent: it reuses matching doctor users, creates missing Doctor profiles, and does not overwrite an existing specialization. The slot seed creates future appointment slots for all Doctor profiles.

During the first seed run, Mongoose reported that `password` contained `Promise { <pending> }`. Both `hashPassword()` and `generateUserKeyMaterial()` are asynchronous. The seed was corrected to `await` both operations before passing their string/object results into `User.create()`. The failed validation created no partial doctor records. After correction, 25 Doctor profiles and 25 unique specializations were created, and each doctor received 286 future slots (excluding Fridays).

## Doctor Medicine Search Fix

The Doctor Dashboard sends medicine queries to `GET /api/medicines/autocomplete?q=<search>`. The frontend and API response contract were correct, but the configured MongoDB `medicines` collection contained zero records.

The medicine seed was changed from a destructive `deleteMany()` plus one-at-a-time inserts to non-destructive, idempotent `bulkWrite()` upserts in batches of 500. Records are deduplicated using drug name, manufacturer, description, and consumption type. Running `node seed/seedFromMedicineJS.js` populated 21,653 unique medicines.

The dashboard now URL-encodes search text, validates the returned array, and displays authentication or API errors separately from a genuine no-results state. A real controller test for `Napa` returned HTTP 200 with 18 matching medicines.

## Test Report Fetching Fix

Uploaded test results are stored as encrypted values in `Prescription.tests[].test_report`; the separate `TestReport` collection stores recommended test references and showing dates, not the uploaded result itself. The patient prescription API previously omitted the nested test ID, report value, and report date, so the frontend could not fetch or update an existing result.

The payment prescription response now includes `_id`, `test_report`, `report_date`, and `status` for every prescribed test. The patient prescription interface displays pending/completed status, decrypted report text, upload date, and a control for uploading or replacing report text or a report link. Uploads use the existing ownership-checked endpoint and are encrypted by the Prescription schema before MongoDB storage.

The configured database initially had zero Test master records, which made doctor test autocomplete empty. A non-destructive, idempotent `seed:test-catalog` command was added and used to create 15 common tests. No fake patient prescription or medical report was inserted.
