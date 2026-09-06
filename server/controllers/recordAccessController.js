import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import Prescription from '../models/Prescription.js';
import RecordAccessRequest from '../models/RecordAccessRequest.js';
import User from '../models/User.js';
import {
  decryptRsaEnvelope,
  eccDecrypt,
  eccEncrypt,
  encryptRsaEnvelope,
  signApproval,
  verifyApproval
} from '../utils/asymmetricEncryption.js';
import { unwrapUserPrivateKeys } from '../utils/keyManagement.js';
import { verifyPassword } from '../utils/password.js';

const PRIVATE_KEYS = '+rsa_private_key_wrapped +ecc_private_key_wrapped';
const REQUEST_SECRETS = [
  '+request_metadata_rsa_envelope',
  '+request_reason_ecc_envelope',
  '+doctor_metadata_rsa_envelope',
  '+doctor_clinical_ecc_envelope',
  '+patient_signature',
  '+patient_signing_public_key'
].join(' ');

const parseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('Decrypted record payload is malformed');
  }
};

const approvalStatement = (request, approvedAt) => JSON.stringify({
  action: 'approve-old-medical-record-access',
  request_id: request._id.toString(),
  prescription_id: request.prescription_id.toString(),
  patient_id: request.patient_id.toString(),
  doctor_id: request.doctor_id.toString(),
  approved_at: approvedAt.toISOString(),
  patient_key_version: request.patient_key_version
});

const requireCurrentPassword = async (user, password) => {
  if (!user || !password || !(await verifyPassword(password, user.password))) {
    const error = new Error('Password is incorrect');
    error.status = 401;
    throw error;
  }
};

export const requestOldRecordAccess = async (req, res) => {
  try {
    const { prescription_id, reason } = req.body;
    const normalizedReason = String(reason || '').trim();
    if (!prescription_id || normalizedReason.length < 3 || normalizedReason.length > 500) {
      return res.status(400).json({ message: 'Prescription and a 3-500 character reason are required' });
    }

    const [doctor, prescription] = await Promise.all([
      Doctor.findOne({ user_id: req.user._id }),
      Prescription.findById(prescription_id)
    ]);
    if (!doctor || !prescription) {
      return res.status(404).json({ message: 'Doctor profile or prescription not found' });
    }

    const assigned = await Appointment.exists({
      doctor_id: doctor._id,
      patient_id: prescription.patient_id,
      status: { $in: ['booked', 'completed', 'treated'] }
    });
    if (!assigned) {
      return res.status(403).json({ message: 'You are not assigned to this patient' });
    }

    const patient = await User.findById(prescription.patient_id);
    if (!patient?.rsa_public_key || !patient?.ecc_public_key) {
      return res.status(409).json({ message: 'Patient encryption keys are missing' });
    }

    const request = new RecordAccessRequest({
      prescription_id: prescription._id,
      patient_id: prescription.patient_id,
      doctor_id: req.user._id,
      patient_key_version: patient.key_version || 1,
      request_metadata_rsa_envelope: 'pending',
      request_reason_ecc_envelope: 'pending'
    });
    request.request_metadata_rsa_envelope = encryptRsaEnvelope({
      record_type: 'old-record-access-request',
      request_id: request._id.toString(),
      prescription_id: prescription._id.toString(),
      patient_id: prescription.patient_id.toString(),
      doctor_id: req.user._id.toString(),
      requested_at: request.requested_at.toISOString()
    }, patient.rsa_public_key, patient.ecc_public_key);
    request.request_reason_ecc_envelope = eccEncrypt(normalizedReason, patient.ecc_public_key);
    await request.save();

    res.status(201).json({
      success: true,
      request: {
        id: request._id,
        prescription_id: request.prescription_id,
        patient_id: request.patient_id,
        status: request.status,
        requested_at: request.requested_at
      }
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'A pending request already exists for this record' });
    }
    console.error('Old-record request error:', error.message);
    res.status(500).json({ message: 'Unable to request old-record access' });
  }
};

