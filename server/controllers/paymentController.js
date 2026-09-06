import Prescription from '../models/Prescription.js';
import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import User from '../models/User.js';

// @desc    Process payment for a prescription
// @route   POST /api/payment/process
// @access  Private (Patient)
export const processPrescriptionPayment = async (req, res) => {
  try {
    const { prescription_id, payment_method, transaction_id } = req.body;

    // Validate payment method
    const validMethods = ['cash', 'card', 'mobile_banking', 'dummy'];
    if (!payment_method || !validMethods.includes(payment_method)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid payment method. Please select: cash, card, mobile_banking, or dummy' 
      });
    }

    // Find the prescription
    const prescription = await Prescription.findById(prescription_id);
    if (!prescription) {
      return res.status(404).json({ 
        success: false,
        message: 'Prescription not found' 
      });
    }

    // Verify the prescription belongs to the current user
    if (prescription.patient_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized access to this prescription' 
      });
    }

    // Check if already paid
    if (prescription.payment_status === 'completed') {
      return res.status(400).json({ 
        success: false,
        message: 'This prescription has already been paid for' 
      });
    }

    // For dummy payment, simulate instant success
    if (payment_method === 'dummy') {
      prescription.payment_status = 'completed';
      prescription.payment_date = new Date();
      prescription.payment_method = payment_method;
      await prescription.save();

      return res.status(200).json({
        success: true,
        message: 'Payment processed successfully (DUMMY MODE)',
        prescription: {
          _id: prescription._id,
          payment_status: prescription.payment_status,
          payment_amount: prescription.payment_amount,
          payment_date: prescription.payment_date,
          payment_method: prescription.payment_method
        }
      });
    }

    // For real payments (cash, card, mobile_banking)
    // In production, you would integrate with actual payment gateways here
    // For now, we'll simulate successful payment
    prescription.payment_status = 'completed';
    prescription.payment_date = new Date();
    prescription.payment_method = payment_method;
    
    if (transaction_id) {
      prescription.transaction_id = transaction_id;
    }

    await prescription.save();

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      prescription: {
        _id: prescription._id,
        payment_status: prescription.payment_status,
        payment_amount: prescription.payment_amount,
        payment_date: prescription.payment_date,
        payment_method: prescription.payment_method
      }
    });
  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error processing payment: ' + error.message 
    });
  }
};

// @desc    Get payment status for a prescription
// @route   GET /api/payment/status/:prescription_id
// @access  Private (Patient)
export const getPrescriptionPaymentStatus = async (req, res) => {
  try {
    const { prescription_id } = req.params;

    const prescription = await Prescription.findById(prescription_id)
      .select('payment_status payment_amount payment_date payment_method');

    if (!prescription) {
      return res.status(404).json({ 
        success: false,
        message: 'Prescription not found' 
      });
    }

    // Verify the prescription belongs to the current user
    if (prescription.patient_id && prescription.patient_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized access to this prescription' 
      });
    }

    res.status(200).json({
      success: true,
      payment: {
        status: prescription.payment_status,
        amount: prescription.payment_amount,
        date: prescription.payment_date,
        method: prescription.payment_method
      }
    });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};

// @desc    Get all prescriptions with payment info for a patient
// @route   GET /api/payment/my-prescriptions
// @access  Private (Patient)
export const getPatientPrescriptionsWithPayment = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patient_id: req.user._id })
      .populate({
        path: 'doctor_id',
        select: 'specialization user_id',
        populate: {
          path: 'user_id',
          select: 'name'
        }
      })
      .populate('appointment_id', 'date time status')
      .populate('medicines.medicine_id', 'drugName manufacturer description consumeType price')
      .sort({ date: -1 });

    const transformedPrescriptions = prescriptions.map(p => ({
      _id: p._id,
      doctor: {
        name: p.doctor_id?.user_id?.name || 'Unknown Doctor',
        specialization: p.doctor_id?.specialization
      },
      appointment: {
        _id: p.appointment_id?._id,
        date: p.appointment_id?.date,
        time: p.appointment_id?.time,
        status: p.appointment_id?.status
      },
      appointment_id: p.appointment_id?._id, // For easier filtering
      date: p.date,
      notes: p.notes,
      payment: {
        status: p.payment_status,
        amount: p.payment_amount,
        date: p.payment_date,
        method: p.payment_method
      },
      medicines: p.medicines.map(m => ({
        name: m.medicine_id?.drugName || 'Medicine',
        manufacturer: m.medicine_id?.manufacturer,
        dosage: m.dosage || 'Not specified',
        duration: m.duration || 'Not specified',
        timing: m.timing,
        price: m.medicine_id?.price
      })),
      tests: p.tests.map(t => ({
        _id: t._id,
        name: t.test_name,
        description: t.description,
        status: t.status,
        test_report: t.test_report,
        report_date: t.report_date
      }))
    }));

    res.status(200).json({
      success: true,
      count: transformedPrescriptions.length,
      prescriptions: transformedPrescriptions
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + error.message 
    });
  }
};
