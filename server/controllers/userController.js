import User from '../models/User.js';
import { blindIndex } from '../utils/encryption.js';
import {
  generateUserKeyMaterial,
  rewrapUserPrivateKeys,
  unwrapPrivateKey
} from '../utils/keyManagement.js';
import { encryptRsaEnvelope, rsaDecrypt, rsaEncrypt } from '../utils/asymmetricEncryption.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signSessionToken, verifySessionToken } from '../utils/sessionToken.js';
import { createTotpUri, generateTotpSecret, verifyTotp } from '../utils/totp.js';
import Prescription from '../models/Prescription.js';
import Doctor from '../models/Doctor.js';
import { protectExistingRecordsForUser } from '../utils/userRecordMigration.js';

const PRIVATE_KEY_SELECTION = '+rsa_private_key_wrapped +ecc_private_key_wrapped';
const TWO_FACTOR_SELECTION = '+two_factor_secret_encrypted +two_factor_pending_secret_encrypted +two_factor_setup_expires_at';

const passwordIsStrongEnough = (password) => (
  typeof password === 'string' && password.length >= 8
);

const verifyStoredPassword = async (user, password) => {
  return verifyPassword(password, user.password);
};

const buildProfileEnvelope = (profile, keyMaterial) => encryptRsaEnvelope(
  {
    name: profile.name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    location: profile.location || '',
    blood_type: profile.blood_type || ''
  },
  keyMaterial.rsa_public_key,
  keyMaterial.ecc_public_key
);

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  location: user.location,
  blood_type: user.blood_type,
  role: user.role,
  staff_category: user.staff_category || null,
  is_verified: user.is_verified,
  is_active_donor: user.is_active_donor,
  two_factor_enabled: Boolean(user.two_factor_enabled),
  key_version: user.key_version || 1
});