export const getPatientAccessRequests = async (req, res) => {
  try {
    const requests = await RecordAccessRequest.find({ patient_id: req.user._id })
      .populate('doctor_id', 'name email')
      .sort({ requested_at: -1 });
    res.json(requests.map((request) => ({
      id: request._id,
      prescription_id: request.prescription_id,
      doctor: request.doctor_id,
      status: request.status,
      requested_at: request.requested_at,
      approved_at: request.approved_at,
      rejected_at: request.rejected_at
    })));
  } catch (error) {
    res.status(500).json({ message: 'Unable to load access requests' });
  }
};

export const getDoctorAccessRequests = async (req, res) => {
  try {
    const requests = await RecordAccessRequest.find({ doctor_id: req.user._id })
      .populate('patient_id', 'name email')
      .sort({ requested_at: -1 });
    res.json(requests.map((request) => ({
      id: request._id,
      prescription_id: request.prescription_id,
      patient: request.patient_id,
      status: request.status,
      requested_at: request.requested_at,
      approved_at: request.approved_at,
      rejected_at: request.rejected_at
    })));
  } catch (error) {
    res.status(500).json({ message: 'Unable to load access requests' });
  }
};

export const decryptPatientAccessRequest = async (req, res) => {
  try {
    const [request, patient] = await Promise.all([
      RecordAccessRequest.findById(req.params.id).select(REQUEST_SECRETS),
      User.findById(req.user._id).select(PRIVATE_KEYS)
    ]);
    if (!request || request.patient_id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Access request not found' });
    }
    if (!patient) {
      return res.status(404).json({ message: 'Patient account not found' });
    }

    await requireCurrentPassword(patient, req.body.password);
    const { rsaPrivateKey, eccPrivateKey } = await unwrapUserPrivateKeys(patient, req.body.password);
    const metadata = parseJson(decryptRsaEnvelope(
      request.request_metadata_rsa_envelope,
      rsaPrivateKey,
      eccPrivateKey
    ));
    const reason = eccDecrypt(request.request_reason_ecc_envelope, eccPrivateKey);
    res.json({ metadata, reason, status: request.status });
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message || 'Unable to decrypt request' });
  }
};

export const approveOldRecordAccess = async (req, res) => {
  try {
    const request = await RecordAccessRequest.findById(req.params.id).select(REQUEST_SECRETS);
    if (!request || request.patient_id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Access request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({ message: `Request is already ${request.status}` });
    }

    const [patient, doctor, prescription] = await Promise.all([
      User.findById(req.user._id).select(PRIVATE_KEYS),
      User.findById(request.doctor_id),
      Prescription.findById(request.prescription_id)
        .select('+patient_metadata_rsa_envelope +patient_clinical_ecc_envelope')
    ]);
    if (!patient || !doctor || !prescription) {
      return res.status(404).json({ message: 'Patient, doctor, or prescription no longer exists' });
    }
    if (request.patient_key_version !== (patient.key_version || 1) ||
        prescription.patient_key_version !== (patient.key_version || 1)) {
      return res.status(409).json({ message: 'This record uses an older key version and needs recovery migration' });
    }
    if (!prescription.patient_metadata_rsa_envelope || !prescription.patient_clinical_ecc_envelope) {
      return res.status(409).json({ message: 'Legacy record has not been migrated to patient envelopes' });
    }

    await requireCurrentPassword(patient, req.body.password);
    const { rsaPrivateKey, eccPrivateKey } = await unwrapUserPrivateKeys(patient, req.body.password);
    const metadataPlaintext = decryptRsaEnvelope(
      prescription.patient_metadata_rsa_envelope,
      rsaPrivateKey,
      eccPrivateKey
    );
    const clinicalPlaintext = eccDecrypt(
      prescription.patient_clinical_ecc_envelope,
      eccPrivateKey
    );

    const approvedAt = new Date();
    const statement = approvalStatement(request, approvedAt);
    request.doctor_metadata_rsa_envelope = encryptRsaEnvelope(
      metadataPlaintext,
      doctor.rsa_public_key,
      doctor.ecc_public_key
    );
    request.doctor_clinical_ecc_envelope = eccEncrypt(clinicalPlaintext, doctor.ecc_public_key);
    request.patient_signature = signApproval(statement, eccPrivateKey);
    request.patient_signing_public_key = patient.ecc_public_key;
    request.doctor_key_version = doctor.key_version || 1;
    request.status = 'approved';
    request.approved_at = approvedAt;
    await request.save();

    res.json({ success: true, message: 'Record access approved and signed' });
  } catch (error) {
    console.error('Old-record approval error:', error.message);
    res.status(error.status || 400).json({ message: error.message || 'Unable to approve access' });
  }
};

