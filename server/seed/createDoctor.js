// server/seed/createDoctors.js
import { hashPassword } from '../utils/password.js';
import { generateUserKeyMaterial } from '../utils/keyManagement.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import { encryptMetadataForUser, protectDoctorSchedule } from '../utils/recordProtection.js';

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//  Load .env from server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const run = async () => {
  try {
    const demoDoctorPassword = process.env.DEMO_DOCTOR_PASSWORD;
    if (!demoDoctorPassword || demoDoctorPassword.length < 12) {
      throw new Error('Set DEMO_DOCTOR_PASSWORD to at least 12 characters');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const doctors = [
      {
  // Cardiology
  'chest pain': 'Cardiologist',
  'heart': 'Cardiologist',
  'blood pressure': 'Cardiologist',
  'palpitation': 'Cardiologist',
  'cardiovascular': 'Cardiologist',
  'heart attack': 'Cardiologist',
  'heart failure': 'Cardiologist',
  'arrhythmia': 'Cardiologist',
  'angina': 'Cardiologist',
  'edema': 'Cardiologist',
  'shortness of breath': 'Cardiologist',
  'swollen ankles': 'Cardiologist',
  'heart murmur': 'Cardiologist',
  'cholesterol': 'Cardiologist',
  'coronary': 'Cardiologist',
  
  // Pediatrics
  'child': 'Pediatrician',
  'baby': 'Pediatrician',
  'infant': 'Pediatrician',
  'vaccination': 'Pediatrician',
  'newborn': 'Pediatrician',
  'toddler': 'Pediatrician',
  'adolescent': 'Pediatrician',
  'growth': 'Pediatrician',
  'development': 'Pediatrician',
  'pediatric fever': 'Pediatrician',
  'childhood illness': 'Pediatrician',
  'immunization': 'Pediatrician',
  'well child check': 'Pediatrician',
  'teething': 'Pediatrician',
  'breastfeeding': 'Pediatrician',
  
  // Neurology
  'headache': 'Neurologist',
  'migraine': 'Neurologist',
  'seizure': 'Neurologist',
  'brain': 'Neurologist',
  'nerve': 'Neurologist',
  'numbness': 'Neurologist',
  'dizziness': 'Neurologist',
  'stroke': 'Neurologist',
  'parkinson': 'Neurologist',
  'alzheimer': 'Neurologist',
  'dementia': 'Neurologist',
  'multiple sclerosis': 'Neurologist',
  'epilepsy': 'Neurologist',
  'tremor': 'Neurologist',
  'tingling': 'Neurologist',
  'paralysis': 'Neurologist',
  'memory loss': 'Neurologist',
  'concussion': 'Neurologist',
  'vertigo': 'Neurologist',
  
  // Gynecology
  'pregnancy': 'Gynecologist',
  'menstrual': 'Gynecologist',
  'gynecological': 'Gynecologist',
  'womens health': 'Gynecologist',
  'menopause': 'Gynecologist',
  'pap smear': 'Gynecologist',
  'ovarian': 'Gynecologist',
  'uterine': 'Gynecologist',
  'vaginal': 'Gynecologist',
  'prenatal': 'Gynecologist',
  'postpartum': 'Gynecologist',
  'fertility': 'Gynecologist',
  'contraception': 'Gynecologist',
  'endometriosis': 'Gynecologist',
  'fibroids': 'Gynecologist',
  'pelvic pain': 'Gynecologist',
  'yeast infection': 'Gynecologist',
  
  // Orthopedics
  'bone': 'Orthopedic Surgeon',
  'joint': 'Orthopedic Surgeon',
  'fracture': 'Orthopedic Surgeon',
  'back pain': 'Orthopedic Surgeon',
  'arthritis': 'Orthopedic Surgeon',
  'knee pain': 'Orthopedic Surgeon',
  'hip pain': 'Orthopedic Surgeon',
  'shoulder pain': 'Orthopedic Surgeon',
  'spine': 'Orthopedic Surgeon',
  'sports injury': 'Orthopedic Surgeon',
  'torn ligament': 'Orthopedic Surgeon',
  'tendonitis': 'Orthopedic Surgeon',
  'carpal tunnel': 'Orthopedic Surgeon',
  'osteoporosis': 'Orthopedic Surgeon',
  'dislocation': 'Orthopedic Surgeon',
  'scoliosis': 'Orthopedic Surgeon',
  'meniscus': 'Orthopedic Surgeon',
  
  // Dermatology
  'skin': 'Dermatologist',
  'rash': 'Dermatologist',
  'acne': 'Dermatologist',
  'eczema': 'Dermatologist',
  'allergy': 'Dermatologist',
  'itching': 'Dermatologist',
  'psoriasis': 'Dermatologist',
  'hives': 'Dermatologist',
  'wart': 'Dermatologist',
  'mole': 'Dermatologist',
  'skin cancer': 'Dermatologist',
  'rosacea': 'Dermatologist',
  'dermatitis': 'Dermatologist',
  'boil': 'Dermatologist',
  'cellulitis': 'Dermatologist',
  'hair loss': 'Dermatologist',
  'nail fungus': 'Dermatologist',
  
  // Gastroenterology
  'stomach': 'Gastroenterologist',
  'gastritis': 'Gastroenterologist',
  'digestion': 'Gastroenterologist',
  'abdominal pain': 'Gastroenterologist',
  'diarrhea': 'Gastroenterologist',
  'constipation': 'Gastroenterologist',
  'nausea': 'Gastroenterologist',
  'vomiting': 'Gastroenterologist',
  'acid reflux': 'Gastroenterologist',
  'heartburn': 'Gastroenterologist',
  'ulcer': 'Gastroenterologist',
  'ibs': 'Gastroenterologist',
  'crohn': 'Gastroenterologist',
  'colitis': 'Gastroenterologist',
  'gallbladder': 'Gastroenterologist',
  'gallstones': 'Gastroenterologist',
  'liver': 'Gastroenterologist',
  'pancreas': 'Gastroenterologist',
  'hemorrhoids': 'Gastroenterologist',
  'endoscopy': 'Gastroenterologist',
  'colonoscopy': 'Gastroenterologist',
  
  // Ophthalmology
  'eye': 'Ophthalmologist',
  'vision': 'Ophthalmologist',
  'sight': 'Ophthalmologist',
  'glaucoma': 'Ophthalmologist',
  'cataract': 'Ophthalmologist',
  'retina': 'Ophthalmologist',
  'conjunctivitis': 'Ophthalmologist',
  'pink eye': 'Ophthalmologist',
  'dry eyes': 'Ophthalmologist',
  'eye infection': 'Ophthalmologist',
  'eye injury': 'Ophthalmologist',
  'myopia': 'Ophthalmologist',
  'astigmatism': 'Ophthalmologist',
  'presbyopia': 'Ophthalmologist',
  'floaters': 'Ophthalmologist',
  'lasik': 'Ophthalmologist',
  
  // Pulmonology
  'breathing': 'Pulmonologist',
  'lung': 'Pulmonologist',
  'asthma': 'Pulmonologist',
  'cough': 'Pulmonologist',
  'respiratory': 'Pulmonologist',
  'copd': 'Pulmonologist',
  'emphysema': 'Pulmonologist',
  'bronchitis': 'Pulmonologist',
  'pneumonia': 'Pulmonologist',
  'tuberculosis': 'Pulmonologist',
  'lung cancer': 'Pulmonologist',
  'sleep apnea': 'Pulmonologist',
  'snoring': 'Pulmonologist',
  'wheezing': 'Pulmonologist',
  'chest tightness': 'Pulmonologist',
  
  // Endocrinology
  'diabetes': 'Endocrinologist',
  'thyroid': 'Endocrinologist',
  'hormone': 'Endocrinologist',
  'metabolism': 'Endocrinologist',
  'obesity': 'Endocrinologist',
  'weight gain': 'Endocrinologist',
  'weight loss': 'Endocrinologist',
  'growth hormone': 'Endocrinologist',
  'pituitary': 'Endocrinologist',
  'adrenal': 'Endocrinologist',
  'cortisol': 'Endocrinologist',
  'insulin': 'Endocrinologist',
  'hypothyroidism': 'Endocrinologist',
  'hyperthyroidism': 'Endocrinologist',
  'goiter': 'Endocrinologist',
  
  // Urology
  'kidney': 'Urologist',
  'urinary': 'Urologist',
  'bladder': 'Urologist',
  'prostate': 'Urologist',
  'erectile dysfunction': 'Urologist',
  'incontinence': 'Urologist',
  'uti': 'Urologist',
  'kidney stones': 'Urologist',
  'renal': 'Urologist',
  'vasectomy': 'Urologist',
  'infertility': 'Urologist',
  'testicular': 'Urologist',
  'penile': 'Urologist',
  'urethra': 'Urologist',
  
  // Psychiatry
  'depression': 'Psychiatrist',
  'anxiety': 'Psychiatrist',
  'mental health': 'Psychiatrist',
  'stress': 'Psychiatrist',
  'bipolar': 'Psychiatrist',
  'schizophrenia': 'Psychiatrist',
  'ocd': 'Psychiatrist',
  'ptsd': 'Psychiatrist',
  'adhd': 'Psychiatrist',
  'autism': 'Psychiatrist',
  'eating disorder': 'Psychiatrist',
  'insomnia': 'Psychiatrist',
  'sleep disorder': 'Psychiatrist',
  'addiction': 'Psychiatrist',
  'substance abuse': 'Psychiatrist',
  'suicidal': 'Psychiatrist',
  'psychotherapy': 'Psychiatrist',
  'counseling': 'Psychiatrist',
  
  // Oncology
  'cancer': 'Oncologist',
  'tumor': 'Oncologist',
  'chemotherapy': 'Oncologist',
  'radiation': 'Oncologist',
  'oncology': 'Oncologist',
  'leukemia': 'Oncologist',
  'lymphoma': 'Oncologist',
  'melanoma': 'Oncologist',
  'metastasis': 'Oncologist',
  'biopsy': 'Oncologist',
  'carcinogen': 'Oncologist',
  'remission': 'Oncologist',
  'palliative care': 'Oncologist',
  
  // Rheumatology
  'rheumatoid arthritis': 'Rheumatologist',
  'lupus': 'Rheumatologist',
  'gout': 'Rheumatologist',
  'fibromyalgia': 'Rheumatologist',
  'sjogren': 'Rheumatologist',
  'scleroderma': 'Rheumatologist',
  'vasculitis': 'Rheumatologist',
  'myositis': 'Rheumatologist',
  'autoimmune': 'Rheumatologist',
  'inflammatory arthritis': 'Rheumatologist',
  'joint inflammation': 'Rheumatologist',
  'connective tissue disease': 'Rheumatologist',
  
  // Nephrology
  'kidney disease': 'Nephrologist',
  'kidney failure': 'Nephrologist',
  'dialysis': 'Nephrologist',
  'renal failure': 'Nephrologist',
  'glomerulonephritis': 'Nephrologist',
  'nephrotic syndrome': 'Nephrologist',
  'kidney transplant': 'Nephrologist',
  'proteinuria': 'Nephrologist',
  'hematuria': 'Nephrologist',
  'electrolyte imbalance': 'Nephrologist',
  'creatinine': 'Nephrologist',
  
  // Hematology
  'anemia': 'Hematologist',
  'bleeding disorder': 'Hematologist',
  'clotting disorder': 'Hematologist',
  'hemophilia': 'Hematologist',
  'thrombocytopenia': 'Hematologist',
  'blood disorder': 'Hematologist',
  'sickle cell': 'Hematologist',
  'thalassemia': 'Hematologist',
  'bone marrow': 'Hematologist',
  'transfusion': 'Hematologist',
  'coagulation': 'Hematologist',
  'white blood cell': 'Hematologist',
  'platelet': 'Hematologist',
  
  // ENT
  'ear': 'ENT Specialist',
  'nose': 'ENT Specialist',
  'throat': 'ENT Specialist',
  'hearing': 'ENT Specialist',
  'sinus': 'ENT Specialist',
  'tonsillitis': 'ENT Specialist',
  'pharyngitis': 'ENT Specialist',
  'laryngitis': 'ENT Specialist',
  'voice disorder': 'ENT Specialist',
  'hoarseness': 'ENT Specialist',
  'swallowing': 'ENT Specialist',
  'dysphagia': 'ENT Specialist',
  'tinnitus': 'ENT Specialist',
  'ear infection': 'ENT Specialist',
  'sinusitis': 'ENT Specialist',
  'rhinitis': 'ENT Specialist',
  'nasal polyp': 'ENT Specialist',
  'deviated septum': 'ENT Specialist',
  
  // Allergy
  'allergies': 'Allergist',
  'hay fever': 'Allergist',
  'allergic rhinitis': 'Allergist',
  'food allergy': 'Allergist',
  'drug allergy': 'Allergist',
  'insect allergy': 'Allergist',
  'anaphylaxis': 'Allergist',
  'immunology': 'Allergist',
  'immune system': 'Allergist',
  'allergy testing': 'Allergist',
  'allergy shots': 'Allergist',
  
  // General Surgery
  'surgery': 'General Surgeon',
  'appendicitis': 'General Surgeon',
  'hernia': 'General Surgeon',
  'appendectomy': 'General Surgeon',
  'cholecystectomy': 'General Surgeon',
  'laparoscopic': 'General Surgeon',
  'gallbladder surgery': 'General Surgeon',
  'intestinal surgery': 'General Surgeon',
  'trauma surgery': 'General Surgeon',
  'surgical consultation': 'General Surgeon',
  'preoperative': 'General Surgeon',
  'postoperative': 'General Surgeon',
  
  // Radiology
  'x-ray': 'Radiologist',
  'ct scan': 'Radiologist',
  'mri': 'Radiologist',
  'ultrasound': 'Radiologist',
  'mammogram': 'Radiologist',
  'pet scan': 'Radiologist',
  'imaging': 'Radiologist',
  'diagnostic imaging': 'Radiologist',
  'interventional radiology': 'Radiologist',
  'angiogram': 'Radiologist',
  'fluoroscopy': 'Radiologist',
  'radiology report': 'Radiologist',
  
  // Anesthesiology
  'anesthesia': 'Anesthesiologist',
  'pain management': 'Anesthesiologist',
  'sedation': 'Anesthesiologist',
  'general anesthesia': 'Anesthesiologist',
  'local anesthesia': 'Anesthesiologist',
  'epidural': 'Anesthesiologist',
  'spinal anesthesia': 'Anesthesiologist',
  'pain relief': 'Anesthesiologist',
  'postoperative pain': 'Anesthesiologist',
  'chronic pain': 'Anesthesiologist',
  'nerve block': 'Anesthesiologist',
  
  // Pathology
  'biopsy report': 'Pathologist',
  'laboratory': 'Pathologist',
  'blood test': 'Pathologist',
  'urine test': 'Pathologist',
  'tissue diagnosis': 'Pathologist',
  'autopsy': 'Pathologist',
  'cytology': 'Pathologist',
  'histology': 'Pathologist',
  'microbiology': 'Pathologist',
  'infection diagnosis': 'Pathologist',
  'cancer diagnosis': 'Pathologist',
  'pathology report': 'Pathologist',
  
  // Vascular Surgery
  'varicose veins': 'Vascular Surgeon',
  'deep vein thrombosis': 'Vascular Surgeon',
  'dvt': 'Vascular Surgeon',
  'peripheral artery disease': 'Vascular Surgeon',
  'pad': 'Vascular Surgeon',
  'claudication': 'Vascular Surgeon',
  'aneurysm': 'Vascular Surgeon',
  'aortic aneurysm': 'Vascular Surgeon',
  'carotid artery': 'Vascular Surgeon',
  'bypass surgery': 'Vascular Surgeon',
  'angioplasty': 'Vascular Surgeon',
  'stent': 'Vascular Surgeon',
  'dialysis access': 'Vascular Surgeon',
  'leg pain': 'Vascular Surgeon',
  'leg swelling': 'Vascular Surgeon',
  
  // Diabetology
  'diabetes management': 'Diabetologist',
  'type 1 diabetes': 'Diabetologist',
  'type 2 diabetes': 'Diabetologist',
  'gestational diabetes': 'Diabetologist',
  'blood sugar': 'Diabetologist',
  'hypoglycemia': 'Diabetologist',
  'hyperglycemia': 'Diabetologist',
  'diabetic foot': 'Diabetologist',
  'diabetic retinopathy': 'Diabetologist',
  'diabetic nephropathy': 'Diabetologist',
  'diabetic neuropathy': 'Diabetologist',
  'glucose monitoring': 'Diabetologist',
  'insulin pump': 'Diabetologist',
  'continuous glucose monitor': 'Diabetologist',
  
  // Plastic Surgery
  'cosmetic surgery': 'Plastic Surgeon',
  'reconstructive surgery': 'Plastic Surgeon',
  'burn': 'Plastic Surgeon',
  'scar': 'Plastic Surgeon',
  'rhinoplasty': 'Plastic Surgeon',
  'breast augmentation': 'Plastic Surgeon',
  'liposuction': 'Plastic Surgeon',
  'facelift': 'Plastic Surgeon',
  'botox': 'Plastic Surgeon',
  'filler': 'Plastic Surgeon',
  'laser surgery': 'Plastic Surgeon',
  'skin graft': 'Plastic Surgeon',
  'cleft lip': 'Plastic Surgeon',
  'cleft palate': 'Plastic Surgeon',
  'hand surgery': 'Plastic Surgeon',
  'microsurgery': 'Plastic Surgeon',
      }
    ];

    for (const doctorData of doctors) {
      const existing = await User.findOne({ email: doctorData.email });

      if (existing) {
        console.log(`⚠️  Doctor already exists: ${doctorData.email}`);
        continue;
      }

      // Create User account
      const hashedPassword = await hashPassword(demoDoctorPassword);
      const keyMaterial = await generateUserKeyMaterial(demoDoctorPassword);
      const profileEnvelope = encryptMetadataForUser({
        record_type: 'user-profile',
        name: doctorData.name,
        email: doctorData.email,
        phone: doctorData.phone,
        location: doctorData.location,
        blood_type: ''
      }, keyMaterial);
      const user = await User.create({
        name: doctorData.name,
        email: doctorData.email,
        password: hashedPassword,
        ...keyMaterial,
        profile_rsa_envelope: profileEnvelope,
        phone: doctorData.phone,
        location: doctorData.location,
        role: 'doctor',
        is_verified: true
      });

      // Create Doctor profile
      const doctor = new Doctor({
        user_id: user._id,
        specialization: doctorData.specialization,
        available_slots: []
      });
      doctor.profile_rsa_envelope = encryptMetadataForUser({
        record_type: 'doctor-registration',
        doctor_id: doctor._id.toString(),
        user_id: user._id.toString(),
        name: user.name,
        specialization: doctorData.specialization,
        qualification: ''
      }, user);
      protectDoctorSchedule(doctor, user);
      await doctor.save();

      console.log(`✅ Doctor created: ${doctorData.email} - ${doctorData.specialization}`);
    }

    console.log('✅ Doctor seeding complete');
    process.exit();
  } catch (err) {
    console.error('❌ Error seeding doctors:', err.message);
    process.exit(1);
  }
};

run();
