// server/controllers/ambulanceController.js
import AmbulanceCall from '../models/AmbulanceCall.js';

export const requestAmbulance = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pickup_location } = req.body;

    if (!pickup_location || typeof pickup_location !== 'string') {
      return res.status(400).json({ message: 'Pickup location is required as a string' });
    }

    const newCall = new AmbulanceCall({
      patient_id: userId,
      pickup_location,
      status: 'requested'
    });

    await newCall.save();
    res.status(201).json({ message: 'Ambulance requested successfully.' });
  } catch (error) {
    console.error('Ambulance request error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// NEW: Get ambulance requests made by the logged-in patient
export const getMyAmbulanceRequests = async (req, res) => {
  try {
    const patientId = req.user._id;

    const requests = await AmbulanceCall.find({ patient_id: patientId })
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error('Fetch ambulance requests error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
