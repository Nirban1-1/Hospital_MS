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
  },
  { timestamps: true }
);

const StaffSchedule = mongoose.model('StaffSchedule', staffScheduleSchema);
export default StaffSchedule;
