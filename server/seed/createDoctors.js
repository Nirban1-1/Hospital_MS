// server/seed/createDoctors.js
import mongoose from 'mongoose';
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import { generateUserKeyMaterial } from '../utils/keyManagement.js';
import { encryptMetadataForUser, protectDoctorSchedule } from '../utils/recordProtection.js';
import { hashPassword } from '../utils/password.js';

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//  Load .env from server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const demoDoctorPassword = process.env.DEMO_DOCTOR_PASSWORD;
    if (!demoDoctorPassword || demoDoctorPassword.length < 12) {
      throw new Error('Set DEMO_DOCTOR_PASSWORD to at least 12 characters before seeding doctors.');
    }

    const doctors = [
      {
        name: 'Dr. Karim Ahmed',
        email: 'karim@gmail.com',
        password: '123',
        phone: '01711111111',
        location: 'Dhaka Medical College Hospital',
        specialization: 'Cardiologist'
      },
      {
        name: 'Dr. Fatema Rahman',
        email: 'fatema@gmail.com',
        password: '123',
        phone: '01722222222',
        location: 'Bangabandhu Sheikh Mujib Medical University',
        specialization: 'Pediatrician'
      },
      {
        name: 'Dr. Habibur Islam',
        email: 'habibur@gmail.com',
        password: '123',
        phone: '01733333333',
        location: 'Square Hospital',
        specialization: 'Neurologist'
      },
      {
        name: 'Dr. Nasrin Akter',
        email: 'nasrin@gmail.com',
        password: '123',
        phone: '01744444444',
        location: 'United Hospital',
        specialization: 'Gynecologist'
      },
      {
        name: 'Dr. Rafiqul Hasan',
        email: 'rafiqul@gmail.com',
        password: '123',
        phone: '01755555555',
        location: 'Apollo Hospital',
        specialization: 'Orthopedic Surgeon'
      },
      {
        name: 'Dr. Shahana Begum',
        email: 'shahana@gmail.com',
        password: '123',
        phone: '01766666666',
        location: 'Evercare Hospital',
        specialization: 'Dermatologist'
      },
      {
        name: 'Dr. Mahbub Khan',
        email: 'mahbub@gmail.com',
        password: '123',
        phone: '01777777777',
        location: 'Ibn Sina Hospital',
        specialization: 'Gastroenterologist'
      },
      {
        name: 'Dr. Roksana Parvin',
        email: 'roksana@gmail.com',
        password: '123',
        phone: '01788888888',
        location: 'Labaid Hospital',
        specialization: 'Ophthalmologist'
      },
      {
        name: 'Dr. Zahirul Alam',
        email: 'zahirul@gmail.com',
        password: '123',
        phone: '01799999999',
        location: 'Popular Diagnostic Centre',
        specialization: 'Pulmonologist'
      },
      {
        name: 'Dr. Salma Khatun',
        email: 'salma@gmail.com',
        password: '123',
        phone: '01811111111',
        location: 'National Institute of Cardiovascular Diseases',
        specialization: 'Endocrinologist'
      },
      {
        name: 'Dr. Abdullah Mamun',
        email: 'abdullah@gmail.com',
        password: '123',
        phone: '01822222222',
        location: 'Holy Family Hospital',
        specialization: 'Urologist'
      },
      {
        name: 'Dr. Tahmina Chowdhury',
        email: 'tahmina@gmail.com',
        password: '123',
        phone: '01833333333',
        location: 'Ad-Din Hospital',
        specialization: 'Psychiatrist'
      },
      {
        name: 'Dr. Imran Hossain',
        email: 'imran@gmail.com',
        password: '123',
        phone: '01844444444',
        location: 'Bangladesh Specialized Hospital',
        specialization: 'Oncologist'
      },
      {
        name: 'Dr. Ayesha Siddiqua',
        email: 'ayesha@gmail.com',
        password: '123',
        phone: '01855555555',
        location: 'Green Life Hospital',
        specialization: 'Rheumatologist'
      },
      {
        name: 'Dr. Shahin Alam',
        email: 'shahin@gmail.com',
        password: '123',
        phone: '01866666666',
        location: 'Anwar Khan Modern Hospital',
        specialization: 'Nephrologist'
      },
      {
        name: 'Dr. Sultana Razia',
        email: 'sultana@gmail.com',
        password: '123',
        phone: '01877777777',
        location: 'Central Hospital',
        specialization: 'Hematologist'
      },
      {
        name: 'Dr. Mizanur Rahman',
        email: 'mizanur@gmail.com',
        password: '123',
        phone: '01888888888',
        location: 'Uttara Adhunik Medical College',
        specialization: 'ENT Specialist'
      },
      {
        name: 'Dr. Farzana Ahmed',
        email: 'farzana@gmail.com',
        password: '123',
        phone: '01899999999',
        location: 'BRB Hospital',
        specialization: 'Allergist'
      },
      {
        name: 'Dr. Shamsul Haque',
        email: 'shamsul@gmail.com',
        password: '123',
        phone: '01911111111',
        location: 'Monowara Hospital',
        specialization: 'General Surgeon'
      },
      {
        name: 'Dr. Jesmin Sultana',
        email: 'jesmin@gmail.com',
        password: '123',
        phone: '01922222222',
        location: 'Delta Hospital',
        specialization: 'Radiologist'
      },
      {
        name: 'Dr. Nurul Islam',
        email: 'nurul@gmail.com',
        password: '123',
        phone: '01933333333',
        location: 'Badda General Hospital',
        specialization: 'Anesthesiologist'
      },
      {
        name: 'Dr. Maksuda Begum',
        email: 'maksuda@gmail.com',
        password: '123',
        phone: '01944444444',
        location: 'Comfort Nursing Home',
        specialization: 'Pathologist'
      },
      {
        name: 'Dr. Jahangir Kabir',
        email: 'jahangir@gmail.com',
        password: '123',
        phone: '01955555555',
        location: 'National Heart Foundation',
        specialization: 'Vascular Surgeon'
      },
      {
        name: 'Dr. Rukhsana Parvin',
        email: 'rukhsana@gmail.com',
        password: '123',
        phone: '01966666666',
        location: 'BIRDEM General Hospital',
        specialization: 'Diabetologist'
      },
      {
        name: 'Dr. Masudur Rahman',
        email: 'masudur@gmail.com',
        password: '123',
        phone: '01977777777',
        location: 'Japan Bangladesh Friendship Hospital',
        specialization: 'Plastic Surgeon'
      }
    ];

    for (const doctorData of doctors) {
      let user = await User.findOne({ email: doctorData.email });

      if (user && user.role !== 'doctor') {
        console.log(`Skipping ${doctorData.email}: email belongs to a non-doctor account.`);
        continue;
      }

      if (!user) {
        const keyMaterial = await generateUserKeyMaterial(demoDoctorPassword);
        const profileEnvelope = encryptMetadataForUser({
          record_type: 'user-profile',
          name: doctorData.name,
          email: doctorData.email,
          phone: doctorData.phone,
          location: doctorData.location,
          blood_type: ''
        }, keyMaterial);
        user = await User.create({
          name: doctorData.name,
          email: doctorData.email,
          password: await hashPassword(demoDoctorPassword),
          phone: doctorData.phone,
          location: doctorData.location,
          role: 'doctor',
          is_verified: true,
          profile_rsa_envelope: profileEnvelope,
          ...keyMaterial
        });
      }

      const doctorProfile = await Doctor.findOne({ user_id: user._id });
      if (!doctorProfile) {
        const createdProfile = new Doctor({
          user_id: user._id,
          specialization: doctorData.specialization,
          available_slots: []
        });
        createdProfile.profile_rsa_envelope = encryptMetadataForUser({
          record_type: 'doctor-registration',
          doctor_id: createdProfile._id.toString(),
          user_id: user._id.toString(),
          name: user.name,
          specialization: doctorData.specialization,
          qualification: ''
        }, user);
        protectDoctorSchedule(createdProfile, user);
        await createdProfile.save();
      } else if (!doctorProfile.specialization?.trim()) {
        doctorProfile.specialization = doctorData.specialization;
        doctorProfile.profile_rsa_envelope = encryptMetadataForUser({
          record_type: 'doctor-registration',
          doctor_id: doctorProfile._id.toString(),
          user_id: user._id.toString(),
          name: user.name,
          specialization: doctorData.specialization,
          qualification: doctorProfile.qualification || ''
        }, user);
        protectDoctorSchedule(doctorProfile, user);
        await doctorProfile.save();
      }

      console.log(`Doctor ready: ${doctorData.email} - ${doctorData.specialization}`);
    }

    console.log('✅ Doctor seeding complete');
    process.exit();
  } catch (err) {
    console.error('❌ Error seeding doctors:', err.message);
    process.exit(1);
  }
};

run();
