import { eccEncrypt, encryptRsaEnvelope } from './asymmetricEncryption.js';

const id = (value) => value?._id?.toString?.() || value?.toString?.() || null;
const date = (value) => value instanceof Date ? value.toISOString() : value || null;

export const encryptMetadataForUser = (metadata, user) => {
  if (!user?.rsa_public_key || !user?.ecc_public_key) {
    throw new Error('Recipient RSA/ECC public keys are missing');
  }
  return encryptRsaEnvelope(metadata, user.rsa_public_key, user.ecc_public_key);
};

export const encryptClinicalTextForUser = (clinicalText, user) => {
  if (!user?.ecc_public_key) {
    throw new Error('Recipient ECC public key is missing');
  }
  return eccEncrypt(clinicalText, user.ecc_public_key);
};

export const protectDoctorSchedule = (doctor, user) => {
  doctor.schedule_rsa_envelope = encryptMetadataForUser({
    record_type: 'doctor-schedule',
    doctor_id: id(doctor._id),
    user_id: id(user._id),
    available_slots: (doctor.available_slots || []).map((slot) => ({
      date: slot.date,
      time: slot.time,
      booked_count: slot.booked_count || 0
    }))
  }, user);
};

export const protectPrescriptionForPatient = (prescription, patient) => {
  const metadata = {
    record_type: 'prescription',
    record_id: id(prescription._id),
    appointment_id: id(prescription.appointment_id),
    doctor_id: id(prescription.doctor_id),
    patient_id: id(prescription.patient_id),
    date: date(prescription.date),
    created_at: date(prescription.createdAt)
  };
  const clinical = {
    notes: prescription.notes || '',
    medicines: (prescription.medicines || []).map((medicine) => ({
      medicine_id: id(medicine.medicine_id),
      name: medicine.medicine_name || medicine.medicine_id?.drugName || '',
      dosage: medicine.dosage || '',
      duration: medicine.duration || '',
      timing: {
        morning: medicine.timing?.morning || 0,
        noon: medicine.timing?.noon || 0,
        night: medicine.timing?.night || 0
      }
    })),
    tests: (prescription.tests || []).map((test) => ({
      test_id: id(test._id),
      name: test.test_name || '',
      description: test.description || '',
      report: test.test_report || '',
      report_date: date(test.report_date),
      status: test.status || 'suggested'
    }))
  };

  prescription.patient_metadata_rsa_envelope = encryptMetadataForUser(metadata, patient);
  prescription.patient_clinical_ecc_envelope = encryptClinicalTextForUser(clinical, patient);
  prescription.patient_key_version = patient.key_version || 1;
  prescription.crypto_version = 'proposal-v1';
  return { metadata, clinical };
};

export const protectTestBookingForPatient = (report, patient) => {
  const metadata = {
    record_type: 'online-test-booking',
    record_id: id(report._id),
    prescription_id: id(report.prescription),
    patient_id: id(report.patient),
    doctor_id: id(report.doctor),
    tests: (report.tests || []).map((test) => ({
      test_id: id(test.test),
      test_name: test.testName,
      showing_date: date(test.showingDate)
    })),
    created_at: date(report.createdAt)
  };

  report.patient_metadata_rsa_envelope = encryptMetadataForUser(metadata, patient);
  report.patient_key_version = patient.key_version || 1;
  report.crypto_version = 'proposal-v1';
  return metadata;
};
