import Appointment from '../models/Appointment.js';
import BloodDonor from '../models/BloodDonor.js';
import BloodRequest from '../models/BloodRequest.js';
import Doctor from '../models/Doctor.js';
import '../models/Medicine.js';
import Prescription from '../models/Prescription.js';
import RecordAccessRequest from '../models/RecordAccessRequest.js';
import Reservation from '../models/Reservation.js';
import StaffSchedule from '../models/StaffSchedule.js';
import TestReport from '../models/TestReport.js';
import {
  encryptClinicalTextForUser,
  encryptMetadataForUser,
  protectDoctorSchedule,
  protectPrescriptionForPatient,
  protectTestBookingForPatient
} from './recordProtection.js';

const iso = (value) => value?.toISOString?.() || null;

const protectPatientRecords = async (user) => {
  let count = 0;
  const appointments = await Appointment.find({ patient_id: user._id });
  for (const record of appointments) {
    record.patient_metadata_rsa_envelope = encryptMetadataForUser({
      record_type: 'appointment',
      appointment_id: record._id.toString(),
      doctor_id: record.doctor_id.toString(),
      patient_id: user._id.toString(),
      date: record.date,
      time: record.time,
      status: record.status,
      prescription_id: record.prescription_id?.toString() || null
    }, user);
    record.patient_key_version = user.key_version;
    await record.save();
    count += 1;
  }

  const prescriptions = await Prescription.find({ patient_id: user._id })
    .select('+patient_metadata_rsa_envelope +patient_clinical_ecc_envelope')
    .populate('medicines.medicine_id', 'drugName');
  for (const record of prescriptions) {
    protectPrescriptionForPatient(record, user);
    await record.save();
    count += 1;
  }

  const reports = await TestReport.find({ patient: user._id }).select('+patient_metadata_rsa_envelope');
  for (const record of reports) {
    protectTestBookingForPatient(record, user);
    await record.save();
    count += 1;
  }

  const bloodRequests = await BloodRequest.find({ patient_id: user._id })
    .select('+patient_metadata_rsa_envelope +urgency_ecc_envelope');
  for (const record of bloodRequests) {
    record.patient_metadata_rsa_envelope = encryptMetadataForUser({
      record_type: 'blood-request',
      request_id: record._id.toString(),
      patient_id: user._id.toString(),
      name: record.name,
      email: record.email,
      phone: record.phone,
      blood_group: record.blood_group,
      age: record.age,
      gender: record.gender,
      status: record.status,
      donor_id: record.donor_id?.toString() || null,
      requested_at: iso(record.requested_at),
      accepted_at: iso(record.accepted_at),
      completed_at: iso(record.completed_at)
    }, user);
    record.urgency_ecc_envelope = encryptClinicalTextForUser({ note: record.note || '' }, user);
    record.patient_key_version = user.key_version;
    await record.save();
    count += 1;
  }

  const reservations = await Reservation.find({ patient_id: user._id }).select('+patient_rsa_envelope');
  for (const record of reservations) {
    record.patient_rsa_envelope = encryptMetadataForUser({
      record_type: 'cabin-booking',
      reservation_id: record._id.toString(),
      bed_id: record.bed_id.toString(),
      patient_id: user._id.toString(),
      type: record.type,
      check_in_date: iso(record.check_in_date),
      check_out_date: iso(record.check_out_date),
      status: record.status
    }, user);
    record.patient_key_version = user.key_version;
    await record.save();
    count += 1;
  }

  await RecordAccessRequest.updateMany(
    { patient_id: user._id, status: 'pending' },
    { $set: { status: 'rejected', rejected_at: new Date() } }
  );
  return count;
};

const protectRoleRecords = async (user) => {
  let count = 0;
  if (user.role === 'doctor') {
    const doctor = await Doctor.findOne({ user_id: user._id })
      .select('+profile_rsa_envelope +schedule_rsa_envelope');
    if (doctor) {
      doctor.profile_rsa_envelope = encryptMetadataForUser({
        record_type: 'doctor-registration',
        doctor_id: doctor._id.toString(),
        user_id: user._id.toString(),
        name: user.name,
        specialization: doctor.specialization || '',
        qualification: doctor.qualification || ''
      }, user);
      protectDoctorSchedule(doctor, user);
      await doctor.save();
      count += 1;
    }
    await RecordAccessRequest.updateMany(
      { doctor_id: user._id, status: 'approved' },
      { $set: { status: 'revoked' } }
    );
  }

  if (user.role === 'staff') {
    const schedules = await StaffSchedule.find({ staff_id: user._id }).select('+staff_rsa_envelope');
    for (const record of schedules) {
      record.staff_rsa_envelope = encryptMetadataForUser({
        record_type: 'staff-schedule',
        schedule_id: record._id.toString(),
        staff_id: user._id.toString(),
        date: iso(record.date),
        shift_type: record.shift_type
      }, user);
      record.staff_key_version = user.key_version;
      await record.save();
      count += 1;
    }
  }

  if (user.role === 'donor') {
    const donor = await BloodDonor.findOne({ user_id: user._id }).select('+donor_rsa_envelope');
    if (donor) {
      donor.donor_rsa_envelope = encryptMetadataForUser({
        record_type: 'blood-donor-registration',
        donor_id: donor._id.toString(),
        user_id: user._id.toString(),
        blood_type: donor.blood_type,
        contact: user.phone || '',
        location: donor.location || '',
        available: donor.available
      }, user);
      donor.owner_key_version = user.key_version;
      await donor.save();
      count += 1;
    }
  }
  return count;
};

export const protectExistingRecordsForUser = async (user) => {
  let protectedCount = 0;
  if (user.role === 'patient') protectedCount += await protectPatientRecords(user);
  protectedCount += await protectRoleRecords(user);
  return protectedCount;
};
