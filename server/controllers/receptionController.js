import User from '../models/User.js';
import Bed from '../models/Bed.js';
import Reservation from '../models/Reservation.js';

// Helper: get active reservation for a bed (no checkout date)
const getActiveReservationMap = async (beds, type) => {
  const bedIds = beds.map(b => b._id);
  const reservations = await Reservation.find({
    bed_id: { $in: bedIds },
    type,
    status: { $in: ['booked', 'checked_in'] },
    check_out_date: { $exists: false },
  }).populate('patient_id', 'name email phone location');

  const map = {};
  reservations.forEach(r => {
    map[r.bed_id.toString()] = r;
  });
  return map;
};

// GET /api/reception/beds?type=cabin|icu|ot
export const getBedsWithStatus = async (req, res) => {
  try {
    const { type } = req.query;
    if (!['cabin', 'icu', 'ot'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type' });
    }

    const beds = await Bed.find({ type, is_active: true }).sort({ code: 1 });
    const activeMap = await getActiveReservationMap(beds, type);

    const result = beds.map(bed => {
      const r = activeMap[bed._id.toString()];
      return {
        _id: bed._id,
        code: bed.code,
        type: bed.type,
        category: bed.category,
        current_reservation: r
          ? {
              _id: r._id,
              patient_id: r.patient_id?._id,
              patient_name: r.patient_id?.name,
              patient_email: r.patient_id?.email,
              check_in_date: r.check_in_date,
              status: r.status,
            }
          : null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching beds:', err);
    res.status(500).json({ message: 'Server error fetching beds' });
  }
};

// GET /api/reception/patient-lookup?query=...
export const lookupPatient = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    let user = null;
    // Try by ObjectId
    if (query.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(query);
    }

    // If not found, try by email
    if (!user) {
      user = await User.findOne({ email: query });
    }

    if (!user) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    if (user.role !== 'patient') {
      return res.status(400).json({ message: 'Selected user is not a patient' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
    });
  } catch (err) {
    console.error('Patient lookup error:', err);
    res.status(500).json({ message: 'Server error during lookup' });
  }
};

// POST /api/reception/reservations
// body: { bed_id, patient_id, check_in_date, type }
export const createReservation = async (req, res) => {
  try {
    const { bed_id, patient_id, check_in_date, type } = req.body;

    if (!bed_id || !patient_id || !check_in_date || !type) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!['cabin', 'icu', 'ot'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type' });
    }

    const bed = await Bed.findById(bed_id);
    if (!bed || !bed.is_active || bed.type !== type) {
      return res.status(404).json({ message: 'Bed not found for this type' });
    }

    const patient = await User.findById(patient_id);
    if (!patient || patient.role !== 'patient') {
      return res.status(400).json({ message: 'Invalid patient' });
    }

    // Check if bed already has an active reservation
    const existing = await Reservation.findOne({
      bed_id,
      type,
      status: { $in: ['booked', 'checked_in'] },
      check_out_date: { $exists: false },
    });

    if (existing) {
      return res.status(400).json({ message: 'Bed is already occupied' });
    }

    const reservation = await Reservation.create({
      bed_id,
      patient_id,
      type,
      check_in_date: new Date(check_in_date),
      status: 'booked',
    });

    res.status(201).json({
      message: 'Reservation created successfully',
      reservation,
    });
  } catch (err) {
    console.error('Create reservation error:', err);
    res.status(500).json({ message: 'Server error creating reservation' });
  }
};

// POST /api/reception/reservations/:id/checkout
export const checkoutReservation = async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    if (reservation.check_out_date) {
      return res.status(400).json({ message: 'Already checked out' });
    }

    reservation.check_out_date = new Date();
    reservation.status = 'checked_out';
    await reservation.save();

    res.json({ message: 'Checkout successful', reservation });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ message: 'Server error during checkout' });
  }
};
