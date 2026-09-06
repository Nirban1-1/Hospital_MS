import dotenv from 'dotenv';

import connectDB from '../database/connectDB.js';
import User from '../models/User.js';
import BloodDonor from '../models/BloodDonor.js';
import BloodRequest from '../models/BloodRequest.js';
import AmbulanceCall from '../models/AmbulanceCall.js';
import Prescription from '../models/Prescription.js';

dotenv.config();

const resaveCollection = async (Model, name, protectDocument) => {
  const documents = await Model.find({}).select('+phone_hash +blood_type_hash +location_hash');
  let updated = 0;

  for (const document of documents) {
    protectDocument(document);
    await document.save();
    updated += 1;
  }

  console.log(`${name}: protected ${updated} document(s)`);
};

const protectUser = (user) => {
  user.phone = user.phone;
  user.location = user.location;
  user.blood_type = user.blood_type;
};

const protectBloodDonor = (donor) => {
  donor.blood_type = donor.blood_type;
  donor.location = donor.location;
};

const protectBloodRequest = (request) => {
  request.phone = request.phone;
  request.blood_group = request.blood_group;
  request.note = request.note;
};

const protectAmbulanceCall = (call) => {
  call.pickup_location = call.pickup_location;
};

const protectPrescription = (prescription) => {
  prescription.notes = prescription.notes;

  prescription.medicines.forEach((medicine) => {
    medicine.dosage = medicine.dosage;
    medicine.duration = medicine.duration;
  });

  prescription.tests.forEach((test) => {
    test.description = test.description;
    test.test_report = test.test_report;
  });
};

const run = async () => {
  await connectDB();

  await resaveCollection(User, 'Users', protectUser);
  await resaveCollection(BloodDonor, 'Blood donors', protectBloodDonor);
  await resaveCollection(BloodRequest, 'Blood requests', protectBloodRequest);
  await resaveCollection(AmbulanceCall, 'Ambulance calls', protectAmbulanceCall);
  await resaveCollection(Prescription, 'Prescriptions', protectPrescription);

  console.log('Existing sensitive data encryption backfill complete.');
  process.exit(0);
};

run().catch((error) => {
  console.error('Encryption backfill failed:', error);
  process.exit(1);
});