export const rejectOldRecordAccess = async (req, res) => {
  try {
    const request = await RecordAccessRequest.findById(req.params.id);
    if (!request || request.patient_id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Access request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({ message: `Request is already ${request.status}` });
    }

    request.status = 'rejected';
    request.rejected_at = new Date();
    await request.save();
    res.json({ success: true, message: 'Record access rejected' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to reject access request' });
  }
};

export const decryptApprovedRecord = async (req, res) => {
  try {
    const [request, doctor] = await Promise.all([
      RecordAccessRequest.findById(req.params.id).select(REQUEST_SECRETS),
      User.findById(req.user._id).select(PRIVATE_KEYS)
    ]);
    if (!request || request.doctor_id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Access request not found' });
    }
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor account not found' });
    }
    if (request.status !== 'approved') {
      return res.status(403).json({ message: 'The patient has not approved this request' });
    }
    if (request.doctor_key_version !== (doctor.key_version || 1)) {
      return res.status(409).json({ message: 'Approved copy uses an older doctor key version' });
    }
    if (!request.doctor_metadata_rsa_envelope ||
        !request.doctor_clinical_ecc_envelope ||
        !request.patient_signature) {
      return res.status(409).json({ message: 'Approved cryptographic copy is incomplete' });
    }

    await requireCurrentPassword(doctor, req.body.password);
    const [{ rsaPrivateKey, eccPrivateKey }, patient] = await Promise.all([
      unwrapUserPrivateKeys(doctor, req.body.password),
      User.findById(request.patient_id)
    ]);
    const statement = approvalStatement(request, request.approved_at);
    const signingPublicKey = request.patient_signing_public_key || patient?.ecc_public_key;
    if (!signingPublicKey || !verifyApproval(statement, request.patient_signature, signingPublicKey)) {
      return res.status(409).json({ message: 'Patient approval signature is invalid' });
    }

    const metadata = parseJson(decryptRsaEnvelope(
      request.doctor_metadata_rsa_envelope,
      rsaPrivateKey,
      eccPrivateKey
    ));
    const clinical = parseJson(eccDecrypt(request.doctor_clinical_ecc_envelope, eccPrivateKey));
    res.json({
      metadata,
      clinical,
      approval: {
        signed_by_patient: true,
        approved_at: request.approved_at,
        patient_key_version: request.patient_key_version
      }
    });
  } catch (error) {
    console.error('Approved-record decrypt error:', error.message);
    res.status(error.status || 400).json({ message: error.message || 'Unable to decrypt approved record' });
  }
};

export const decryptOwnPrescription = async (req, res) => {
  try {
    const [prescription, patient] = await Promise.all([
      Prescription.findById(req.params.id)
        .select('+patient_metadata_rsa_envelope +patient_clinical_ecc_envelope'),
      User.findById(req.user._id).select(PRIVATE_KEYS)
    ]);
    if (!prescription || prescription.patient_id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Prescription not found' });
    }
    if (!patient) {
      return res.status(404).json({ message: 'Patient account not found' });
    }
    if (prescription.patient_key_version !== (patient.key_version || 1)) {
      return res.status(409).json({ message: 'Record uses an older patient key version' });
    }
    if (!prescription.patient_metadata_rsa_envelope || !prescription.patient_clinical_ecc_envelope) {
      return res.status(409).json({ message: 'Legacy record has not been migrated to patient envelopes' });
    }

    await requireCurrentPassword(patient, req.body.password);
    const { rsaPrivateKey, eccPrivateKey } = await unwrapUserPrivateKeys(patient, req.body.password);
    res.json({
      metadata: parseJson(decryptRsaEnvelope(
        prescription.patient_metadata_rsa_envelope,
        rsaPrivateKey,
        eccPrivateKey
      )),
      clinical: parseJson(eccDecrypt(prescription.patient_clinical_ecc_envelope, eccPrivateKey))
    });
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message || 'Unable to decrypt prescription' });
  }
};
