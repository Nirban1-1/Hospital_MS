import mongoose from 'mongoose';

const staffScheduleSchema = new mongoose.Schema(
  {
    staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    shift_type: {
      type: String,
      enum: ['morning', 'evening', 'night'],
      required: true,
    },
    staff_rsa_envelope: { type: String, select: false },
    staff_key_version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

const StaffSchedule = mongoose.model('StaffSchedule', staffScheduleSchema);
export default StaffSchedule;
