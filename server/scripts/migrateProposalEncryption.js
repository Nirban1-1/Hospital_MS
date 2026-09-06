import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import BloodDonor from '../models/BloodDonor.js';
import BloodRequest from '../models/BloodRequest.js';
import Doctor from '../models/Doctor.js';
import '../models/Medicine.js';
import Prescription from '../models/Prescription.js';
import Reservation from '../models/Reservation.js';
import StaffSchedule from '../models/StaffSchedule.js';
import TestReport from '../models/TestReport.js';
import User from '../models/User.js';
import {
  encryptClinicalTextForUser,
  encryptMetadataForUser,
  protectDoctorSchedule,
  protectPrescriptionForPatient,
  protectTestBookingForPatient
} from '../utils/recordProtection.js';

dotenv.config();

const shouldApply = process.argv.includes('--apply');
const stats = { protected: 0, alreadyProtected: 0, skippedMissingKeys: 0 };
const userCache = new Map();

const getUser = async (id) => {
  const key = id?.toString();
  if (!key) return null;
  if (!userCache.has(key)) userCache.set(key, await User.findById(id));
  return userCache.get(key);
};

const hasPublicKeys = (user) => Boolean(user?.rsa_public_key && user?.ecc_public_key);

const persist = async (document) => {
  stats.protected += 1;
  if (shouldApply) await document.save();
};

const skipForMissingKeys = () => {
  stats.skippedMissingKeys += 1;
};

const migrateUsers = async () => {
  const users = await User.find().select('+profile_rsa_envelope');
  for (const user of users) {
    userCache.set(user._id.toString(), user);
    if (user.profile_rsa_envelope) {
      stats.alreadyProtected += 1;
    } else if (!hasPublicKeys(user)) {
      skipForMissingKeys();
    } else {
      user.profile_rsa_envelope = encryptMetadataForUser({
        record_type: 'user-profile',
        user_id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        location: user.location || '',
        blood_type: user.blood_type || ''
      }, user);
      await persist(user);
    }
  }
};

const migrateDoctors = async () => {
  const doctors = await Doctor.find().select('+profile_rsa_envelope +schedule_rsa_envelope');
  for (const doctor of doctors) {
    const user = await getUser(doctor.user_id);
    if (!hasPublicKeys(user)) {
      skipForMissingKeys();
      continue;
    }
    let changed = false;
    if (!doctor.profile_rsa_envelope) {
      doctor.profile_rsa_envelope = encryptMetadataForUser({
        record_type: 'doctor-registration',
        doctor_id: doctor._id.toString(),
        user_id: user._id.toString(),
        name: user.name,
        specialization: doctor.specialization || '',
        qualification: doctor.qualification || ''
      }, user);
      changed = true;
    }
    if (!doctor.schedule_rsa_envelope) {
      protectDoctorSchedule(doctor, user);
      changed = true;
    }
    if (changed) await persist(doctor); else stats.alreadyProtected += 1;
  }
};

const migrateAppointments = async () => {
  const records = await Appointment.find().select('+patient_metadata_rsa_envelope');
  for (const record of records) {
    if (record.patient_metadata_rsa_envelope) {
      stats.alreadyProtected += 1;
      continue;
    }
    const patient = await getUser(record.patient_id);
    if (!hasPublicKeys(patient)) {
      skipForMissingKeys();
      continue;
    }
    record.patient_metadata_rsa_envelope = encryptMetadataForUser({
      record_type: 'appointment',
      appointment_id: record._id.toString(),
      doctor_id: record.doctor_id.toString(),
      patient_id: record.patient_id.toString(),
      date: record.date,
      time: record.time,
      status: record.status,
      prescription_id: record.prescription_id?.toString() || null
    }, patient);
    record.patient_key_version = patient.key_version || 1;
    await persist(record);
  }
};

const migratePrescriptions = async () => {
  const records = await Prescription.find()
    .select('+patient_metadata_rsa_envelope +patient_clinical_ecc_envelope')
    .populate('medicines.medicine_id', 'drugName');
  for (const record of records) {
    if (record.patient_metadata_rsa_envelope && record.patient_clinical_ecc_envelope) {
      stats.alreadyProtected += 1;
      continue;
    }
    const patient = await getUser(record.patient_id);
    if (!hasPublicKeys(patient)) {
      skipForMissingKeys();
      continue;
    }
    protectPrescriptionForPatient(record, patient);
    await persist(record);
  }
};

