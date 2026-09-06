import React, { useEffect, useState } from 'react';
import api from '../api/api';
import RecordAccessPanel from '../components/RecordAccessPanel/RecordAccessPanel';

const Account = () => {
  const [user, setUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: '',
    password: ''
  });
  const [securityForm, setSecurityForm] = useState({
    twoFactorPassword: '',
    otp: '',
    currentPassword: '',
    newPassword: ''
  });
  const [twoFactorSetup, setTwoFactorSetup] = useState(null);
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityError, setSecurityError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const res = await api.get('/api/users/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(res.data);
        setFormData({
          name: res.data.name || '',
          phone: res.data.phone || '',
          location: res.data.location || '',
          password: ''
        });
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    try {
      const res = await api.put('/api/users/profile', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
      setEditMode(false);
    } catch (err) {
      console.error('Error updating profile:', err.response?.data?.message || err.message);
      alert('Update failed: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const authConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const updateSecurityField = (e) => {
    setSecurityForm((previous) => ({ ...previous, [e.target.name]: e.target.value }));
  };

  const beginTwoFactor = async () => {
    setSecurityError('');
    setSecurityMessage('');
    try {
      const response = await api.post('/api/users/2fa/setup', {
        password: securityForm.twoFactorPassword
      }, authConfig());
      setTwoFactorSetup(response.data);
      setSecurityMessage('Add this secret to your authenticator, then enter its current code.');
    } catch (error) {
      setSecurityError(error.response?.data?.message || 'Unable to start two-factor setup');
    }
  };

  const confirmTwoFactor = async () => {
    setSecurityError('');
    try {
      const response = await api.post('/api/users/2fa/confirm', {
        password: securityForm.twoFactorPassword,
        otp: securityForm.otp
      }, authConfig());
      setUser((previous) => ({ ...previous, two_factor_enabled: true }));
      setTwoFactorSetup(null);
      setSecurityForm((previous) => ({ ...previous, otp: '', twoFactorPassword: '' }));
      setSecurityMessage(response.data.message);
    } catch (error) {
      setSecurityError(error.response?.data?.message || 'Unable to enable two-factor authentication');
    }
  };

  const disableTwoFactor = async () => {
    setSecurityError('');
    try {
      const response = await api.post('/api/users/2fa/disable', {
        password: securityForm.twoFactorPassword,
        otp: securityForm.otp
      }, authConfig());
      setUser((previous) => ({ ...previous, two_factor_enabled: false }));
      setSecurityForm((previous) => ({ ...previous, otp: '', twoFactorPassword: '' }));
      setSecurityMessage(response.data.message);
    } catch (error) {
      setSecurityError(error.response?.data?.message || 'Unable to disable two-factor authentication');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setSecurityError('');
    try {
      const response = await api.put('/api/users/change-password', {
        currentPassword: securityForm.currentPassword,
        newPassword: securityForm.newPassword
      }, authConfig());
      setSecurityForm((previous) => ({ ...previous, currentPassword: '', newPassword: '' }));
      setSecurityMessage(response.data.message);
    } catch (error) {
      setSecurityError(error.response?.data?.message || 'Unable to change password');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purpleColor/10 py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-headingColor mb-2">My Profile</h2>
          <p className="text-textColor">Manage your account information</p>
        </div>

        {user ? (
          editMode ? (
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h3 className="text-2xl font-bold text-headingColor mb-6">Edit Profile</h3>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-headingColor mb-2">Full Name</label>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primaryColor focus:ring-2 focus:ring-primaryColor/20 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-headingColor mb-2">Phone Number</label>
                    <input 
                      type="text" 
                      name="phone" 
                      value={formData.phone} 
                      onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primaryColor focus:ring-2 focus:ring-primaryColor/20 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-headingColor mb-2">Location</label>
                  <input 
                    type="text" 
                    name="location" 
                    value={formData.location} 
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primaryColor focus:ring-2 focus:ring-primaryColor/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-headingColor mb-2">Confirm Password</label>
                  <input 
                    type="password" 
                    name="password" 
                    value={formData.password} 
                    onChange={handleChange} 
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primaryColor focus:ring-2 focus:ring-primaryColor/20 outline-none transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="submit" 
                    className="flex-1 bg-gradient-to-r from-primaryColor to-irisBlueColor text-white font-semibold py-3 rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300"
                  >
                    Save Changes
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setEditMode(false)}
                    className="flex-1 bg-gray-100 text-headingColor font-semibold py-3 rounded-xl hover:bg-gray-200 transition-all duration-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Card */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-primaryColor to-purpleColor rounded-full mb-4 shadow-lg">
                      <span className="text-4xl font-bold text-white">{user.name?.charAt(0).toUpperCase()}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-headingColor mb-1">{user.name}</h3>
                    <p className="text-textColor capitalize mb-4">{user.role}</p>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${user.is_verified ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {user.is_verified ? (
                        <>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="font-semibold">Verified</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <span className="font-semibold">Pending</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Information Card */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-headingColor">Account Information</h3>
                    <button 
                      onClick={() => setEditMode(true)}
                      className="px-6 py-2.5 bg-gradient-to-r from-primaryColor to-irisBlueColor text-white font-semibold rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300"
                    >
                      Edit Profile
                    </button>
                  </div>
                  <div className="space-y-5">
                    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 flex items-center justify-center bg-primaryColor/10 rounded-lg">
                        <svg className="w-6 h-6 text-primaryColor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-textColor font-medium">Email Address</p>
                        <p className="text-lg text-headingColor font-semibold">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 flex items-center justify-center bg-irisBlueColor/10 rounded-lg">
                        <svg className="w-6 h-6 text-irisBlueColor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-textColor font-medium">Phone Number</p>
                        <p className="text-lg text-headingColor font-semibold">{user.phone || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 flex items-center justify-center bg-purpleColor/10 rounded-lg">
                        <svg className="w-6 h-6 text-purpleColor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-textColor font-medium">Location</p>
                        <p className="text-lg text-headingColor font-semibold">{user.location || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primaryColor mb-4"></div>
              <p className="text-textColor">Loading your profile...</p>
            </div>
          </div>
        )}

        {user && !editMode && (
          <div className="mt-8">
            {securityError && (
              <div className="mb-4 border-l-4 border-red-500 bg-red-50 p-4 rounded-lg text-sm text-red-700">
                {securityError}
              </div>
            )}
            {securityMessage && (
              <div className="mb-4 border-l-4 border-green-500 bg-green-50 p-4 rounded-lg text-sm text-green-700">
                {securityMessage}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <h3 className="text-xl font-bold text-headingColor">Two-Factor Authentication</h3>
                  <span className={`text-sm font-semibold ${user.two_factor_enabled ? 'text-green-700' : 'text-gray-500'}`}>
                    {user.two_factor_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                {twoFactorSetup && (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs font-semibold text-textColor mb-1">Authenticator secret</p>
                    <code className="block break-all text-sm text-headingColor">{twoFactorSetup.secret}</code>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-headingColor mb-2">Password</label>
                    <input
                      type="password"
                      name="twoFactorPassword"
                      value={securityForm.twoFactorPassword}
                      onChange={updateSecurityField}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primaryColor outline-none"
                    />
                  </div>

                  {(twoFactorSetup || user.two_factor_enabled) && (
                    <div>
                      <label className="block text-sm font-semibold text-headingColor mb-2">Authenticator Code</label>
                      <input
                        type="text"
                        name="otp"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={securityForm.otp}
                        onChange={updateSecurityField}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primaryColor outline-none"
                      />
                    </div>
                  )}

                  {!user.two_factor_enabled && !twoFactorSetup && (
                    <button type="button" onClick={beginTwoFactor} className="w-full py-3 px-4 bg-primaryColor text-white font-semibold rounded-lg hover:bg-primaryColor/90">
                      Start Setup
                    </button>
                  )}
                  {!user.two_factor_enabled && twoFactorSetup && (
                    <button type="button" onClick={confirmTwoFactor} className="w-full py-3 px-4 bg-primaryColor text-white font-semibold rounded-lg hover:bg-primaryColor/90">
                      Enable 2FA
                    </button>
                  )}
                  {user.two_factor_enabled && (
                    <button type="button" onClick={disableTwoFactor} className="w-full py-3 px-4 border border-red-300 text-red-700 font-semibold rounded-lg hover:bg-red-50">
                      Disable 2FA
                    </button>
                  )}
                </div>
              </section>

              <form onSubmit={changePassword} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-bold text-headingColor mb-5">Change Password</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-headingColor mb-2">Current Password</label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={securityForm.currentPassword}
                      onChange={updateSecurityField}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primaryColor outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-headingColor mb-2">New Password</label>
                    <input
                      type="password"
                      name="newPassword"
                      minLength={8}
                      value={securityForm.newPassword}
                      onChange={updateSecurityField}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primaryColor outline-none"
                    />
                  </div>
                  <button type="submit" className="w-full py-3 px-4 bg-headingColor text-white font-semibold rounded-lg hover:bg-black">
                    Change Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {user && !editMode && <RecordAccessPanel role={user.role} />}
      </div>
    </div>
  );
};

export default Account;
