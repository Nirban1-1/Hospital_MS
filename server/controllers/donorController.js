// server/controllers/donorController.js
import User from '../models/User.js';
import BloodDonor from '../models/BloodDonor.js';
import BloodRequest from '../models/BloodRequest.js';

// ✅ Dashboard view
export const getDonorDashboard = async (req, res) => {
  try {
    if (!req.user.is_verified) {
      return res.status(403).json({
        message: 'Access denied. Your donor account is not yet verified by an admin.'
      });
    }

    let donor = await BloodDonor.findOne({ user_id: req.user._id });

    if (!donor) {
      donor = await BloodDonor.create({
        user_id: req.user._id,
        blood_type: req.user.blood_type || 'Unknown',
        location: req.user.location || 'Unknown',
        available: false,
        donation_history: [],
        completed_count: 0
      });
    }

    res.status(200).json({
      message: `Welcome to the Donor Dashboard, ${req.user.name}`,
      available: donor.available,
      donation_history: donor.donation_history || [],
      completed_count: donor.completed_count || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// ✅ Toggle donor availability
export const toggleAvailability = async (req, res) => {
  try {
    const donor = await BloodDonor.findOne({ user_id: req.user._id });
    if (!donor) {
      return res.status(404).json({ message: 'Donor profile not found.' });
    }

    donor.available = !donor.available;
    await donor.save();

    res.status(200).json({
      message: `Availability updated to ${donor.available ? 'Active' : 'Inactive'}`,
      available: donor.available
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// ✅ Match for patient use only (remains unchanged)
export const matchDonors = async (req, res) => {
  try {
    const { blood_type, location } = req.query;

    if (!blood_type || !location) {
      return res.status(400).json({ message: 'Blood type and location are required' });
    }

    const matched = await BloodDonor.find({
      blood_type,
      location,
      available: true
    }).populate('user_id', 'name phone location');

    const formatted = matched.map((donor) => ({
      _id: donor._id,
      name: donor.user_id.name,
      phone: donor.user_id.phone,
      location: donor.user_id.location
    }));

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
