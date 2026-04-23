// server/controllers/chatbotController.js
import Doctor from '../models/Doctor.js';
import User from '../models/User.js';

// Specialization mapping based on symptoms/conditions
const symptomToSpecialization = {
  // Cardiology
  'chest pain': 'Cardiologist',
  'heart': 'Cardiologist',
  'blood pressure': 'Cardiologist',
  'palpitation': 'Cardiologist',
  'cardiovascular': 'Cardiologist',
  
  // Gastroenterology
  'stomach': 'Gastroenterologist',
  'gastritis': 'Gastroenterologist',
  'digestion': 'Gastroenterologist',
  'abdominal pain': 'Gastroenterologist',
  'diarrhea': 'Gastroenterologist',
  'constipation': 'Gastroenterologist',
  'nausea': 'Gastroenterologist',
  'vomiting': 'Gastroenterologist',
  
  // Neurology
  'headache': 'Neurologist',
  'migraine': 'Neurologist',
  'seizure': 'Neurologist',
  'brain': 'Neurologist',
  'nerve': 'Neurologist',
  'numbness': 'Neurologist',
  'dizziness': 'Neurologist',
  
  // Orthopedics
  'bone': 'Orthopedic Surgeon',
  'joint': 'Orthopedic Surgeon',
  'fracture': 'Orthopedic Surgeon',
  'back pain': 'Orthopedic Surgeon',
  'arthritis': 'Orthopedic Surgeon',
  'knee pain': 'Orthopedic Surgeon',
  
  // Dermatology
  'skin': 'Dermatologist',
  'rash': 'Dermatologist',
  'acne': 'Dermatologist',
  'eczema': 'Dermatologist',
  'allergy': 'Dermatologist',
  'itching': 'Dermatologist',
  
  // Pediatrics
  'child': 'Pediatrician',
  'baby': 'Pediatrician',
  'infant': 'Pediatrician',
  'vaccination': 'Pediatrician',
  
  // Gynecology
  'pregnancy': 'Gynecologist',
  'menstrual': 'Gynecologist',
  'gynecological': 'Gynecologist',
  'womens health': 'Gynecologist',
  
  // ENT
  'ear': 'ENT Specialist',
  'nose': 'ENT Specialist',
  'throat': 'ENT Specialist',
  'hearing': 'ENT Specialist',
  'sinus': 'ENT Specialist',
  
  // Ophthalmology
  'eye': 'Ophthalmologist',
  'vision': 'Ophthalmologist',
  'sight': 'Ophthalmologist',
  
  // Pulmonology
  'breathing': 'Pulmonologist',
  'lung': 'Pulmonologist',
  'asthma': 'Pulmonologist',
  'cough': 'Pulmonologist',
  'respiratory': 'Pulmonologist',
  
  // Urology
  'kidney': 'Urologist',
  'urinary': 'Urologist',
  'bladder': 'Urologist',
  
  // Endocrinology
  'diabetes': 'Endocrinologist',
  'thyroid': 'Endocrinologist',
  'hormone': 'Endocrinologist',
  
  // Psychiatry
  'depression': 'Psychiatrist',
  'anxiety': 'Psychiatrist',
  'mental health': 'Psychiatrist',
  'stress': 'Psychiatrist',
  
  // Oncology
  'cancer': 'Oncologist',
  'tumor': 'Oncologist',
};

// Analyze symptoms and determine specialization
const analyzeSymptoms = (message) => {
  const lowerMessage = message.toLowerCase();
  
  for (const [symptom, specialization] of Object.entries(symptomToSpecialization)) {
    if (lowerMessage.includes(symptom)) {
      return specialization;
    }
  }
  
  return null; // No specific specialization found
};

// Get available doctors by specialization
const getAvailableDoctors = async (specialization) => {
  try {
    const doctors = await Doctor.find({ specialization })
      .populate('user_id', 'name email phone location')
      .limit(3);
    
    return doctors;
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return [];
  }
};

