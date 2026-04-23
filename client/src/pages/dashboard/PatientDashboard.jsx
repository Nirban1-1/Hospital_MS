import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import { useNavigate } from 'react-router-dom';
import Chatbot from '../../components/Chatbot/Chatbot';

const PatientDashboard = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [specialties, setSpecialties] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [pickupLocation, setPickupLocation] = useState('');
  const [ambulanceRequests, setAmbulanceRequests] = useState([]);

  // required fields (fetched from profile, not typed)
  const [patientProfile, setPatientProfile] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // blood request inputs
  const [bloodGroup, setBloodGroup] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [note, setNote] = useState('');

  // keep existing states untouched
  const [matchedDonors, setMatchedDonors] = useState([]);
  const [requestMessage, setRequestMessage] = useState('');
  const [bloodRequests, setBloodRequests] = useState([]);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [patientName, setPatientName] = useState('');

  useEffect(() => {
    api.get('/api/appointment/specialties', { headers }).then(res => setSpecialties(res.data));
    api.get('/api/ambulance/my-requests', { headers }).then(res => setAmbulanceRequests(res.data));
    api.get('/api/appointment/my', { headers }).then(res => setAppointments(res.data));

    api.get('/api/users/profile', { headers })
      .then(res => {
        setPatientName(res.data.name);
        setPatientProfile({
          name: res.data.name || '',
          email: res.data.email || '',
          phone: res.data.phone || '',
        });
      })
      .catch(err => console.error('Error fetching user data:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.get('/api/blood/mine', { headers }).then(res => {
      setBloodRequests(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDoctors = async () => {
    if (!selectedSpecialty) return;
    const res = await api.get(`/api/appointment/doctors/${selectedSpecialty}`, { headers });
    setDoctors(res.data);
    setAvailables
    setAvailableSlots([]);
    setSelectedDoctor(null);
    setSelectedDate('');
    setAvailableDates([]);
  };

  const handleDoctorSelect = async (doctorId) => {
    setSelectedDoctor(doctorId);
    setSelectedDate('');
    setAvailableSlots([]);

    // Generate next 7 days
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        dateString: date.toISOString().split('T')[0],
        displayDate: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        dayName: date.toLocaleDateString('en-US', { weekday: 'long' })
      });
    }
    setAvailableDates(dates);
  };

  const handleDateSelect = async (dateString) => {
    setSelectedDate(dateString);
    try {
      const res = await api.get(`/api/appointment/doctor/${selectedDoctor}/slots/${dateString}`, { headers });
      setAvailableSlots(res.data);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      setAvailableSlots([]);
    }
  };

  const bookAppointment = async (slot) => {
    try {
      await api.post('/api/appointment/book', {
        doctor_id: selectedDoctor,
        date: slot.date,
        time: slot.time
      }, { headers });

      alert('Appointment booked successfully.');
      setAvailableSlots([]);
      setAvailableDates([]);
      setDoctors([]);
      setSelectedSpecialty('');
      setSelectedDoctor(null);
      setSelectedDate('');
      const updated = await api.get('/api/appointment/my', { headers });
      setAppointments(updated.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to book appointment.');
    }
  };

  const cancelAppointment = async (appointmentId) => {
    try {
      await api.put(`/api/appointment/${appointmentId}/cancel`, {}, { headers });
      alert('Appointment cancelled successfully.');
      const updated = await api.get('/api/appointment/my', { headers });
      setAppointments(updated.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel appointment.');
    }
  };

  const viewPrescription = (appointmentId) => {
    navigate('/prescriptions', { state: { appointmentId } });
  };

  const requestAmbulance = async () => {
    await api.post('/api/ambulance/request', { pickup_location: pickupLocation }, { headers });
    alert('Ambulance requested.');
  };

  const requestBlood = async () => {
    try {
      if (!patientProfile.name || !patientProfile.email || !patientProfile.phone) {
        setRequestMessage('Please update your profile (name, email, phone) first.');
        return;
      }
      if (!bloodGroup || !age || !gender) {
        setRequestMessage('Blood group, age, and gender are required.');
        return;
      }

      await api.post('/api/blood/request', {
        blood_group: bloodGroup,
        age: Number(age),
        gender,
        note
      }, { headers });

      alert('Blood request sent successfully.');
      setMatchedDonors([]);

      setBloodGroup('');
      setAge('');
      setGender('');
      setNote('');
      setRequestMessage('');

      const updated = await api.get('/api/blood/mine', { headers });
      setBloodRequests(updated.data);
    } catch (err) {
      console.error('Failed to request blood:', err);
      setRequestMessage(err.response?.data?.message || 'Failed to send blood request.');
    }
  };

  // Convert 24-hour time to 12-hour format with AM/PM
  const formatTime = (time) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-irisBlueColor/5 via-white to-primaryColor/5 py-6 sm:py-8 px-3 sm:px-4">
      <div className="mx-auto w-full max-w-7xl space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="mb-2 sm:mb-4">
          <h2 className="text-2xl sm:text-4xl font-bold text-headingColor mb-1 sm:mb-2">
            Patient Dashboard
          </h2>
          <p className="text-sm sm:text-base text-textColor">
            Manage your appointments and requests
          </p>
        </div>

        {/* Book Appointment */}
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100">
          <div className="flex items-start sm:items-center gap-3 mb-5 sm:mb-6">
            <div className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primaryColor to-irisBlueColor flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-2xl font-bold text-headingColor">
                Book a Doctor Appointment
              </h3>
              <p className="text-xs sm:text-sm text-textColor">
                Select specialty and doctor
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Specialty + Button */}
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedSpecialty}
                onChange={(e) => {
                  setSelectedSpecialty(e.target.value);
                  setDoctors([]);
                  setAvailableSlots([]);
                  setSelectedDoctor(null);
                }}
                className="w-full sm:flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primaryColor focus:ring-2 focus:ring-primaryColor/20 outline-none transition-all bg-white"
              >
                <option value="">Select a Specialty</option>
                {specialties.map((spec, i) => (
                  <option key={i} value={spec}>{spec}</option>
                ))}
              </select>

              <button
                onClick={fetchDoctors}
                disabled={!selectedSpecialty}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-primaryColor to-irisBlueColor text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Find Doctors
              </button>
            </div>

            {/* Doctors */}
            {doctors.length > 0 && (
              <div className="mt-4 sm:mt-5">
                <h4 className="font-semibold text-headingColor mb-3">Available Doctors:</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  {doctors.map((doc) => (
                    <div
                      key={doc._id}
                      onClick={() => handleDoctorSelect(doc._id)}
                      className={`border-2 p-4 rounded-xl transition-all cursor-pointer ${
                        selectedDoctor === doc._id
                          ? 'border-primaryColor bg-primaryColor/5 shadow-lg'
                          : 'border-gray-200 hover:border-primaryColor/50 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-headingColor text-base sm:text-lg truncate">
                            {doc.name}
                          </p>
                          <p className="text-xs sm:text-sm text-textColor truncate">
                            {doc.specialization}
                          </p>
                        </div>
                        {selectedDoctor === doc._id && (
                          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primaryColor">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            {availableDates.length > 0 && (
              <div className="mt-5 sm:mt-6">
                <h4 className="font-semibold text-headingColor mb-3">Select a Date (Next 7 Days):</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
                  {availableDates.map((date) => (
                    <button
                      key={date.dateString}
                      onClick={() => handleDateSelect(date.dateString)}
                      className={`p-3 sm:p-4 rounded-xl border-2 transition-all duration-300 ${
                        selectedDate === date.dateString
                          ? 'border-primaryColor bg-primaryColor text-white shadow-lg transform sm:scale-105'
                          : 'border-gray-200 hover:border-primaryColor hover:shadow-md bg-white'
                      }`}
                    >
                      <div className="text-center">
                        <p className={`text-[10px] sm:text-xs font-semibold mb-1 ${selectedDate === date.dateString ? 'text-white' : 'text-textColor'}`}>
                          {date.dayName}
                        </p>
                        <p className={`text-base sm:text-lg font-bold ${selectedDate === date.dateString ? 'text-white' : 'text-headingColor'}`}>
                          {new Date(date.dateString).getDate()}
                        </p>
                        <p className={`text-[10px] sm:text-xs ${selectedDate === date.dateString ? 'text-white' : 'text-textColor'}`}>
                          {new Date(date.dateString).toLocaleDateString('en-US', { month: 'short' })}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Slots */}
            {availableSlots.length > 0 && selectedDate && (
              <div className="mt-5 sm:mt-6">
                <h4 className="font-semibold text-headingColor mb-3">
                  Available Time Slots for{' '}
                  {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}:
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                  {availableSlots.map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => bookAppointment(slot)}
                      className="group p-4 border-2 border-gray-200 rounded-xl hover:border-primaryColor hover:bg-gradient-to-br hover:from-primaryColor hover:to-irisBlueColor transition-all duration-300 text-left hover:shadow-lg sm:hover:scale-105"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-primaryColor group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-bold text-headingColor group-hover:text-white text-base sm:text-lg">
                          {formatTime(slot.time)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <div className="flex gap-0.5">
                          {[...Array(4)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full ${
                                i < slot.available_spots
                                  ? 'bg-green-500 group-hover:bg-white'
                                  : 'bg-gray-300 group-hover:bg-white/50'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-green-600 group-hover:text-white ml-1">
                          {slot.available_spots} left
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No slots */}
            {selectedDate && availableSlots.length === 0 && (
              <div className="mt-5 sm:mt-6 p-5 sm:p-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-center">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-headingColor font-semibold">No available slots for this date</p>
                <p className="text-textColor text-sm mt-1">Please select another date</p>
              </div>
            )}
          </div>
        </div>

        {/* Appointments */}
        {appointments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100">
            <div className="flex items-start sm:items-center gap-3 mb-5 sm:mb-6">
              <div className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-irisBlueColor to-purpleColor flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-2xl font-bold text-headingColor">Your Appointments</h3>
                <p className="text-xs sm:text-sm text-textColor">Manage your upcoming visits</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {appointments.map((appt) => (
                <div
                  key={appt._id}
                  className={`border-2 border-gray-200 p-4 rounded-xl hover:border-primaryColor/50 transition-all ${
                    appt.status === 'treated' ? 'cursor-pointer hover:shadow-lg' : ''
                  }`}
                  onClick={() => appt.status === 'treated' && viewPrescription(appt._id)}
                >
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-bold text-headingColor text-base sm:text-lg truncate">
                        {appt.doctor_name}
                      </p>
                      <p className="text-xs sm:text-sm text-textColor truncate">
                        {appt.specialization}
                      </p>
                    </div>

                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                      appt.status === 'booked' ? 'bg-blue-100 text-blue-700' :
                      appt.status === 'completed' ? 'bg-green-100 text-green-700' :
                      appt.status === 'treated' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {appt.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-textColor">
                    <p className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <strong>Date:</strong> {appt.date}
                    </p>
                    <p className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <strong>Time:</strong> {formatTime(appt.time)}
                    </p>
                  </div>

                  {appt.status === 'booked' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelAppointment(appt._id);
                      }}
                      className="mt-3 w-full px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Cancel Appointment
                    </button>
                  )}

                  {appt.status === 'treated' && (
                    <div className="mt-3 w-full px-4 py-2 bg-gradient-to-r from-primaryColor to-irisBlueColor text-white font-semibold rounded-lg text-center">
                      Click to View Prescription →
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ambulance */}
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100">
          <div className="flex items-start sm:items-center gap-3 mb-5 sm:mb-6">
            <div className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-2xl font-bold text-headingColor">Request an Ambulance</h3>
              <p className="text-xs sm:text-sm text-textColor">Emergency medical transport</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Pickup Location"
              className="w-full sm:flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
            />
            <button
              onClick={requestAmbulance}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
            >
              Request Ambulance
            </button>
          </div>
        </div>

        {ambulanceRequests.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100">
            <h3 className="text-lg sm:text-xl font-bold text-headingColor mb-4">Your Ambulance Requests</h3>
            <div className="space-y-3">
              {ambulanceRequests.map((req) => (
                <div key={req._id} className="border-2 border-gray-200 p-4 rounded-xl">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-headingColor break-words">
                        Pickup: {req.pickup_location}
                      </p>
                      <p className="text-xs sm:text-sm text-textColor">
                        Requested: {new Date(req.requested_at).toLocaleString()}
                      </p>
                    </div>

                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                      req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      req.status === 'accepted' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blood Request */}
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100">
          <div className="flex items-start sm:items-center gap-3 mb-5 sm:mb-6">
            <div className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-2xl font-bold text-headingColor">Request Blood</h3>
              <p className="text-xs sm:text-sm text-textColor">Find blood donors near you</p>
            </div>
          </div>

          {/* fetched required fields (read-only) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input
              type="text"
              placeholder="Name"
              className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 w-full"
              value={patientProfile.name}
              disabled
            />
            <input
              type="text"
              placeholder="Email"
              className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 w-full"
              value={patientProfile.email}
              disabled
            />
            <input
              type="text"
              placeholder="Phone"
              className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 w-full"
              value={patientProfile.phone}
              disabled
            />
          </div>

          {/* inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Blood Group (e.g. A+)"
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all w-full"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
            />

            <input
              type="number"
              placeholder="Age"
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all w-full"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />

            <select
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all bg-white w-full"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>

            <button
              onClick={requestBlood}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
            >
              Send Request
            </button>
          </div>

          <textarea
            placeholder="Note (optional)"
            className="mt-3 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {requestMessage && <p className="text-red-600 mt-3 text-sm">{requestMessage}</p>}
        </div>

        {/* Blood Request Status */}
        {bloodRequests.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100">
            <h3 className="text-lg sm:text-xl font-bold text-headingColor mb-4">Your Blood Requests</h3>
            <div className="space-y-4">
              {bloodRequests.map((req) => (
                <div key={req._id || req.id} className="border-2 border-gray-200 p-4 rounded-xl">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-headingColor break-words">
                        Blood Group: {req.blood_group || req.blood_type}
                      </p>
                      <p className="text-xs sm:text-sm text-textColor">Age: {req.age}</p>
                      <p className="text-xs sm:text-sm text-textColor">Gender: {req.gender}</p>
                      {req.note ? <p className="text-xs sm:text-sm text-textColor break-words">Note: {req.note}</p> : null}
                    </div>

                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                      req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      req.status === 'accepted' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {req.status}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-textColor">
                    Requested: {new Date(req.requested_at).toLocaleString()}
                  </p>

                  {req.accepted_at && (
                    <p className="text-xs sm:text-sm text-green-600">
                      Accepted: {new Date(req.accepted_at).toLocaleString()}
                    </p>
                  )}

                  {req.donor && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm font-semibold text-headingColor">Donor Details:</p>
                      <p className="text-xs sm:text-sm text-textColor break-words">Name: {req.donor.name}</p>
                      <p className="text-xs sm:text-sm text-textColor break-words">Phone: {req.donor.phone}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Chatbot Button */}
      <button
        onClick={() => setIsChatbotOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-primaryColor to-irisBlueColor text-white rounded-full shadow-2xl transform hover:scale-110 transition-all duration-300 flex items-center justify-center z-50 group"
        title="Chat with Healthcare Assistant"
      >
        <svg className="w-7 h-7 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
          AI
        </span>
      </button>

      {/* Chatbot Component */}
      <Chatbot
        isOpen={isChatbotOpen}
        onClose={() => setIsChatbotOpen(false)}
        patientName={patientName}
      />
    </div>
  );
};

export default PatientDashboard;
