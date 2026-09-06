import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import { data as medicineData } from './medicine.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from server directory
dotenv.config({ path: join(__dirname, '../.env') });

const seedMedicines = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for medicine seeding');

    const validMedicines = medicineData.filter(medicine => (
      typeof medicine.drugName === 'string' && medicine.drugName.trim() &&
      typeof medicine.description === 'string' && medicine.description.trim() &&
      typeof medicine.category === 'string' && medicine.category.trim() &&
      Number.isFinite(Number(medicine.price))
    ));

    const uniqueMedicines = [...new Map(validMedicines.map(medicine => [
      [medicine.drugName, medicine.manufacturer, medicine.description, medicine.consumeType]
        .join('|')
        .toLowerCase(),
      medicine
    ])).values()];

    console.log(`Upserting ${uniqueMedicines.length} medicines from medicine.js...`);

    const batchSize = 500;
    let processed = 0;

    for (let index = 0; index < uniqueMedicines.length; index += batchSize) {
      const batch = uniqueMedicines.slice(index, index + batchSize);
      await Medicine.bulkWrite(batch.map(medicine => ({
        updateOne: {
          filter: {
            drugName: medicine.drugName,
            manufacturer: medicine.manufacturer,
            description: medicine.description,
            consumeType: medicine.consumeType
          },
          update: { $set: medicine },
          upsert: true
        }
      })), { ordered: false });

      processed += batch.length;
      console.log(`Progress: ${processed}/${uniqueMedicines.length}`);
    }

    console.log(`Medicine seed complete: ${await Medicine.countDocuments()} records in database`);
  } catch (error) {
    console.error('Error seeding medicines:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedMedicines();
