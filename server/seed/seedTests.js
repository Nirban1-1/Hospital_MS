import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Test from '../models/Test.js';

dotenv.config();

const testNames = [
  'Complete Blood Count (CBC)',
  'Blood Glucose (Fasting)',
  'HbA1c',
  'Lipid Profile',
  'Liver Function Test (LFT)',
  'Kidney Function Test (KFT)',
  'Serum Creatinine',
  'Thyroid Function Test (TSH)',
  'Urine Routine Examination',
  'Chest X-Ray',
  'Electrocardiogram (ECG)',
  'Echocardiogram',
  'Ultrasonography (USG)',
  'C-Reactive Protein (CRP)',
  'Serum Electrolytes'
];

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Test.bulkWrite(testNames.map(name => ({
      updateOne: {
        filter: { name },
        update: { $setOnInsert: { name } },
        upsert: true
      }
    })), { ordered: false });

    console.log(`Test catalog ready: ${await Test.countDocuments()} tests`);
  } catch (error) {
    console.error(`Test catalog setup failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