export const registerUser = async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    location,
    blood_type,
    role,
    staff_category,
    specialization,
    qualification
  } = req.body;

  try {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(400).json({ message: 'Email already registered' });

    if (!passwordIsStrongEnough(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const validRoles = ['doctor', 'patient', 'donor', 'ambulance_driver', 'staff'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role selected' });
    }

    // Validate staff_category if role is staff
    if (role === 'staff') {
      const validStaffCategories = ['receptionist', 'nurse', 'ward_boy'];
      if (!staff_category || !validStaffCategories.includes(staff_category)) {
        return res.status(400).json({
          message: 'Invalid staff category. Must be: receptionist, nurse, or ward_boy'
        });
      }
    }

    const hashedPassword = await hashPassword(password);
    const autoVerified = role === 'patient';
    const keyMaterial = await generateUserKeyMaterial(password);
    const profile_rsa_envelope = buildProfileEnvelope(
      { name, email: normalizedEmail, phone, location, blood_type },
      keyMaterial
    );

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      location,
      blood_type,
      role,
      staff_category: role === 'staff' ? staff_category : undefined,
      is_verified: autoVerified,
      profile_rsa_envelope,
      ...keyMaterial
    });

    if (role === 'doctor') {
      const doctor = new Doctor({
        user_id: user._id,
        specialization: String(specialization || '').trim(),
        qualification: String(qualification || '').trim(),
        available_slots: []
      });
      doctor.profile_rsa_envelope = encryptRsaEnvelope({
        doctor_id: doctor._id.toString(),
        user_id: user._id.toString(),
        name: user.name,
        specialization: doctor.specialization,
        qualification: doctor.qualification
      }, user.rsa_public_key, user.ecc_public_key);
      await doctor.save();
    }

    const token = signSessionToken(
      {
        id: user._id,
        scope: 'session',
        role: user.role,
        staff_category: user.staff_category || null,
        two_factor_enabled: false
      }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        staff_category: user.staff_category || null
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req, res) => {
  const { email, password, otp } = req.body;

  try {
    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() })
      .select(`${PRIVATE_KEY_SELECTION} ${TWO_FACTOR_SELECTION}`);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await verifyStoredPassword(user, password);
    if (!isMatch) return res.status(401).json({
      message: 'Invalid email or password. Legacy accounts must use password reset once.'
    });

    if (user.two_factor_enabled) {
      if (!otp) {
        return res.status(401).json({
          message: 'Authenticator code is required',
          requiresTwoFactor: true
        });
      }

      try {
        const rsaPrivateKey = await unwrapPrivateKey(user.rsa_private_key_wrapped, password);
        const secret = rsaDecrypt(user.two_factor_secret_encrypted, rsaPrivateKey);
        if (!verifyTotp(secret, otp)) {
          return res.status(401).json({
            message: 'Invalid or expired authenticator code',
            requiresTwoFactor: true
          });
        }
      } catch (error) {
        console.error('Two-factor verification error:', error.message);
        return res.status(401).json({ message: 'Unable to verify authenticator code' });
      }
    }

    const token = signSessionToken(
      {
        id: user._id,
        scope: 'session',
        role: user.role,
        staff_category: user.staff_category || null,
        two_factor_enabled: Boolean(user.two_factor_enabled)
      }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        staff_category: user.staff_category || null
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(publicUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, location, password, is_active_donor, staff_category } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Optional toggle for donor availability (doesn't require password)
    if (typeof is_active_donor !== 'undefined') {
      user.is_active_donor = is_active_donor;
    }

    // Update staff_category if user is staff and provided
    if (user.role === 'staff' && staff_category) {
      const validStaffCategories = ['receptionist', 'nurse', 'ward_boy'];
      if (!validStaffCategories.includes(staff_category)) {
        return res.status(400).json({
          message: 'Invalid staff category. Must be: receptionist, nurse, or ward_boy'
        });
      }
      user.staff_category = staff_category;
    }

    // If user is updating profile info (name, phone, location), verify password
    if (name || phone || location) {
      if (!password) {
        return res.status(400).json({ message: 'Password confirmation is required' });
      }

      const isMatch = await verifyStoredPassword(user, password);
      if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

      user.name = name || user.name;
      user.phone = phone || user.phone;
      user.location = location || user.location;
    }

    if (user.rsa_public_key && user.ecc_public_key) {
      user.profile_rsa_envelope = buildProfileEnvelope(user, user);
    }
    const updatedUser = await user.save();

    res.json({
      ...publicUser(updatedUser),
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
};

export const verifyUserInfo = async (req, res) => {
  const { email, phone, name } = req.body;
  if (
    typeof email !== 'string' || !email.trim() ||
    typeof phone !== 'string' || !phone.trim() ||
    typeof name !== 'string' || !name.trim()
  ) {
    return res.status(400).json({ message: 'Email, phone, and name are required' });
  }

  const phoneHash = blindIndex(phone);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail, name, phone_hash: phoneHash })
    .select('+password_reset_version');

  if (!user) {
    const candidates = await User.find({ email: normalizedEmail, name })
      .select('+phone_hash +password_reset_version');
    user = candidates.find((candidate) => (
      candidate.phone_hash === phoneHash || candidate.phone === phone
    ));
  }

  if (!user) return res.status(404).json({ message: 'User not found with provided details' });

  user.password_reset_version = (user.password_reset_version || 0) + 1;
  await user.save();
  const resetToken = signSessionToken(
    {
      id: user._id,
      scope: 'password-reset',
      reset_version: user.password_reset_version
    },
    { expiresInSeconds: 10 * 60 }
  );

  res.json({ success: true, resetToken });
};

export const resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!passwordIsStrongEnough(newPassword)) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  let resetPayload;
  try {
    resetPayload = verifySessionToken(resetToken);
  } catch {
    return res.status(401).json({ message: 'Password reset verification has expired' });
  }

  if (resetPayload.scope !== 'password-reset') {
    return res.status(401).json({ message: 'Invalid password reset verification' });
  }

  const user = await User.findById(resetPayload.id)
    .select(`${PRIVATE_KEY_SELECTION} ${TWO_FACTOR_SELECTION} +password_reset_version`);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (resetPayload.reset_version !== user.password_reset_version) {
    return res.status(401).json({ message: 'Password reset verification has already been used' });
  }

  // A forgotten password cannot unwrap the old private keys. Rotate the pair and
  // increment the version so old envelopes are never silently treated as readable.
  const keyMaterial = await generateUserKeyMaterial(newPassword);
  user.password = await hashPassword(newPassword);
  Object.assign(user, keyMaterial);
  user.profile_rsa_envelope = buildProfileEnvelope(user, keyMaterial);
  user.key_version = (user.key_version || 1) + 1;
  user.key_rotated_at = new Date();
  user.two_factor_enabled = false;
  user.two_factor_secret_encrypted = undefined;
  user.two_factor_pending_secret_encrypted = undefined;
  user.two_factor_setup_expires_at = undefined;
  user.password_reset_version += 1;
  await user.save();

  let protectedRecords = 0;
  try {
    protectedRecords = await protectExistingRecordsForUser(user);
  } catch (error) {
    console.error('Post-reset record protection error:', error.message);
  }

  res.json({
    success: true,
    message: 'Password updated. Cryptographic keys were rotated; set up two-factor authentication again.',
    protected_records: protectedRecords
  });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!passwordIsStrongEnough(newPassword)) {
    return res.status(400).json({ message: 'New password must be at least 8 characters long' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'New password must be different' });
  }

  try {
    const user = await User.findById(req.user._id).select(PRIVATE_KEY_SELECTION);
    if (!user || !(await verifyStoredPassword(user, currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    let wrappedKeys;
    let generatedNewKeyPair = false;
    if (user.rsa_private_key_wrapped && user.ecc_private_key_wrapped) {
      wrappedKeys = await rewrapUserPrivateKeys(user, currentPassword, newPassword);
    } else {
      wrappedKeys = await generateUserKeyMaterial(newPassword);
      generatedNewKeyPair = true;
    }

    user.password = await hashPassword(newPassword);
    Object.assign(user, wrappedKeys);
    if (generatedNewKeyPair) {
      user.key_version = (user.key_version || 1) + 1;
      user.key_rotated_at = new Date();
      user.profile_rsa_envelope = buildProfileEnvelope(user, user);
    }
    user.private_key_rewrapped_at = new Date();
    await user.save();

    if (generatedNewKeyPair) {
      await protectExistingRecordsForUser(user);
    }

    res.json({
      success: true,
      message: 'Password changed and private keys re-encrypted successfully'
    });
  } catch (error) {
    console.error('Password change error:', error.message);
    res.status(500).json({ message: 'Unable to change password' });
  }
};

export const beginTwoFactorSetup = async (req, res) => {
  const { password } = req.body;

  try {
    const user = await User.findById(req.user._id).select(PRIVATE_KEY_SELECTION);
    if (!user || !(await verifyStoredPassword(user, password))) {
      return res.status(401).json({ message: 'Password is incorrect' });
    }
    if (!user.rsa_public_key || !user.rsa_private_key_wrapped) {
      return res.status(409).json({ message: 'Account key material is missing; change your password to repair it' });
    }

    const secret = generateTotpSecret();
    user.two_factor_pending_secret_encrypted = rsaEncrypt(secret, user.rsa_public_key);
    user.two_factor_setup_expires_at = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    res.json({
      secret,
      otpauth_uri: createTotpUri({ secret, accountName: user.email }),
      expires_in_seconds: 600
    });
  } catch (error) {
    console.error('Two-factor setup error:', error.message);
    res.status(500).json({ message: 'Unable to start two-factor setup' });
  }
};

export const confirmTwoFactorSetup = async (req, res) => {
  const { password, otp } = req.body;

  try {
    const user = await User.findById(req.user._id)
      .select(`${PRIVATE_KEY_SELECTION} ${TWO_FACTOR_SELECTION}`);
    if (!user || !(await verifyStoredPassword(user, password))) {
      return res.status(401).json({ message: 'Password is incorrect' });
    }
    if (!user.two_factor_pending_secret_encrypted ||
        !user.two_factor_setup_expires_at ||
        user.two_factor_setup_expires_at < new Date()) {
      return res.status(400).json({ message: 'Two-factor setup has expired; start again' });
    }

    const rsaPrivateKey = await unwrapPrivateKey(user.rsa_private_key_wrapped, password);
    const secret = rsaDecrypt(user.two_factor_pending_secret_encrypted, rsaPrivateKey);
    if (!verifyTotp(secret, otp)) {
      return res.status(400).json({ message: 'Invalid or expired authenticator code' });
    }

    user.two_factor_secret_encrypted = user.two_factor_pending_secret_encrypted;
    user.two_factor_enabled = true;
    user.two_factor_pending_secret_encrypted = undefined;
    user.two_factor_setup_expires_at = undefined;
    await user.save();

    res.json({ success: true, message: 'Two-factor authentication enabled' });
  } catch (error) {
    console.error('Two-factor confirmation error:', error.message);
    res.status(500).json({ message: 'Unable to confirm two-factor setup' });
  }
};

export const disableTwoFactor = async (req, res) => {
  const { password, otp } = req.body;

  try {
    const user = await User.findById(req.user._id)
      .select(`${PRIVATE_KEY_SELECTION} ${TWO_FACTOR_SELECTION}`);
    if (!user || !(await verifyStoredPassword(user, password))) {
      return res.status(401).json({ message: 'Password is incorrect' });
    }
    if (!user.two_factor_enabled || !user.two_factor_secret_encrypted) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
    }

    const rsaPrivateKey = await unwrapPrivateKey(user.rsa_private_key_wrapped, password);
    const secret = rsaDecrypt(user.two_factor_secret_encrypted, rsaPrivateKey);
    if (!verifyTotp(secret, otp)) {
      return res.status(400).json({ message: 'Invalid or expired authenticator code' });
    }

    user.two_factor_enabled = false;
    user.two_factor_secret_encrypted = undefined;
    await user.save();
    res.json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (error) {
    console.error('Two-factor disable error:', error.message);
    res.status(500).json({ message: 'Unable to disable two-factor authentication' });
  }
};

// @desc    Get all prescriptions for a patient
// @route   GET /api/users/prescriptions
// @access  Private (Patient)
export const getPatientPrescriptions = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patient_id: req.user._id })
      .populate({
        path: 'doctor_id',
        select: 'specialization user_id',
        populate: {
          path: 'user_id',
          select: 'name'
        }
      })
      .populate('appointment_id', 'date time status')
      .populate('medicines.medicine_id', 'drugName manufacturer description consumeType')
      .sort({ date: -1 });

    const transformedPrescriptions = prescriptions.map(p => ({
      _id: p._id,
      doctor: {
        name: p.doctor_id?.user_id?.name || 'Unknown Doctor',
        specialization: p.doctor_id?.specialization
      },
      appointment: {
        date: p.appointment_id?.date,
        time: p.appointment_id?.time,
        status: p.appointment_id?.status
      },
      date: p.date,
      notes: p.notes,
      payment: {
        status: p.payment_status || 'pending',
        amount: p.payment_amount || 500,
        date: p.payment_date,
        method: p.payment_method
      },
      medicines: p.medicines.map(m => ({
        name: m.medicine_id?.drugName || `Medicine (${m.medicine_id?._id || 'N/A'})`,
        dosage: m.dosage || 'Not specified',
        duration: m.duration || 'Not specified',
        timing: m.timing
      })),
      tests: p.tests.map(t => ({
        name: t.test_name,
        description: t.description,
        status: t.status
      }))
    }));

    res.status(200).json({
      success: true,
      count: transformedPrescriptions.length,
      prescriptions: transformedPrescriptions
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
