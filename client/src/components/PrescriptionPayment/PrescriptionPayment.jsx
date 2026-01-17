import React, { useState, useEffect } from 'react';
import api from '../../api/api';

const PrescriptionPayment = ({ appointmentId }) => {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('dummy');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPrescriptions();
  }, [appointmentId]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/payment/my-prescriptions', { headers });
      let allPrescriptions = res.data.prescriptions || [];
      
      // Filter by appointmentId if provided
      if (appointmentId) {
        allPrescriptions = allPrescriptions.filter(
          p => p.appointment?._id === appointmentId || p.appointment_id === appointmentId
        );
      }
      
      setPrescriptions(allPrescriptions);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = (prescription) => {
    setSelectedPrescription(prescription);
    setPaymentMethod('dummy');
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedPrescription(null);
    setPaymentMethod('dummy');
  };

  const processPayment = async () => {
    if (!selectedPrescription) return;

    try {
      setProcessing(true);
      const res = await api.post('/api/payment/process', {
        prescription_id: selectedPrescription._id,
        payment_method: paymentMethod
      }, { headers });

      if (res.data.success) {
        alert('Payment successful! You can now access your prescription.');
        closePaymentModal();
        fetchPrescriptions(); // Refresh the list
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert(error.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primaryColor"></div>
      </div>
    );
  }

  if (prescriptions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-xl font-semibold text-headingColor mb-2">No Prescriptions Yet</h3>
        <p className="text-textColor">Your prescriptions will appear here after doctor consultations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prescriptions List */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-headingColor">Your Prescriptions</h3>
            <p className="text-sm text-textColor">View and pay for your prescriptions</p>
          </div>
        </div>

        <div className="space-y-4">
          {prescriptions.map((prescription) => (
            <div 
              key={prescription._id} 
              className="border-2 border-gray-200 rounded-xl p-5 hover:border-primaryColor/50 transition-all"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-bold text-headingColor text-lg">
                      Dr. {prescription.doctor?.name || 'Unknown'}
                    </h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      prescription.payment?.status === 'completed' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {prescription.payment?.status === 'completed' ? 'Paid' : 'Payment Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-textColor">{prescription.doctor?.specialization}</p>
                </div>
              </div>

              {/* Appointment Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-primaryColor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-xs text-textColor">Visit Date</p>
                    <p className="font-semibold text-headingColor">{prescription.appointment?.date || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-primaryColor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs text-textColor">Visit Time</p>
                    <p className="font-semibold text-headingColor">{formatTime(prescription.appointment?.time)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-primaryColor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs text-textColor">Amount</p>
                    <p className="font-semibold text-headingColor">৳{prescription.payment?.amount || 500}</p>
                  </div>
                </div>
              </div>

              {/* Prescription Details (Visible only after payment) */}
              {prescription.payment?.status === 'completed' ? (
                <div className="space-y-3">
                  {prescription.notes && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-semibold text-headingColor mb-1">Doctor's Notes:</p>
                      <p className="text-sm text-textColor">{prescription.notes}</p>
                    </div>
                  )}

                  {prescription.medicines && prescription.medicines.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-headingColor mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Prescribed Medicines
                      </h5>
                      <div className="space-y-2">
                        {prescription.medicines.map((med, idx) => (
                          <div key={idx} className="p-3 bg-white border border-gray-200 rounded-lg">
                            <p className="font-semibold text-headingColor">{med.name}</p>
                            {med.manufacturer && (
                              <p className="text-xs text-textColor">by {med.manufacturer}</p>
                            )}
                            <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                              <p className="text-textColor"><strong>Dosage:</strong> {med.dosage}</p>
                              <p className="text-textColor"><strong>Duration:</strong> {med.duration}</p>
                            </div>
                            {med.timing && (
                              <p className="text-xs text-textColor mt-1">
                                <strong>Timing:</strong> Morning: {med.timing.morning}, Noon: {med.timing.noon}, Night: {med.timing.night}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {prescription.tests && prescription.tests.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-headingColor mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Recommended Tests
                      </h5>
                      <div className="space-y-2">
                        {prescription.tests.map((test, idx) => (
                          <div key={idx} className="p-3 bg-white border border-gray-200 rounded-lg">
                            <p className="font-semibold text-headingColor">{test.name}</p>
                            {test.description && (
                              <p className="text-sm text-textColor">{test.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-sm text-green-700">
                      ✓ Paid on {new Date(prescription.payment.date).toLocaleDateString()} 
                      {prescription.payment.method && ` via ${prescription.payment.method}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                  <svg className="w-12 h-12 text-yellow-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <h4 className="font-bold text-headingColor mb-2">Payment Required</h4>
                  <p className="text-sm text-textColor mb-4">
                    Complete payment to view your prescription details
                  </p>
                  <button
                    onClick={() => openPaymentModal(prescription)}
                    className="px-6 py-3 bg-gradient-to-r from-primaryColor to-irisBlueColor text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
                  >
                    Complete Payment (৳{prescription.payment?.amount || 500})
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-headingColor">Complete Payment</h3>
              <button 
                onClick={closePaymentModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-textColor mb-1">Doctor</p>
                <p className="font-bold text-headingColor text-lg">Dr. {selectedPrescription.doctor?.name}</p>
                <p className="text-sm text-textColor">{selectedPrescription.doctor?.specialization}</p>
              </div>

              <div className="bg-primaryColor/10 rounded-lg p-4 text-center">
                <p className="text-sm text-textColor mb-1">Amount to Pay</p>
                <p className="text-3xl font-bold text-primaryColor">৳{selectedPrescription.payment?.amount || 500}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-headingColor mb-3">
                Select Payment Method
              </label>
              <div className="space-y-2">
                {['dummy', 'cash', 'card', 'mobile_banking'].map((method) => (
                  <label 
                    key={method}
                    className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      paymentMethod === method 
                        ? 'border-primaryColor bg-primaryColor/5' 
                        : 'border-gray-200 hover:border-primaryColor/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-4 h-4 text-primaryColor focus:ring-primaryColor"
                    />
                    <span className="ml-3 font-semibold text-headingColor capitalize">
                      {method === 'dummy' ? '💳 Dummy Payment (Testing)' : 
                       method === 'cash' ? '💵 Cash' :
                       method === 'card' ? '💳 Card' :
                       '📱 Mobile Banking'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {paymentMethod === 'dummy' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Test Mode:</strong> This is a dummy payment for testing purposes. No real transaction will occur.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closePaymentModal}
                disabled={processing}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={processPayment}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-primaryColor to-irisBlueColor text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Pay Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionPayment;