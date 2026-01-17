import React, { useState } from 'react';
import api from '../api/api';
import { useNavigate } from 'react-router-dom';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    name: '',
    newPassword: ''
  });

  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await api.post('/api/users/verify-user', {
        email: formData.email,
        phone: formData.phone,
        name: formData.name
      });

      if (res.data.success) {
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await api.post('/api/users/reset-password', {
        email: formData.email,
        newPassword: formData.newPassword
      });

      if (res.data.success) {
        setSuccess('Password reset successful. Please login.');
        setTimeout(() => navigate('/'), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purpleColor/10 via-white to-primaryColor/10 py-12 px-4">
      <div className="container">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purpleColor to-primaryColor rounded-full mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-headingColor mb-2">
                {step === 1 ? 'Forgot Password?' : 'Set New Password'}
              </h2>
              <p className="text-textColor">
                {step === 1 ? 'Verify your identity to reset' : 'Create a strong new password'}
              </p>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step === 1 ? 'bg-primaryColor text-white' : 'bg-green-500 text-white'
                }`}>
                  {step === 1 ? '1' : '✓'}
                </div>
                <div className={`w-20 h-1 ${
                  step === 2 ? 'bg-primaryColor' : 'bg-gray-200'
                }`}></div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step === 2 ? 'bg-primaryColor text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  2
                </div>
              </div>
            </div>

            <form onSubmit={step === 1 ? handleVerify : handleReset} className="space-y-4">
              {step === 1 ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-headingColor mb-2">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      placeholder="Enter your registered email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purpleColor focus:ring-2 focus:ring-purpleColor/20 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-headingColor mb-2">Phone Number</label>
                    <input
                      type="text"
                      name="phone"
                      placeholder="Enter your phone number"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purpleColor focus:ring-2 focus:ring-purpleColor/20 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-headingColor mb-2">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purpleColor focus:ring-2 focus:ring-purpleColor/20 outline-none transition-all"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-headingColor mb-2">New Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    placeholder="Enter your new password"
                    value={formData.newPassword}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purpleColor focus:ring-2 focus:ring-purpleColor/20 outline-none transition-all"
                  />
                  <p className="text-xs text-textColor mt-2">Use at least 8 characters with a mix of letters and numbers</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
                  <p className="text-green-700 text-sm font-medium">{success}</p>
                </div>
              )}

              {/* Submit Button */}
              <button 
                type="submit" 
                className="w-full bg-gradient-to-r from-purpleColor to-primaryColor text-white font-semibold py-3.5 rounded-xl hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
              >
                {step === 1 ? 'Verify Identity' : 'Reset Password'}
              </button>

              {/* Back to Login */}
              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-sm text-textColor hover:text-primaryColor transition-colors"
                >
                  ← Back to Login
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ForgotPassword;
