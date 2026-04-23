import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema(
  {
    bed_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bed',
      required: true,
    },
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['cabin', 'icu', 'ot'],
      required: true,
    },
    check_in_date: {
      type: Date,
      required: true,
    },
    check_out_date: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['booked', 'checked_in', 'checked_out', 'cancelled'],
      default: 'booked',
    },
  },
  { timestamps: true }
);

const Reservation = mongoose.model('Reservation', reservationSchema);
export default Reservation;
