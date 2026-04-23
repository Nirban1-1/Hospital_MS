import mongoose from 'mongoose';

const bedSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true, // e.g. CAB-101, ICU-05, OT-02
    },
    type: {
      type: String,
      enum: ['cabin', 'icu', 'ot'],
      required: true,
    },
    // optional: category, floor, notes, etc.
    category: {
      type: String,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Bed = mongoose.model('Bed', bedSchema);
export default Bed;