// Generate chatbot response
const generateResponse = async (message, patientName, conversationHistory) => {
  const lowerMessage = message.toLowerCase();
  
  // Welcome message
  if (conversationHistory.length <= 1) {
    return {
      message: `Hello ${patientName}! 👋 I'm your healthcare assistant. I'm here to help you find the right specialist for your health concerns.\n\nPlease tell me about your symptoms or health issues, and I'll recommend the most suitable doctor from our hospital. How can I assist you today?`,
      doctors: [],
      specialization: null
    };
  }
  
  // Thank you / goodbye
  if (lowerMessage.includes('thank') || lowerMessage.includes('bye')) {
    return {
      message: `You're welcome, ${patientName}! Take care of your health. If you need any further assistance, feel free to reach out anytime. Wishing you good health! 🌟`,
      doctors: [],
      specialization: null
    };
  }
  
  // Analyze symptoms
  const specialization = analyzeSymptoms(message);
  
  if (specialization) {
    const doctors = await getAvailableDoctors(specialization);
    
    if (doctors.length > 0) {
      let responseMessage = `Based on your symptoms, I recommend consulting with a ${specialization}. `;
      
      // Home remedy suggestions based on specialization
      const homeRemedies = getHomeRemedies(specialization);
      if (homeRemedies) {
        responseMessage += `\n\n🏠 **First Aid/Home Comfort:**\n${homeRemedies}\n`;
      }
      
      responseMessage += `\n\n👨‍⚕️ **Available ${specialization}s in our hospital:**\n\n`;
      
      doctors.forEach((doctor, index) => {
        responseMessage += `${index + 1}. **Dr. ${doctor.user_id.name}**\n`;
        responseMessage += `   📍 Location: ${doctor.user_id.location}\n`;
        responseMessage += `   📞 Phone: ${doctor.user_id.phone}\n`;
        responseMessage += `   ✉️ Email: ${doctor.user_id.email}\n\n`;
      });
      
      responseMessage += `I strongly recommend booking an appointment with one of these specialists for proper diagnosis and treatment. Would you like me to help you with anything else?`;
      
      return {
        message: responseMessage,
        doctors: doctors,
        specialization: specialization
      };
    } else {
      return {
        message: `I understand you're experiencing symptoms related to ${specialization} care. Unfortunately, we don't have a ${specialization} available at the moment. I recommend:\n\n1. Visiting our emergency department if symptoms are severe\n2. Calling our main reception at the hospital for alternative arrangements\n3. Seeking immediate medical attention if you feel it's urgent\n\nIs there anything else I can help you with?`,
        doctors: [],
        specialization: specialization
      };
    }
  } else {
    // Could not determine specialization
    return {
      message: `Thank you for sharing that with me, ${patientName}. To help you better, could you please provide more specific details about your symptoms? For example:\n\n• What part of your body is affected?\n• What kind of discomfort are you experiencing?\n• How long have you had these symptoms?\n• Any other relevant details?\n\nThis will help me recommend the most appropriate specialist for you. 🏥`,
      doctors: [],
      specialization: null
    };
  }
};

// Home remedies/first aid suggestions
const getHomeRemedies = (specialization) => {
  const remedies = {
    'Gastroenterologist': '• Stay hydrated with water and clear fluids\n• Eat bland foods (rice, bananas, toast)\n• Avoid spicy and fatty foods\n• Take small, frequent meals\n\n⚠️ However, please consult a doctor for proper treatment.',
    
    'Cardiologist': '• Rest and avoid strenuous activities\n• Practice deep breathing exercises\n• Avoid caffeine and smoking\n• Monitor your blood pressure if possible\n\n⚠️ If experiencing severe chest pain, seek emergency care immediately!',
    
    'Neurologist': '• Rest in a quiet, dark room\n• Apply cold compress to forehead\n• Stay hydrated\n• Avoid bright screens\n\n⚠️ Seek immediate medical attention for severe or sudden headaches.',
    
    'Dermatologist': '• Keep the affected area clean and dry\n• Avoid scratching\n• Use gentle, fragrance-free moisturizers\n• Avoid known allergens\n\n⚠️ Consult a dermatologist for proper diagnosis and treatment.',
    
    'Pulmonologist': '• Stay in a well-ventilated area\n• Use steam inhalation for relief\n• Stay hydrated\n• Rest adequately\n\n⚠️ If breathing difficulty is severe, seek immediate medical help!',
    
    'Orthopedic Surgeon': '• Rest and avoid putting weight on the affected area\n• Apply ice for swelling (first 48 hours)\n• Keep the area elevated\n• Avoid sudden movements\n\n⚠️ Consult a specialist for proper evaluation and treatment.',
  };
  
  return remedies[specialization] || null;
};

// Main chatbot endpoint
export const chatWithBot = async (req, res) => {
  try {
    console.log('Chatbot request received:', { message: req.body.message, userId: req.user?.id });
    
    const { message, conversationHistory = [] } = req.body;
    const userId = req.user?.id || req.user?._id;
    
    if (!message || message.trim() === '') {
      console.log('Empty message received');
      return res.status(400).json({ message: 'Message is required' });
    }
    
    if (!userId) {
      console.log('No user ID found in request');
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    // Get patient details
    const patient = await User.findById(userId);
    console.log('Patient found:', patient ? patient.name : 'Not found');
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    // Generate response
    console.log('Generating response for message:', message);
    const response = await generateResponse(message, patient.name, conversationHistory);
    console.log('Response generated:', { hasMessage: !!response.message, doctorsCount: response.doctors?.length });
    
    res.status(200).json({
      success: true,
      response: response.message,
      doctors: response.doctors,
      specialization: response.specialization,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('Chatbot error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      success: false,
      message: 'I apologize, but I encountered an error. Please try again or contact our support team.',
      error: error.message 
    });
  }
};

// Get all specializations
export const getSpecializations = async (req, res) => {
  try {
    const specializations = await Doctor.distinct('specialization');
    res.status(200).json({
      success: true,
      specializations
    });
  } catch (error) {
    console.error('Error fetching specializations:', error);
    res.status(500).json({ message: 'Error fetching specializations', error: error.message });
  }
};
