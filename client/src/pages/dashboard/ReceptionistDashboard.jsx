import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/api";

const ReceptionistDashboard = () => {
  const [activeTab, setActiveTab] = useState("cabin"); // 'cabin' | 'icu' | 'ot'
  const [beds, setBeds] = useState({ cabin: [], icu: [], ot: [] });
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [selectedBed, setSelectedBed] = useState(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientInfo, setPatientInfo] = useState(null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [checkInDate, setCheckInDate] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");

  // ===== Added schedule state (like NurseDashboard) ===== [file:250]
  const [profile, setProfile] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [scheduleError, setScheduleError] = useState("");

  const token = localStorage.getItem("token");
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // ===== Load beds for current tab (existing) =====
  const fetchBeds = async () => {
    setLoadingBeds(true);
    try {
      const res = await api.get(`/api/reception/beds?type=${activeTab}`, { headers });
      setBeds((prev) => ({ ...prev, [activeTab]: res.data }));
    } catch (err) {
      console.error("Failed to load beds:", err);
    } finally {
      setLoadingBeds(false);
    }
  };

  useEffect(() => {
    fetchBeds();
    // reset selection when switching tab
    setSelectedBed(null);
    setPatientInfo(null);
    setPatientQuery("");
    setCheckInDate("");
    setBookingError("");
    setBookingSuccess("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ===== Added: fetch profile + schedule (like NurseDashboard) ===== [file:250]
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!token) {
        setScheduleError("Not authenticated.");
        setLoadingSchedule(false);
        return;
      }

      try {
        setLoadingSchedule(true);
        setScheduleError("");

        const profileRes = await api.get("/api/users/profile", { headers });
        setProfile(profileRes.data);

        const scheduleRes = await api.get("/api/staff/my-schedule", { headers });
        setSchedules(scheduleRes.data || []);
      } catch (err) {
        setScheduleError(err?.response?.data?.message || err.message || "Failed to load.");
      } finally {
        setLoadingSchedule(false);
      }
    };

    fetchSchedule();
  }, [token, headers]);

  // Uses the same shift time ranges your NurseDashboard uses [file:250]
  const getShiftInfo = (shiftType) => {
    const shifts = {
      morning: { label: "Morning", time: "08:00 - 14:00" },
      evening: { label: "Evening", time: "14:00 - 20:00" },
      night: { label: "Night", time: "20:00 - 08:00" },
    };
    return shifts[shiftType] || { label: "Unknown", time: "N/A" };
  };

  const formatFullDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Fetch patient by email or user id (existing)
  const handleFetchPatient = async () => {
    if (!patientQuery) return;
    setLoadingPatient(true);
    setPatientInfo(null);
    setBookingError("");
    try {
      const res = await api.get("/api/reception/patient-lookup", {
        params: { query: patientQuery },
        headers,
      });
      setPatientInfo(res.data);
    } catch (err) {
      console.error("Patient lookup failed:", err);
      setBookingError(err.response?.data?.message || "Patient not found");
    } finally {
      setLoadingPatient(false);
    }
  };

  // Book reservation (existing)
  const handleBook = async () => {
    if (!selectedBed || !patientInfo || !checkInDate) {
      setBookingError("Please select a bed, fetch patient, and choose check-in date.");
      return;
    }
    setBookingError("");
    setBookingSuccess("");
    try {
      await api.post(
        "/api/reception/reservations",
        {
          bed_id: selectedBed._id,
          patient_id: patientInfo._id,
          check_in_date: checkInDate,
          type: activeTab,
        },
        { headers }
      );
      setBookingSuccess("Reservation created successfully.");
      setSelectedBed(null);
      setPatientInfo(null);
      setPatientQuery("");
      setCheckInDate("");
      fetchBeds();
    } catch (err) {
      console.error("Booking failed:", err);
      setBookingError(err.response?.data?.message || "Failed to create reservation.");
    }
  };

  // Checkout reservation (existing)
  const handleCheckout = async (reservationId) => {
    try {
      await api.post(`/api/reception/reservations/${reservationId}/checkout`, {}, { headers });
      fetchBeds();
    } catch (err) {
      console.error("Checkout failed:", err);
    }
  };

  const currentBeds = beds[activeTab] || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* ===== Added Schedule Section (ONLY ADDITION) ===== */}
      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <h3 className="text-xl font-bold mb-2">My Schedule</h3>
        <p className="text-sm text-gray-600 mb-4">Your profile and assigned shifts.</p>

        {loadingSchedule ? (
          <p className="text-sm text-gray-600">Loading...</p>
        ) : scheduleError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-red-700">Error</p>
            <p className="text-sm text-red-700 mt-1">{scheduleError}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Name</p>
                <p className="font-semibold">{profile?.name || "N/A"}</p>
                <p className="text-sm text-gray-600">{profile?.email || "N/A"}</p>
              </div>

              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Phone</p>
                <p className="font-semibold">{profile?.phone || "N/A"}</p>
                <p className="text-sm text-gray-600">
                  Staff category: {profile?.staffcategory || "receptionist"}
                </p>
              </div>
            </div>

            {schedules.length === 0 ? (
              <p className="text-sm text-gray-600">No shifts assigned yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {schedules.map((s) => {
                  const shift = getShiftInfo(s.shift_type);
                  const staffObj = s.staff_id && typeof s.staff_id === "object" ? s.staff_id : null;

                  return (
                    <div key={s._id} className="border rounded-lg p-4 bg-white">
                      <p className="font-semibold mb-2">{shift.label} shift</p>
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Date:</span> {formatFullDate(s.date)}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Time:</span> {shift.time}
                      </p>

                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Staff:</span>{" "}
                          {staffObj?.name || profile?.name || "N/A"}
                        </p>
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Phone:</span>{" "}
                          {staffObj?.phone || profile?.phone || "N/A"}
                        </p>
                        <p className="text-sm text-gray-700 break-all">
                          <span className="font-semibold">Email:</span>{" "}
                          {staffObj?.email || profile?.email || "N/A"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== Reservation section (UNCHANGED) ===== */}
      <h2 className="text-2xl font-bold mb-4">Manage reservations</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {["cabin", "icu", "ot"].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded ${
              activeTab === t ? "bg-blue-600 text-white" : "bg-white border"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Beds list */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Beds</h3>

          {loadingBeds ? (
            <p className="text-gray-600 text-sm">Loading...</p>
          ) : currentBeds.length === 0 ? (
            <p className="text-gray-600 text-sm">No beds found for this category.</p>
          ) : (
            <div className="space-y-2">
              {currentBeds.map((bed) => (
                <button
                  key={bed._id}
                  onClick={() => setSelectedBed(bed)}
                  className={`w-full text-left border rounded p-3 ${
                    selectedBed?._id === bed._id ? "border-blue-600" : "border-gray-200"
                  }`}
                >
                  <div className="font-semibold">{bed.code}</div>
                  <div className="text-sm text-gray-600">
                    {bed.type}
                    {bed.current_reservation && (
                      <div className="mt-1">
                        {bed.current_reservation.patient_name} • Check-in:{" "}
                        {new Date(bed.current_reservation.check_in_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {bed.current_reservation && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCheckout(bed.current_reservation._id);
                      }}
                      className="mt-2 w-full bg-red-600 text-white px-3 py-2 rounded"
                    >
                      Checkout
                    </button>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Booking panel */}
        <div className="bg-white border rounded-lg p-4 lg:col-span-2">
          {selectedBed ? (
            <div>
              <h3 className="font-semibold mb-3">Create reservation</h3>

              <div className="border rounded p-3 mb-4">
                <div className="font-semibold">
                  Bed: {selectedBed.code} ({activeTab.toUpperCase()})
                </div>
                <div className="text-sm text-gray-600">Type: {selectedBed.type || "N/A"}</div>
              </div>

              <div className="flex gap-2 mb-3">
                <input
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Patient email or user id"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                />
                <button
                  onClick={handleFetchPatient}
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  {loadingPatient ? "Loading..." : "Fetch"}
                </button>
              </div>

              {patientInfo && (
                <div className="border rounded p-3 mb-3">
                  <div className="font-semibold">{patientInfo.name}</div>
                  <div className="text-sm text-gray-600">{patientInfo.email}</div>
                  <div className="text-sm text-gray-600">
                    {patientInfo.phone} {patientInfo.location && `• ${patientInfo.location}`}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <input
                  type="date"
                  className="border rounded px-3 py-2"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                />
                <button onClick={handleBook} className="bg-green-600 text-white px-4 py-2 rounded">
                  Book
                </button>
              </div>

              {bookingError && <p className="text-red-600 text-sm">{bookingError}</p>}
              {bookingSuccess && <p className="text-green-600 text-sm">{bookingSuccess}</p>}
            </div>
          ) : (
            <p className="text-gray-600">
              Select an available bed from the list on the left to create a reservation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceptionistDashboard;
