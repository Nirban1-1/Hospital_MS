import React, { useEffect, useState } from 'react';
import api from '../../api/api';

const DoctorDashboard = () => {
  const [specialization, setSpecialization] = useState('');
  const [slots, setSlots] = useState([]);
  const [newSlot, setNewSlot] = useState({ date: '', time: '' });
  const [selectedDate, setSelectedDate] = useState('');
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [prescriptionForm, setPrescriptionForm] = useState({
    notes: '',
    medicines: [],
  });
  const [showFormId, setShowFormId] = useState(null);
  const [isEditingSpecialization, setIsEditingSpecialization] = useState(false);
  const [activeTab, setActiveTab] = useState('appointments');

  const [medicines, setMedicines] = useState([]);
  const [medicineSearch, setMedicineSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedicines, setSelectedMedicines] = useState([]);

  const [treatedPatients, setTreatedPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [bookedPatientHistory, setBookedPatientHistory] = useState({});
  const [loadingBookedHistoryId, setLoadingBookedHistoryId] = useState(null);

  // Test Prescription States
  const [testQuery, setTestQuery] = useState('');
  const [testSuggestions, setTestSuggestions] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [isSearchingTests, setIsSearchingTests] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchDoctorData = async () => {
      try {
        const res = await api.get('/api/doctor/dashboard', { headers });
        setSpecialization(res.data.doctor.specialization || '');
        setSlots(res.data.doctor.available_slots || []);
        setAppointments(res.data.appointments || []);
      } catch (err) {
        console.error('Failed to load doctor dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctorData();
  }, []);

  // Dynamic medicine search with debouncing
  useEffect(() => {
    const searchMedicines = async () => {
      if (!medicineSearch || medicineSearch.length < 1) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await api.get(
          `/api/medicines/autocomplete?q=${medicineSearch}`,
          { headers }
        );
        setSearchResults(res.data.medicines || []);
      } catch (err) {
        console.error('Failed to search medicines:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      searchMedicines();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [medicineSearch]);

  // Dynamic test search with debounce
  useEffect(() => {
    if (!testQuery) {
      setTestSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setIsSearchingTests(true);
        const res = await api.get(`/api/tests/search?q=${testQuery}`, {
          headers,
        });
        const data = res.data;
        setTestSuggestions(Array.isArray(data) ? data : data.tests || []);
      } catch (err) {
        console.error('Test search failed', err);
      } finally {
        setIsSearchingTests(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [testQuery]);

  useEffect(() => {
    if (activeTab === 'treated') {
      fetchTreatedPatients();
    }
  }, [activeTab]);

  const handleSpecializationUpdate = async () => {
    try {
      await api.put(
        '/api/doctor/specialization',
        { specialization },
        { headers }
      );
      alert('Specialization updated.');
      setIsEditingSpecialization(false);
    } catch (err) {
      console.error('Failed to update specialization:', err);
    }
  };

  const handleAddSlot = async () => {
    if (!newSlot.date || !newSlot.time)
      return alert('Both date and time are required.');

    const slotDateTime = new Date(`${newSlot.date}T${newSlot.time}`);
    const now = new Date();
    if (slotDateTime < now) {
      return alert(
        'Cannot add a slot in the past. Please select a future date and time.'
      );
    }

    try {
      const res = await api.post('/api/doctor/slots', newSlot, { headers });
      setSlots(res.data.available_slots);
      setNewSlot({ date: '', time: '' });
      setSelectedDate('');
      setAvailableTimeSlots([]);
    } catch (err) {
      console.error('Failed to add slot:', err);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setNewSlot({ ...newSlot, date });

    const times = [
      '17:00',
      '17:30',
      '18:00',
      '18:30',
      '19:00',
      '19:30',
      '20:00',
      '20:30',
      '21:00',
      '21:30',
      '22:00',
    ];
    setAvailableTimeSlots(times);
  };

  const handleTimeSelect = (time) => {
    setNewSlot({ ...newSlot, time });
  };

  const formatTime = (time) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const groupSlotsByDate = () => {
    const grouped = {};

    slots.forEach((slot) => {
      if (!grouped[slot.date]) {
        grouped[slot.date] = [];
      }
      grouped[slot.date].push(slot);
    });

    return Object.keys(grouped)
      .sort((a, b) => new Date(a) - new Date(b))
      .map((date) => ({
        date,
        slots: grouped[date].sort((a, b) => a.time.localeCompare(b.time)),
      }));
  };

  const handleDeleteSlot = async (date, time) => {
    try {
      const res = await api.delete('/api/doctor/slots', {
        headers,
        data: { date, time },
      });
      setSlots(res.data.available_slots);
    } catch (err) {
      console.error('Failed to delete slot:', err);
    }
  };

  const handlePrescribe = async (appointmentId) => {
    try {
      if (selectedMedicines.length === 0) {
        return alert('Please select at least one medicine.');
      }

      // include selected tests in the prescription request so backend creates TestReport
      await api.post(
        '/api/doctor/prescribe',
        {
          appointment_id: appointmentId,
          medicines: selectedMedicines,
          notes: prescriptionForm.notes || '',
          tests: selectedTests.map((t) => ({
            testId: t.testId,
            testName: t.testName,
            showingDate: t.showingDate,
          })),
        },
        { headers }
      );

      alert('Prescription submitted successfully!');
      setShowFormId(null);
      setPrescriptionForm({ notes: '', medicines: [] });
      setSelectedMedicines([]);
      setSelectedTests([]);

      const updated = appointments.map((a) =>
        a._id === appointmentId ? { ...a, status: 'treated' } : a
      );
      setAppointments(updated);
    } catch (err) {
      console.error(
        'Failed to submit prescription:',
        err.response?.data || err.message
      );
      alert(err.response?.data?.message || 'Failed to submit prescription');
    }
  };

  const fetchTreatedPatients = async () => {
    try {
      const res = await api.get('/api/doctor/treated-patients', { headers });
      setTreatedPatients(res.data.patients || []);
    } catch (err) {
      console.error('Failed to load treated patients:', err);
    }
  };

  const fetchPatientHistory = async (patientId) => {
    try {
      const res = await api.get(`/api/doctor/patient-history/${patientId}`, {
        headers,
      });
      setPatientHistory(res.data.appointments || []);
      setSelectedPatient(patientId);
    } catch (err) {
      console.error('Failed to load patient history:', err);
    }
  };


  const handleShowBookedPatientHistory = async (appointment) => {
    const existingHistory = bookedPatientHistory[appointment._id];

    if (existingHistory?.appointments) {
      setBookedPatientHistory((prev) => ({
        ...prev,
        [appointment._id]: {
          ...existingHistory,
          open: !existingHistory.open,
        },
      }));
      return;
    }

    setLoadingBookedHistoryId(appointment._id);

    try {
      const res = await api.get(
        `/api/doctor/patient-history/${appointment.patient_id}`,
        { headers }
      );

      setBookedPatientHistory((prev) => ({
        ...prev,
        [appointment._id]: {
          open: true,
          appointments: res.data.appointments || [],
        },
      }));
    } catch (err) {
      console.error('Failed to load booked patient history:', err);
    } finally {
      setLoadingBookedHistoryId(null);
    }
  };

  const handleAddMedicine = (medicine) => {
    if (selectedMedicines.find((m) => m.medicine_id === medicine._id)) {
      return alert('Medicine already added');
    }
    setSelectedMedicines([
      ...selectedMedicines,
      {
        medicine_id: medicine._id,
        name: medicine.drugName,
        dosage: '',
        duration: '',
        timing: { morning: 0, noon: 0, night: 0 },
      },
    ]);
  };

  const handleRemoveMedicine = (medicineId) => {
    setSelectedMedicines(
      selectedMedicines.filter((m) => m.medicine_id !== medicineId)
    );
  };

  const updateMedicineDetails = (medicineId, field, value) => {
    setSelectedMedicines(
      selectedMedicines.map((m) =>
        m.medicine_id === medicineId ? { ...m, [field]: value } : m
      )
    );
  };

  const addTest = (test) => {
    if (selectedTests.find((t) => t.testId === test._id)) return;
    setSelectedTests([
      ...selectedTests,
      {
        testId: test._id,
        testName: test.name,
        showingDate: '',
      },
    ]);
    setTestQuery('');
    setTestSuggestions([]);
  };

  const updateTestDate = (testId, date) => {
    setSelectedTests(
      selectedTests.map((t) =>
        t.testId === testId ? { ...t, showingDate: date } : t
      )
    );
  };

  const removeTest = (testId) => {
    setSelectedTests(selectedTests.filter((t) => t.testId !== testId));
  };

  const updateMedicineTiming = (medicineId, timingField, value) => {
    setSelectedMedicines(
      selectedMedicines.map((m) =>
        m.medicine_id === medicineId
          ? {
              ...m,
              timing: {
                ...m.timing,
                [timingField]: parseInt(value) || 0,
              },
            }
          : m
      )
    );
  };

  const sortAppointmentsByDateTime = (a, b) =>
    new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`);

  const bookedAppointments = appointments
    .filter((a) => a.status === 'booked')
    .slice()
    .sort(sortAppointmentsByDateTime);

  const treatedAppointments = appointments
    .filter((a) => a.status === 'treated')
    .slice()
    .sort(sortAppointmentsByDateTime);

  const hasTreatedHistoryForEmail = (email) =>
    treatedAppointments.some((appt) => appt.patient_email === email);

  // Get current appointment being prescribed
  const currentAppointment = appointments.find((a) => a._id === showFormId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-irisBlueColor5 via-white to-primaryColor5 py-6 sm:py-8 px-3 sm:px-4">
        <div className="container max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primaryColor mb-4"></div>
              <p className="text-textColor">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-irisBlueColor5 via-white to-primaryColor5 py-6 sm:py-8 px-3 sm:px-4">
      <div className="container max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-4xl font-bold text-headingColor mb-2">
            Doctor Dashboard
          </h2>
          <p className="text-textColor">Manage your schedule and appointments</p>
        </div>

        {/* Specialization Card */}
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purpleColor to-primaryColor flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-headingColor">
                Specialization
              </h3>
              <p className="text-sm text-textColor">Set your medical specialty</p>
            </div>
          </div>

          {isEditingSpecialization ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primaryColor focus:ring-2 focus:ring-primaryColor/20 outline-none transition-all bg-white"
              >
                <option value="">Select specialization</option>
                {[
                  "Cardiologist",
  "Pediatrician",
  "Neurologist",
  "Gynecologist",
  "Orthopedic Surgeon",
  "Dermatologist",
  "Gastroenterologist",
  "Ophthalmologist",
  "Pulmonologist",
  "Endocrinologist",
  "Urologist",
  "Psychiatrist",
  "Oncologist",
  "Rheumatologist",
  "Nephrologist",
  "Hematologist",
  "ENT Specialist",
  "Allergist",
  "General Surgeon",
  "Radiologist",
  "Anesthesiologist",
  "Pathologist",
  "Vascular Surgeon",
  "Diabetologist",
  "Plastic Surgeon"
                ].map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSpecializationUpdate}
                className="px-6 py-3 bg-gradient-to-r from-primaryColor to-irisBlueColor text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingSpecialization(false)}
                className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all duration-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primaryColor/10 to-irisBlueColor/10 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-primaryColor"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-textColor">Your Specialization</p>
                  <p className="font-semibold text-headingColor text-lg">
                    {specialization}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingSpecialization(true)}
                className="px-4 py-2 bg-white text-primaryColor font-semibold rounded-lg hover:shadow-md transition-all duration-300 border border-primaryColor"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-6 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('appointments')}
              className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                activeTab === 'appointments'
                  ? 'bg-gradient-to-r from-primaryColor to-irisBlueColor text-white'
                  : 'text-textColor hover:bg-gray-50'
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              Appointments
              {appointments.filter((a) => a.status === 'booked').length > 0 && (
                <span className="px-2 py-1 rounded-full text-xs font-bold bg-white/20 text-white">
                  {appointments.filter((a) => a.status === 'booked').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('slots')}
              className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                activeTab === 'slots'
                  ? 'bg-gradient-to-r from-primaryColor to-irisBlueColor text-white'
                  : 'text-textColor hover:bg-gray-50'
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Manage Slots
              {slots.length > 0 && (
                <span className="px-2 py-1 rounded-full text-xs font-bold bg-primaryColor/10 text-primaryColor">
                  {slots.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('treated')}
              className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                activeTab === 'treated'
                  ? 'bg-gradient-to-r from-primaryColor to-irisBlueColor text-white'
                  : 'text-textColor hover:bg-gray-50'
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Treated Patients
              {treatedPatients.length > 0 && (
                <span className="px-2 py-1 rounded-full text-xs font-bold bg-primaryColor/10 text-primaryColor">
                  {treatedPatients.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4 sm:p-6">
            {/* Appointments Tab */}
            {activeTab === 'appointments' && (
              <div>
                {bookedAppointments.length === 0 &&
                treatedAppointments.length === 0 ? (
                  <div className="text-center py-12">
                    <svg
                      className="w-16 h-16 text-gray-300 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <h3 className="text-xl font-semibold text-headingColor mb-2">
                      No Appointments Yet
                    </h3>
                    <p className="text-textColor">
                      You don't have any upcoming appointments
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Booked */}
                    <details
                      open
                      className="bg-white border border-gray-100 rounded-2xl shadow-sm"
                    >
                      <summary className="cursor-pointer select-none px-6 py-4 flex items-center justify-between bg-gradient-to-r from-primaryColor/10 to-irisBlueColor/10 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-blue-700"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-headingColor">
                              Booked Appointments
                            </p>
                            <p className="text-xs text-textColor">
                              Sorted by time
                            </p>
                          </div>
                        </div>

                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                          {bookedAppointments.length}
                        </span>
                      </summary>

                      <div className="p-6 space-y-3">
                        {bookedAppointments.length === 0 ? (
                          <p className="text-sm text-textColor">
                            No booked appointments.
                          </p>
                        ) : (
                          bookedAppointments.map((appt) => (
                            <details
                              key={appt._id}
                              className="border-2 border-gray-200 rounded-xl bg-white overflow-hidden"
                            >
                              <summary className="cursor-pointer select-none px-4 py-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primaryColor to-yellowColor flex items-center justify-center text-white font-semibold">
                                    {appt.patient_name
                                      ?.charAt(0)
                                      .toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-headingColor truncate">
                                      {appt.patient_name}
                                    </p>
                                    <p className="text-xs text-textColor truncate">
                                      {appt.patient_email}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <p className="text-xs text-textColor">
                                    {appt.date}
                                  </p>
                                  <p className="text-sm font-bold text-headingColor">
                                    {formatTime(appt.time)}
                                  </p>
                                  <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                    Booked
                                  </span>
                                </div>
                              </summary>

                              <div className="px-4 pb-4 pt-0">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 rounded-xl p-4">
                                  <div>
                                    <p className="text-xs text-textColor font-semibold">
                                      Phone
                                    </p>
                                    <p className="text-sm text-headingColor">
                                      {appt.patient_phone}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-textColor font-semibold">
                                      Appointment ID
                                    </p>
                                    <p className="text-xs font-mono text-gray-600">
                                      {appt._id.slice(-8)}
                                    </p>
                                  </div>
                                  <div className="flex items-end justify-start md:justify-end">
                                    <button
                                      onClick={() =>
                                        setShowFormId(
                                          showFormId === appt._id
                                            ? null
                                            : appt._id
                                        )
                                      }
                                      className="px-4 py-2 bg-primaryColor hover:bg-primaryColor/90 text-white text-sm font-semibold rounded-lg transition-all duration-300 hover:shadow-lg"
                                    >
                                      Write Prescription
                                    </button>
                                  </div>

                                  
                                  {hasTreatedHistoryForEmail(
                                    appt.patient_email
                                  ) && (
                                    <div className="md:col-span-3 flex flex-col gap-3 border-t border-gray-200 pt-4">
                                      <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                          <p className="text-xs text-textColor font-semibold">
                                            Patient history
                                          </p>
                                          <p className="text-sm text-headingColor">
                                            Previous prescriptions for this patient
                                          </p>
                                        </div>

                                        <button
                                          onClick={() =>
                                            handleShowBookedPatientHistory(appt)
                                          }
                                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-all duration-300 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                                          disabled={
                                            loadingBookedHistoryId === appt._id
                                          }
                                        >
                                          {loadingBookedHistoryId === appt._id
                                            ? 'Loading...'
                                            : bookedPatientHistory[appt._id]?.open
                                            ? 'Hide Patient History'
                                            : 'Show Patient History'}
                                        </button>
                                      </div>

                                      {bookedPatientHistory[appt._id]?.open && (
                                        <div className="space-y-3 rounded-xl bg-green-50 p-4 border border-green-100">
                                          {bookedPatientHistory[appt._id].appointments.length > 0 ? (
                                            bookedPatientHistory[appt._id].appointments.map((historyAppt, idx) => (
                                              <div
                                                key={historyAppt._id}
                                                className="rounded-lg bg-white p-4 border border-green-100"
                                              >
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                                  <p className="font-semibold text-headingColor">
                                                    Visit {idx + 1}
                                                  </p>
                                                  <p className="text-xs text-textColor">
                                                    {historyAppt.date} at {formatTime(historyAppt.time)}
                                                  </p>
                                                </div>

                                                {historyAppt.prescription_id ? (
                                                  <div className="space-y-3">
                                                    <div>
                                                      <p className="text-xs font-semibold text-textColor mb-1">
                                                        Notes
                                                      </p>
                                                      <p className="text-sm text-headingColor bg-gray-50 rounded-lg p-3">
                                                        {historyAppt.prescription_id.notes || 'No notes provided'}
                                                      </p>
                                                    </div>

                                                    <div>
                                                      <p className="text-xs font-semibold text-textColor mb-2">
                                                        Prescribed Medicines
                                                      </p>
                                                      <div className="space-y-2">
                                                        {historyAppt.prescription_id.medicines?.length > 0 ? (
                                                          historyAppt.prescription_id.medicines.map((med, medIdx) => (
                                                            <div
                                                              key={medIdx}
                                                              className="rounded-lg bg-gray-50 p-3"
                                                            >
                                                              <p className="font-semibold text-sm text-headingColor">
                                                                {med.medicine_id?.drugName || 'Medicine'}
                                                              </p>
                                                              <div className="flex flex-wrap gap-3 mt-1 text-xs text-textColor">
                                                                {med.dosage && (
                                                                  <span>
                                                                    <strong>Dosage:</strong> {med.dosage}
                                                                  </span>
                                                                )}
                                                                {med.duration && (
                                                                  <span>
                                                                    <strong>Duration:</strong> {med.duration}
                                                                  </span>
                                                                )}
                                                              </div>
                                                            </div>
                                                          ))
                                                        ) : (
                                                          <p className="text-sm text-textColor">
                                                            No medicines found.
                                                          </p>
                                                        )}
                                                      </div>
                                                    </div>

                                                  
                                                    <div>
                                                      <p className="text-xs font-semibold text-textColor mb-2">
                                                        Prescribed Tests
                                                      </p>
                                                      <div className="space-y-2">
                                                        {historyAppt.prescription_id.tests?.length > 0 ? (
                                                          historyAppt.prescription_id.tests.map((test, testIdx) => (
                                                            <div
                                                              key={testIdx}
                                                              className="rounded-lg bg-gray-50 p-3"
                                                            >
                                                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                                <p className="font-semibold text-sm text-headingColor">
                                                                  {test.test_name || 'Test'}
                                                                </p>
                                                                <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 capitalize">
                                                                  {test.status || 'suggested'}
                                                                </span>
                                                              </div>

                                                              <div className="mt-2 flex flex-col gap-1 text-xs text-textColor">
                                                                {test.description && (
                                                                  <p>
                                                                    <strong>Description:</strong> {test.description}
                                                                  </p>
                                                                )}
                                                                {test.test_report && (
                                                                  <p>
                                                                    <strong>Report:</strong> {test.test_report}
                                                                  </p>
                                                                )}
                                                                {test.report_date && (
                                                                  <p>
                                                                    <strong>Report Date:</strong>{' '}
                                                                    {new Date(test.report_date).toLocaleDateString()}
                                                                  </p>
                                                                )}
                                                              </div>
                                                            </div>
                                                          ))
                                                        ) : (
                                                          <p className="text-sm text-textColor">
                                                            No tests were prescribed.
                                                          </p>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <p className="text-sm text-textColor">
                                                    Prescription not available for this visit.
                                                  </p>
                                                )}
                                              </div>
                                            ))
                                          ) : (
                                            <p className="text-sm text-textColor">
                                              No previous treated appointments found for this patient.
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </details>
                          ))
                        )}
                      </div>
                    </details>

                    {/* Treated */}
                    <details className="bg-white border border-gray-100 rounded-2xl shadow-sm">
                      <summary className="cursor-pointer select-none px-6 py-4 flex items-center justify-between bg-gradient-to-r from-green-50 to-irisBlueColor/10 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-green-700"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-headingColor">
                              Treated Appointments
                            </p>
                            <p className="text-xs text-textColor">
                              Sorted by time
                            </p>
                          </div>
                        </div>

                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                          {treatedAppointments.length}
                        </span>
                      </summary>

                      <div className="p-6 space-y-3">
                        {treatedAppointments.length === 0 ? (
                          <p className="text-sm text-textColor">
                            No treated appointments.
                          </p>
                        ) : (
                          treatedAppointments.map((appt) => (
                            <details
                              key={appt._id}
                              className="border-2 border-gray-200 rounded-xl bg-white overflow-hidden"
                            >
                              <summary className="cursor-pointer select-none px-4 py-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primaryColor to-yellowColor flex items-center justify-center text-white font-semibold">
                                    {appt.patient_name
                                      ?.charAt(0)
                                      .toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-headingColor truncate">
                                      {appt.patient_name}
                                    </p>
                                    <p className="text-xs text-textColor truncate">
                                      {appt.patient_email}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <p className="text-xs text-textColor">
                                    {appt.date}
                                  </p>
                                  <p className="text-sm font-bold text-headingColor">
                                    {formatTime(appt.time)}
                                  </p>
                                  <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                    Treated
                                  </span>
                                </div>
                              </summary>

                              <div className="px-4 pb-4 pt-0">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 rounded-xl p-4">
                                  <div>
                                    <p className="text-xs text-textColor font-semibold">
                                      Phone
                                    </p>
                                    <p className="text-sm text-headingColor">
                                      {appt.patient_phone}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-textColor font-semibold">
                                      Appointment ID
                                    </p>
                                    <p className="text-xs font-mono text-gray-600">
                                      {appt._id.slice(-8)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-textColor font-semibold">
                                      Email
                                    </p>
                                    <p className="text-sm text-headingColor break-words">
                                      {appt.patient_email}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </details>
                          ))
                        )}
                      </div>
                    </details>
                  </div>
                )}

                {/* Prescription Form */}
                {showFormId && currentAppointment && (
                  <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100 animate-fadeIn mt-6">
                    {/* ========== PATIENT DETAILS SECTION ========== */}
                    <div className="bg-gradient-to-r from-primaryColor/10 to-irisBlueColor/10 rounded-xl p-6 mb-6 border border-primaryColor/20">
                      <h4 className="text-sm font-semibold text-textColor mb-3">
                        PATIENT INFORMATION
                      </h4>
                      <div className="flex flex-col sm:flex-row sm:items-center items-start gap-4">
                        {/* Patient Avatar */}
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primaryColor to-yellowColor flex items-center justify-center text-white font-bold text-2xl shadow-md">
                          {currentAppointment.patient_name
                            ?.charAt(0)
                            .toUpperCase()}
                        </div>

                        {/* Patient Details */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Name */}
                          <div>
                            <p className="text-xs text-textColor font-semibold mb-1">
                              PATIENT NAME
                            </p>
                            <p className="text-lg font-bold text-headingColor">
                              {currentAppointment.patient_name}
                            </p>
                          </div>

                          {/* Email */}
                          <div>
                            <p className="text-xs text-textColor font-semibold mb-1">
                              EMAIL
                            </p>
                            <p className="text-sm text-headingColor break-words">
                              {currentAppointment.patient_email}
                            </p>
                          </div>

                          {/* Phone */}
                          <div>
                            <p className="text-xs text-textColor font-semibold mb-1">
                              PHONE
                            </p>
                            <p className="text-sm text-headingColor">
                              {currentAppointment.patient_phone}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Appointment Details */}
                      <div className="mt-4 pt-4 border-t border-primaryColor/20 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-textColor font-semibold mb-1">
                            APPOINTMENT DATE
                          </p>
                          <p className="text-sm font-semibold text-headingColor">
                            {currentAppointment.date}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-textColor font-semibold mb-1">
                            APPOINTMENT TIME
                          </p>
                          <p className="text-sm font-semibold text-headingColor">
                            {formatTime(currentAppointment.time)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-textColor font-semibold mb-1">
                            STATUS
                          </p>
                          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                            {currentAppointment.status.charAt(0).toUpperCase() +
                              currentAppointment.status.slice(1)}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-textColor font-semibold mb-1">
                            APPOINTMENT ID
                          </p>
                          <p className="text-xs font-mono text-gray-600">
                            {currentAppointment._id.slice(-8)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ========== PRESCRIPTION FORM ICON & TITLE ========== */}
                    <div className="flex items-center gap-3 mb-6 pb-6 border-b-2 border-gray-200">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purpleColor to-irisBlueColor flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold text-headingColor">
                          Write Prescription
                        </h4>
                        <p className="text-sm text-textColor">
                          Add medicines, notes, and tests for treatment
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-semibold text-headingColor mb-2">
                          Medical Notes
                        </label>
                        <textarea
                          rows={4}
                          placeholder="Enter diagnosis, observations, or additional notes..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purpleColor focus:ring-2 focus:ring-purpleColor/20 outline-none transition-all resize-none"
                          onChange={(e) =>
                            setPrescriptionForm((prev) => ({
                              ...prev,
                              notes: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Medicines */}
                      <div>
                        <label className="block text-sm font-semibold text-headingColor mb-2">
                          Medicines
                        </label>

                        <div className="space-y-3">
                          <div className="relative">
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Type medicine name (e.g., A for all medicines starting with A)..."
                                value={medicineSearch}
                                onChange={(e) =>
                                  setMedicineSearch(e.target.value)
                                }
                                className="w-full px-4 py-3 pr-10 border-2 border-gray-200 rounded-xl focus:border-purpleColor focus:ring-2 focus:ring-purpleColor/20 outline-none transition-all"
                              />
                              {isSearching && (
                                <div className="absolute right-3 top-12 transform -translate-y-12">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purpleColor"></div>
                                </div>
                              )}
                            </div>

                            {medicineSearch && searchResults.length > 0 && (
                              <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-96 overflow-y-auto">
                                <div className="p-2 bg-gray-50 border-b border-gray-200">
                                  <p className="text-xs text-textColor font-semibold">
                                    {searchResults.length} medicines found
                                  </p>
                                </div>
                                {searchResults.map((medicine) => (
                                  <div
                                    key={medicine._id}
                                    onClick={() => {
                                      handleAddMedicine(medicine);
                                      setMedicineSearch('');
                                      setSearchResults([]);
                                    }}
                                    className="px-4 py-3 hover:bg-purpleColor/5 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <p className="font-semibold text-headingColor">
                                          {medicine.drugName}
                                        </p>
                                        <p className="text-xs text-textColor mt-1">
                                          {medicine.description}
                                        </p>
                                        <div className="flex items-center gap-3 mt-2">
                                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                            {medicine.category}
                                          </span>
                                          <span className="text-xs text-textColor">
                                            {medicine.manufacturer}
                                          </span>
                                          <span className="text-xs text-green-600 font-semibold">
                                            Stock {medicine.countInStock}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-right ml-3">
                                        <p className="text-sm font-bold text-primaryColor">
                                          {medicine.price}
                                        </p>
                                        <p className="text-xs text-textColor">
                                          {medicine.consumeType}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {medicineSearch &&
                              !isSearching &&
                              searchResults.length === 0 && (
                                <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg p-4">
                                  <p className="text-sm text-textColor text-center">
                                    No medicines found matching "
                                    {medicineSearch}"
                                  </p>
                                </div>
                              )}
                          </div>

                          {selectedMedicines.length > 0 && (
                            <div>
                              <p className="text-sm font-semibold text-headingColor">
                                Selected Medicines {selectedMedicines.length}
                              </p>

                              <div className="space-y-2">
                                {selectedMedicines.map((med) => (
                                  <div
                                    key={med.medicine_id}
                                    className="bg-gray-50 rounded-xl p-4 space-y-2"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center items-start sm:justify-between gap-3">
                                      <p className="font-semibold text-headingColor">
                                        {med.name}
                                      </p>
                                      <button
                                        onClick={() =>
                                          handleRemoveMedicine(med.medicine_id)
                                        }
                                        className="text-red-500 hover:text-red-700 transition-colors"
                                      >
                                        <svg
                                          className="w-5 h-5"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                          />
                                        </svg>
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <input
                                        type="text"
                                        placeholder="Dosage (e.g., 500mg)"
                                        value={med.dosage}
                                        onChange={(e) =>
                                          updateMedicineDetails(
                                            med.medicine_id,
                                            'dosage',
                                            e.target.value
                                          )
                                        }
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:border-purpleColor focus:ring-1 focus:ring-purpleColor/20 outline-none text-sm"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Duration (e.g., 7 days)"
                                        value={med.duration}
                                        onChange={(e) =>
                                          updateMedicineDetails(
                                            med.medicine_id,
                                            'duration',
                                            e.target.value
                                          )
                                        }
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:border-purpleColor focus:ring-1 focus:ring-purpleColor/20 outline-none text-sm"
                                      />
                                    </div>

                                    <div className="mt-2">
                                      <p className="text-xs font-semibold text-headingColor mb-2">
                                        Number of tablets to take:
                                      </p>
                                      <div className="grid grid-cols-3 gap-3">
                                        <div className="flex flex-col">
                                          <label className="text-xs text-headingColor flex items-center gap-1 mb-1">
                                            <svg
                                              className="w-3 h-3 text-yellow-500"
                                              fill="currentColor"
                                              viewBox="0 0 20 20"
                                            >
                                              <path
                                                fillRule="evenodd"
                                                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                                                clipRule="evenodd"
                                              />
                                            </svg>
                                            Morning
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={med.timing.morning}
                                            onChange={(e) =>
                                              updateMedicineTiming(
                                                med.medicine_id,
                                                'morning',
                                                e.target.value
                                              )
                                            }
                                            className="px-2 py-1.5 border border-gray-300 rounded-lg focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 outline-none text-sm placeholder-gray-400"
                                            placeholder="0"
                                          />
                                        </div>

                                        <div className="flex flex-col">
                                          <label className="text-xs text-headingColor flex items-center gap-1 mb-1">
                                            <svg
                                              className="w-3 h-3 text-orange-500"
                                              fill="currentColor"
                                              viewBox="0 0 20 20"
                                            >
                                              <path
                                                fillRule="evenodd"
                                                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                                                clipRule="evenodd"
                                              />
                                            </svg>
                                            Noon
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={med.timing.noon}
                                            onChange={(e) =>
                                              updateMedicineTiming(
                                                med.medicine_id,
                                                'noon',
                                                e.target.value
                                              )
                                            }
                                            className="px-2 py-1.5 border border-gray-300 rounded-lg focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 outline-none text-sm placeholder-gray-400"
                                            placeholder="0"
                                          />
                                        </div>

                                        <div className="flex flex-col">
                                          <label className="text-xs text-headingColor flex items-center gap-1 mb-1">
                                            <svg
                                              className="w-3 h-3 text-indigo-600"
                                              fill="currentColor"
                                              viewBox="0 0 20 20"
                                            >
                                              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                            </svg>
                                            Night
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={med.timing.night}
                                            onChange={(e) =>
                                              updateMedicineTiming(
                                                med.medicine_id,
                                                'night',
                                                e.target.value
                                              )
                                            }
                                            className="px-2 py-1.5 border border-gray-300 rounded-lg focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none text-sm placeholder-gray-400"
                                            placeholder="0"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Test Investigation Section */}
                      <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100 mb-6">
                        <h3 className="text-xl font-bold text-headingColor mb-4">
                          Prescribe Tests (Optional)
                        </h3>

                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search test (e.g. Blood, X-ray, MRI)"
                            value={testQuery}
                            onChange={(e) => setTestQuery(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primaryColor outline-none"
                          />

                          {isSearchingTests && (
                            <div className="absolute right-3 top-3 animate-spin rounded-full h-5 w-5 border-b-2 border-primaryColor"></div>
                          )}

                          {testSuggestions.length > 0 && (
                            <div className="absolute z-10 w-full bg-white border rounded-xl shadow mt-2">
                              {testSuggestions.map((test) => (
                                <div
                                  key={test._id}
                                  onClick={() => addTest(test)}
                                  className="px-4 py-3 hover:bg-gray-100 cursor-pointer"
                                >
                                  {test.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {selectedTests.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {selectedTests.map((t) => (
                              <div
                                key={t.testId}
                                className="flex flex-col sm:flex-row sm:items-center items-stretch gap-3 bg-gray-50 p-3 rounded-xl"
                              >
                                <span className="font-semibold flex-1">
                                  {t.testName}
                                </span>

                                <input
                                  type="date"
                                  value={t.showingDate}
                                  onChange={(e) =>
                                    updateTestDate(t.testId, e.target.value)
                                  }
                                  className="border px-2 py-1 rounded w-full sm:w-auto"
                                />

                                <button
                                  type="button"
                                  onClick={() => removeTest(t.testId)}
                                  className="text-red-500 font-bold"
                                >
                                  X
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Submit buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 mt-6">
                        <button
                          onClick={() => handlePrescribe(showFormId)}
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-purpleColor to-irisBlueColor text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
                        >
                          Submit Prescription
                        </button>
                        <button
                          onClick={() => setShowFormId(null)}
                          className="px-6 py-3 bg-gray-100 text-headingColor font-semibold rounded-xl hover:bg-gray-200 transition-all duration-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Slots Tab */}
            {activeTab === 'slots' && (
              <div>
                <div className="space-y-4">
                  {/* Date Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-headingColor mb-2">
                      Select Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => handleDateSelect(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-irisBlueColor focus:ring-2 focus:ring-irisBlueColor/20 outline-none transition-all"
                    />
                  </div>

                  {/* Time Selection */}
                  {selectedDate && availableTimeSlots.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-headingColor mb-2">
                        Select Time Slot
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {availableTimeSlots.map((time) => (
                          <button
                            key={time}
                            onClick={() => handleTimeSelect(time)}
                            className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                              newSlot.time === time
                                ? 'border-irisBlueColor bg-irisBlueColor text-white shadow-md'
                                : 'border-gray-200 hover:border-irisBlueColor hover:bg-irisBlueColor/10'
                            }`}
                          >
                            <div className="text-center">
                              <p className="text-sm font-bold">
                                {formatTime(time)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add Button */}
                  {newSlot.date && newSlot.time && (
                    <button
                      onClick={handleAddSlot}
                      className="w-full px-6 py-3 bg-gradient-to-r from-irisBlueColor to-primaryColor text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
                    >
                      Add Slot{' '}
                      {new Date(newSlot.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      at {formatTime(newSlot.time)}
                    </button>
                  )}
                </div>

                {/* Display Existing Slots */}
                {slots.length > 0 && (
                  <div className="mt-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                      <h4 className="text-lg font-semibold text-headingColor">
                        Your Available Slots
                      </h4>
                      <span className="text-sm text-textColor bg-primaryColor/10 px-4 py-2 rounded-full font-semibold">
                        Total {slots.length} slot{slots.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="space-y-6">
                      {groupSlotsByDate().map((group) => (
                        <div
                          key={group.date}
                          className="border-2 border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                        >
                          {/* Date Header */}
                          <div className="bg-gradient-to-r from-irisBlueColor to-primaryColor px-6 py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center items-start sm:justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                  <svg
                                    className="w-6 h-6 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <h5 className="font-bold text-white text-lg">
                                    {new Date(group.date).toLocaleDateString(
                                      'en-US',
                                      { weekday: 'long' }
                                    )}
                                  </h5>
                                  <p className="text-white/90 text-sm">
                                    {new Date(group.date).toLocaleDateString(
                                      'en-US',
                                      {
                                        month: 'long',
                                        day: 'numeric',
                                        year: 'numeric',
                                      }
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-semibold text-sm">
                                  {group.slots.length} Slot
                                  {group.slots.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Time Slots Grid */}
                          <div className="p-6 bg-gradient-to-br from-gray-50 to-white">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                              {group.slots.map((slot, idx) => (
                                <div key={idx} className="relative group">
                                  <div
                                    className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                                      slot.bookedcount && slot.bookedcount > 0
                                        ? 'bg-blue-50 border-blue-300 shadow-sm'
                                        : 'bg-white border-gray-200 hover:border-irisBlueColor hover:shadow-md'
                                    }`}
                                  >
                                    <div className="text-center">
                                      <div className="flex items-center justify-center gap-1 mb-2">
                                        <svg
                                          className={`w-4 h-4 ${
                                            slot.bookedcount &&
                                            slot.bookedcount > 0
                                              ? 'text-blue-600'
                                              : 'text-primaryColor'
                                          }`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                          />
                                        </svg>
                                      </div>
                                      <p className="text-base font-bold text-headingColor">
                                        {formatTime(slot.time)}
                                      </p>
                                    </div>

                                    {slot.bookedcount && slot.bookedcount > 0 ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-center gap-1">
                                          <svg
                                            className="w-3 h-3 text-blue-600"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                          </svg>
                                          <span className="text-xs font-semibold text-blue-700">
                                            {slot.bookedcount} Patient
                                            {slot.bookedcount !== 1 ? 's' : ''}
                                          </span>
                                        </div>
                                        <div className="flex justify-center gap-0.5">
                                          {Array(4)
                                            .fill()
                                            .map((_, i) => (
                                              <div
                                                key={i}
                                                className={`w-1.5 h-1.5 rounded-full ${
                                                  i < slot.bookedcount
                                                    ? 'bg-blue-600'
                                                    : 'bg-gray-300'
                                                }`}
                                              />
                                            ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full mt-2">
                                        Available
                                      </span>
                                    )}
                                  </div>

                                  <button
                                    onClick={() =>
                                      handleDeleteSlot(slot.date, slot.time)
                                    }
                                    className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-red-600 hover:scale-110 shadow-lg"
                                    title="Delete slot"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Treated Patients Tab */}
            {activeTab === 'treated' && (
              <div>
                {treatedPatients.length === 0 ? (
                  <div className="text-center py-12">
                    <svg
                      className="w-16 h-16 text-gray-300 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h3 className="text-xl font-semibold text-headingColor mb-2">
                      No Treated Patients Yet
                    </h3>
                    <p className="text-textColor">
                      Patients you've treated will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {treatedPatients.map((patient) => (
                      <div
                        key={patient.patient_id}
                        className="border-2 border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300 cursor-pointer"
                        onClick={() => fetchPatientHistory(patient.patient_id)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                          <div className="flex flex-col sm:flex-row sm:items-center items-start gap-4">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primaryColor to-yellowColor flex items-center justify-center text-white font-bold text-xl">
                              {patient.patient_name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-headingColor">
                                {patient.patient_name}
                              </h3>
                              <p className="text-sm text-textColor">
                                {patient.patient_email}
                              </p>
                              <p className="text-sm text-textColor">
                                {patient.patient_phone}
                              </p>
                            </div>
                          </div>
                          <div>
                            <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-semibold mb-2">
                              {patient.total_visits} Visit
                              {patient.total_visits !== 1 ? 's' : ''}
                            </div>
                            <button className="text-primaryColor hover:text-irisBlueColor font-semibold text-sm flex items-center gap-1">
                              View History
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Patient History */}
                        {selectedPatient === patient.patient_id &&
                          patientHistory.length > 0 && (
                            <div className="mt-4 pt-4 border-t-2 border-gray-200 space-y-3">
                              <h4 className="font-semibold text-headingColor mb-3">
                                Treatment History
                              </h4>
                              {patientHistory.map((appt, idx) => (
                                <div
                                  key={appt._id}
                                  className="bg-gray-50 rounded-lg p-4"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="font-semibold text-headingColor">
                                      Visit {patientHistory.length - idx}
                                    </p>
                                    <p className="text-sm text-textColor">
                                      {appt.date} at {formatTime(appt.time)}
                                    </p>
                                  </div>

                                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                                    Treated
                                  </span>

                                  {appt.prescription_id && (
                                    <div className="mt-3 space-y-2">
                                      <p className="text-sm font-semibold text-headingColor">
                                        Notes
                                      </p>
                                      <p className="text-sm text-textColor bg-white p-3 rounded-lg">
                                        {appt.prescription_id.notes ||
                                          'No notes provided'}
                                      </p>

                                      <p className="text-sm font-semibold text-headingColor mt-3">
                                        Prescribed Medicines
                                      </p>
                                      <div className="space-y-1">
                                        {appt.prescription_id.medicines &&
                                        appt.prescription_id.medicines.length >
                                          0 ? (
                                          appt.prescription_id.medicines.map(
                                            (med, medIdx) => (
                                              <div
                                                key={medIdx}
                                                className="bg-white p-3 rounded-lg"
                                              >
                                                <p className="font-semibold text-sm text-headingColor">
                                                  {med.medicine_id?.drugName}
                                                </p>
                                                <div className="flex gap-4 mt-1">
                                                  {med.dosage && (
                                                    <span className="text-xs text-textColor">
                                                      <strong>Dosage:</strong>
                                                      {med.dosage}
                                                    </span>
                                                  )}
                                                  {med.duration && (
                                                    <span className="text-xs text-textColor">
                                                      <strong>Duration:</strong>
                                                      {med.duration}
                                                    </span>
                                                  )}
                                                </div>

                                                {med.timing &&
                                                  (med.timing.morning !== 0 ||
                                                    med.timing.noon !== 0 ||
                                                    med.timing.night !== 0) && (
                                                    <div className="flex gap-2 mt-2">
                                                      {med.timing.morning !==
                                                        0 && (
                                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full flex items-center gap-1 font-medium">
                                                          <svg
                                                            className="w-3 h-3"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                          >
                                                            <path
                                                              fillRule="evenodd"
                                                              d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                                                              clipRule="evenodd"
                                                            />
                                                          </svg>
                                                          Morning {med.timing.morning}{' '}
                                                          tablet
                                                          {med.timing.morning !==
                                                          1
                                                            ? 's'
                                                            : ''}
                                                        </span>
                                                      )}
                                                      {med.timing.noon !==
                                                        0 && (
                                                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full flex items-center gap-1 font-medium">
                                                          <svg
                                                            className="w-3 h-3"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                          >
                                                            <path
                                                              fillRule="evenodd"
                                                              d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                                                              clipRule="evenodd"
                                                            />
                                                          </svg>
                                                          Noon {med.timing.noon}{' '}
                                                          tablet
                                                          {med.timing.noon !== 1
                                                            ? 's'
                                                            : ''}
                                                        </span>
                                                      )}
                                                      {med.timing.night !==
                                                        0 && (
                                                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full flex items-center gap-1 font-medium">
                                                          <svg
                                                            className="w-3 h-3"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                          >
                                                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                                          </svg>
                                                          Night {med.timing.night}{' '}
                                                          tablet
                                                          {med.timing.night !== 1
                                                            ? 's'
                                                            : ''}
                                                        </span>
                                                      )}
                                                    </div>
                                                  )}
                                              </div>
                                            )
                                          )
                                        ) : (
                                          <p>None</p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;