const migrateTestReports = async () => {
  const records = await TestReport.find().select('+patient_metadata_rsa_envelope');
  for (const record of records) {
    if (record.patient_metadata_rsa_envelope) {
      stats.alreadyProtected += 1;
      continue;
    }
    const patient = await getUser(record.patient);
    if (!hasPublicKeys(patient)) {
      skipForMissingKeys();
      continue;
    }
    protectTestBookingForPatient(record, patient);
    await persist(record);
  }
};

const migrateDonors = async () => {
  const records = await BloodDonor.find().select('+donor_rsa_envelope');
  for (const record of records) {
    if (record.donor_rsa_envelope) {
      stats.alreadyProtected += 1;
      continue;
    }
    const user = await getUser(record.user_id);
    if (!hasPublicKeys(user)) {
      skipForMissingKeys();
      continue;
    }
    record.donor_rsa_envelope = encryptMetadataForUser({
      record_type: 'blood-donor-registration',
      donor_id: record._id.toString(),
      user_id: user._id.toString(),
      blood_type: record.blood_type,
      contact: user.phone || '',
      location: record.location || '',
      available: record.available
    }, user);
    record.owner_key_version = user.key_version || 1;
    await persist(record);
  }
};

const migrateBloodRequests = async () => {
  const records = await BloodRequest.find()
    .select('+patient_metadata_rsa_envelope +urgency_ecc_envelope');
  for (const record of records) {
    if (record.patient_metadata_rsa_envelope && record.urgency_ecc_envelope) {
      stats.alreadyProtected += 1;
      continue;
    }
    const patient = await getUser(record.patient_id);
    if (!hasPublicKeys(patient)) {
      skipForMissingKeys();
      continue;
    }
    record.patient_metadata_rsa_envelope = encryptMetadataForUser({
      record_type: 'blood-request',
      request_id: record._id.toString(),
      patient_id: record.patient_id.toString(),
      name: record.name,
      email: record.email,
      phone: record.phone,
      blood_group: record.blood_group,
      age: record.age,
      gender: record.gender,
      status: record.status,
      donor_id: record.donor_id?.toString() || null,
      requested_at: record.requested_at?.toISOString() || null
    }, patient);
    record.urgency_ecc_envelope = encryptClinicalTextForUser({ note: record.note || '' }, patient);
    record.patient_key_version = patient.key_version || 1;
    await persist(record);
  }
};

const migrateStaffSchedules = async () => {
  const records = await StaffSchedule.find().select('+staff_rsa_envelope');
  for (const record of records) {
    if (record.staff_rsa_envelope) {
      stats.alreadyProtected += 1;
      continue;
    }
    const staff = await getUser(record.staff_id);
    if (!hasPublicKeys(staff)) {
      skipForMissingKeys();
      continue;
    }
    record.staff_rsa_envelope = encryptMetadataForUser({
      record_type: 'staff-schedule',
      schedule_id: record._id.toString(),
      staff_id: record.staff_id.toString(),
      date: record.date.toISOString(),
      shift_type: record.shift_type
    }, staff);
    record.staff_key_version = staff.key_version || 1;
    await persist(record);
  }
};

const migrateReservations = async () => {
  const records = await Reservation.find().select('+patient_rsa_envelope');
  for (const record of records) {
    if (record.patient_rsa_envelope) {
      stats.alreadyProtected += 1;
      continue;
    }
    const patient = await getUser(record.patient_id);
    if (!hasPublicKeys(patient)) {
      skipForMissingKeys();
      continue;
    }
    record.patient_rsa_envelope = encryptMetadataForUser({
      record_type: 'cabin-booking',
      reservation_id: record._id.toString(),
      bed_id: record.bed_id.toString(),
      patient_id: record.patient_id.toString(),
      type: record.type,
      check_in_date: record.check_in_date?.toISOString() || null,
      check_out_date: record.check_out_date?.toISOString() || null,
      status: record.status
    }, patient);
    record.patient_key_version = patient.key_version || 1;
    await persist(record);
  }
};

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await migrateUsers();
  await migrateDoctors();
  await migrateAppointments();
  await migratePrescriptions();
  await migrateTestReports();
  await migrateDonors();
  await migrateBloodRequests();
  await migrateStaffSchedules();
  await migrateReservations();
  console.log(JSON.stringify({ mode: shouldApply ? 'apply' : 'dry-run', ...stats }));
} catch (error) {
  console.error(`Proposal encryption migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
