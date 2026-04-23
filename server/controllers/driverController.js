// server/controllers/driverController.js
import User from '../models/User.js';
import AmbulanceCall from '../models/AmbulanceCall.js';
import AmbulanceDriver from '../models/AmbulanceDriver.js';

export const getDriverDashboard = async (req, res) => {
  try {
    if (!req.user.is_verified) {
      return res.status(403).json({
        message: 'Access denied. Your ambulance driver account is not yet verified by an admin.'
      });
    }

    // Find or create driver profile
    let driverProfile = await AmbulanceDriver.findOne({ user_id: req.user._id });
    if (!driverProfile) {
      driverProfile = await AmbulanceDriver.create({ user_id: req.user._id });
    }

    // Get all available requests (unassigned)
    const pendingRequests = await AmbulanceCall.find({ status: 'requested' })
      .populate('patient_id', 'name location');

    // Get accepted or completed requests assigned to this driver
    const assignedRequests = await AmbulanceCall.find({
      driver_id: req.user._id,
      status: { $in: ['accepted', 'completed'] }
    }).populate('patient_id', 'name location');

    res.status(200).json({
      message: `Welcome, ${req.user.name}`,
      completed_requests: driverProfile.completed_requests,
      pending_requests: pendingRequests,
      assigned_requests: assignedRequests
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

export const acceptRequest = async (req, res) => {
  try {
    const call = await AmbulanceCall.findById(req.params.id);
    if (!call) return res.status(404).json({ message: 'Request not found' });
    if (call.status !== 'requested') {
      return res.status(400).json({ message: 'This request has already been accepted' });
    }

    call.status = 'accepted';
    call.driver_id = req.user._id;
    await call.save();

    res.status(200).json({ message: 'Request accepted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

export const completeRequest = async (req, res) => {
  try {
    const call = await AmbulanceCall.findById(req.params.id);
    if (!call) return res.status(404).json({ message: 'Request not found' });
    if (call.driver_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not assigned to this request' });
    }

    call.status = 'completed';
    await call.save();

    const driver = await AmbulanceDriver.findOne({ user_id: req.user._id });
    if (driver) {
      driver.completed_requests += 1;
      await driver.save();
    }

    res.status(200).json({ message: 'Request marked as completed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
