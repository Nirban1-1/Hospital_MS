// server/controllers/bloodRequestController.js

import BloodRequest from '../models/BloodRequest.js';
import User from '../models/User.js';
import BloodDonor from '../models/BloodDonor.js';

// @desc Create a blood request
// @route POST /api/blood/request
export const createBloodRequest = async (req, res) => {
  try {
    const { blood_group, age, gender, note } = req.body;
    const patient_id = req.user._id;

    // Validate required request fields (location removed)
    if (!blood_group || age === undefined || age === null || !gender) {
      return res
        .status(400)
        .json({ message: 'Blood group, age and gender are required.' });
    }

    // Fetch required fields from profile
    const patient = await User.findById(patient_id).select('name email phone');
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found.' });
    }

    if (!patient.name || !patient.email || !patient.phone) {
      return res.status(400).json({
        message: 'Profile must have name, email, and phone to send blood request.',
      });
    }

    const request = await BloodRequest.create({
      patient_id,
      name: patient.name,
      email: patient.email,
      phone: patient.phone,
      blood_group,
      age,
      gender,
      note: note || '',
    });

    res.status(201).json({ message: 'Blood request created.', request });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};


export const getPendingRequests = async (req, res) => {
  try {
    const donor = await BloodDonor.findOne({ user_id: req.user._id });
    if (!donor || !donor.available) {
      return res
        .status(403)
        .json({ message: 'You must be available to view requests.' });
    }

    const allRelevantRequests = await BloodRequest.find({
      $or: [{ status: 'requested' }, { status: 'accepted', donor_id: req.user._id }],
    }).populate('patient_id', 'name phone email'); // removed location

    const enrichedRequests = allRelevantRequests.map((request) => ({
      ...request.toObject(),
      current_user_id: req.user._id,
    }));

    console.log('Returning requests to donor:', enrichedRequests);
    res.status(200).json(enrichedRequests);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};


export const acceptBloodRequest = async (req, res) => {
  try {
    const donor_id = req.user._id;
    const requestId = req.params.id;

    const donorProfile = await BloodDonor.findOne({ user_id: donor_id });
    if (!donorProfile || !donorProfile.available) {
      return res
        .status(403)
        .json({ message: 'You must be available to accept requests.' });
    }

    const request = await BloodRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Blood request not found.' });
    }

    if (request.status !== 'requested') {
      return res
        .status(400)
        .json({ message: 'This request has already been accepted.' });
    }

    request.status = 'accepted';
    request.donor_id = donor_id;
    request.accepted_at = new Date();
    await request.save();

    const today = new Date().toISOString().split('T')[0];
    donorProfile.donation_history.push(today);
    await donorProfile.save();

    res.status(200).json({ message: 'Request accepted.', request });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};


export const getMyRequests = async (req, res) => {
  try {
    const patient_id = req.user._id;

    const requests = await BloodRequest.find({ patient_id })
      .sort({ createdAt: -1 })
      .populate('donor_id', 'name phone');

    const formatted = requests.map((r) => ({
      id: r._id,

      blood_group: r.blood_group,
      age: r.age,
      gender: r.gender,
      note: r.note,

      // snapshot of patient details
      name: r.name,
      email: r.email,
      phone: r.phone,

      status: r.status,
      requested_at: r.requested_at,
      accepted_at: r.accepted_at,

      donor: r.donor_id
        ? { name: r.donor_id.name, phone: r.donor_id.phone }
        : null,
    }));

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// @desc Mark a blood request as completed (donor only)
// @route PATCH /api/blood/complete/:id
export const completeDonation = async (req, res) => {
  try {
    const donor_id = req.user._id;

    const request = await BloodRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Blood request not found.' });
    }

    if (request.donor_id.toString() !== donor_id.toString()) {
      return res
        .status(403)
        .json({ message: 'You are not assigned to this request.' });
    }

    request.status = 'completed';
    request.completed_at = new Date();
    await request.save();

    res.status(200).json({ message: 'Donation marked as completed.', request });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// @desc Donor donation history (completed donations)
// @route GET /api/blood/history
export const getDonationHistory = async (req, res) => {
  try {
    const donor = await BloodDonor.findOne({ user_id: req.user._id });
    if (!donor) {
      return res.status(404).json({ message: "Donor profile not found." });
    }

    const history = await BloodRequest.find({
      donor_id: req.user._id,
      status: "completed",
    })
      .sort({ completed_at: -1 })
      .populate("patient_id", "name phone email");

    const formatted = history.map((r) => ({
      id: r._id,
      status: r.status,
      requested_at: r.requested_at,
      accepted_at: r.accepted_at,
      completed_at: r.completed_at,

      // patient snapshot fields stored in request (your controller saves these) [file:249]
      name: r.name || r.patient_id?.name,
      email: r.email || r.patient_id?.email,
      phone: r.phone || r.patient_id?.phone,

      // request info fields (based on your updated controller) [file:249]
      blood_group: r.blood_group,
      age: r.age,
      gender: r.gender,
      note: r.note,
    }));

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Server error: " + error.message });
  }
};

