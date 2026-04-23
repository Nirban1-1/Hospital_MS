import User from '../models/User.js';
import StaffSchedule from '../models/StaffSchedule.js';

// GET /api/admin/users/:role
export const getAllUsersByRole = async (req, res) => {
  try {
    const role = req.params.role;
    const validRoles = ['doctor', 'donor', 'patient', 'ambulance_driver', 'staff'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    const users = await User.find({ role }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/admin/verify/:id
export const verifyUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.is_verified = true;
    await user.save();

    res.json({ message: `${user.role} verified successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/admin/user/:id
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.deleteOne();
    res.json({ message: `${user.role} removed successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/admin/staff-schedule
export const getStaffSchedules = async (req, res) => {
  try {
    const schedules = await StaffSchedule.find()
      .populate('staff_id', 'name staff_category phone email')
      .sort({ date: -1 });

    res.json(schedules);
  } catch (err) {
    console.error('Error fetching schedules:', err);
    res.status(500).json({ message: 'Server error fetching schedules' });
  }
};

// POST /api/admin/staff-schedule
export const  createStaffSchedule = async (req, res) => {
  try {
    const { staff_id, date, shift_type } = req.body;

    if (!staff_id || !date || !shift_type) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const validShifts = ['morning', 'evening', 'night'];
    if (!validShifts.includes(shift_type)) {
      return res.status(400).json({ message: 'Invalid shift type' });
    }

    // Verify staff exists and is staff role
    const staff = await User.findById(staff_id);
    if (!staff || staff.role !== 'staff') {
      return res.status(400).json({ message: 'Invalid staff member' });
    }

    const schedule = await StaffSchedule.create({
      staff_id,
      date: new Date(date),
      shift_type,
    });

    const populated = await schedule.populate('staff_id', 'name staff_category phone email');
    res.status(201).json(populated);
  } catch (err) {
    console.error('Error creating schedule:', err);
    res.status(500).json({ message: 'Server error creating schedule' });
  }
};

// DELETE /api/admin/staff-schedule/:id
export const deleteStaffSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ID format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid schedule ID format' });
    }

    const schedule = await StaffSchedule.findById(id);
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    await StaffSchedule.findByIdAndDelete(id);
    res.json({
      success: true,
      message: 'Shift removed successfully',
    });
  } catch (err) {
    console.error('Error deleting schedule:', err);
    res.status(500).json({ message: 'Server error removing schedule' });
  }
};
