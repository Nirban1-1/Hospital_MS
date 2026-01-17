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

  // ===== Schedule state =====
  const [profile, setProfile] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [scheduleError, setScheduleError] = useState("");

  const token = localStorage.getItem("token");
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // ===== Load beds for current tab =====
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

  // ===== Fetch profile + schedule =====
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

  // Fetch patient by email or user id
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

  // Book reservation
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

  // Checkout reservation
  const handleCheckout = async (reservationId) => {
    try {
      await api.post(`/api/reception/reservations/${reservationId}/checkout`, {}, { headers });
      fetchBeds();
      // if the selected bed was checked out, clear selection to avoid stale UI
      if (selectedBed?.current_reservation?._id === reservationId) {
        setSelectedBed(null);
      }
    } catch (err) {
      console.error("Checkout failed:", err);
    }
  };

  const currentBeds = beds[activeTab] || [];

  return (
    <div className="min-h-screen bg-gray-50 px-3 sm:px-6 py-4 sm:py-6">
      <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">
        {/* ===== Schedule Section ===== */}
        <div className="bg-white rounded-2xl shadow p-4 sm:p-6 border border-gray-100">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold">My Schedule</h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Your profile and assigned shifts.
              </p>
            </div>
          </div>

          <div className="mt-4">
            {loadingSchedule ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : scheduleError ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-red-700">Error</p>
                <p className="text-sm text-red-700 mt-1">{scheduleError}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5">
                  <div className="border rounded-xl p-4 bg-gray-50">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1">
                      Name
                    </p>
                    <p className="font-semibold break-words">{profile?.name || "N/A"}</p>
                    <p className="text-sm text-gray-600 break-all">{profile?.email || "N/A"}</p>
                  </div>

                  <div className="border rounded-xl p-4 bg-gray-50">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1">
                      Phone
                    </p>
                    <p className="font-semibold break-words">{profile?.phone || "N/A"}</p>
                    <p className="text-sm text-gray-600">
                      Staff category: {profile?.staffcategory || "receptionist"}
                    </p>
                  </div>
                </div>

                {schedules.length === 0 ? (
                  <p className="text-sm text-gray-600">No shifts assigned yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {schedules.map((s) => {
                      const shift = getShiftInfo(s.shift_type);
                      const staffObj =
                        s.staff_id && typeof s.staff_id === "object" ? s.staff_id : null;

                      return (
                        <div key={s._id} className="border rounded-xl p-4 bg-white">
                          <p className="font-semibold mb-2">{shift.label} shift</p>
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold">Date:</span>{" "}
                            {formatFullDate(s.date)}
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
        </div>

        {/* ===== Reservation section ===== */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold">Manage reservations</h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Select a category, choose a bed, then book a patient.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {["cabin", "icu", "ot"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === t
                  ? "bg-blue-600 text-white shadow"
                  : "bg-white border border-gray-200 hover:border-blue-300"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Beds list */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-semibold">Beds</h3>
              <span className="text-xs text-gray-500">
                {loadingBeds ? "Loading..." : `${currentBeds.length} found`}
              </span>
            </div>

            {loadingBeds ? (
              <p className="text-gray-600 text-sm">Loading...</p>
            ) : currentBeds.length === 0 ? (
              <p className="text-gray-600 text-sm">No beds found for this category.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                {currentBeds.map((bed) => {
                  const isSelected = selectedBed?._id === bed._id;
                  const hasReservation = Boolean(bed.current_reservation);

                  return (
                    <div
                      key={bed._id}
                      className={`border rounded-xl p-3 transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 hover:border-blue-300 bg-white"
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedBed(bed)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setSelectedBed(bed);
                        }}
                        className="cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold break-words">{bed.code}</div>
                            <div className="text-sm text-gray-600 break-words">
                              {bed.type || "N/A"}
                            </div>
                          </div>

                          <span
                            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              hasReservation
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {hasReservation ? "Occupied" : "Available"}
                          </span>
                        </div>

                        {hasReservation && (
                          <div className="mt-2 text-sm text-gray-700">
                            <div className="break-words">
                              {bed.current_reservation.patient_name}
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">
                              Check-in:{" "}
                              {new Date(bed.current_reservation.check_in_date).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>

                      {hasReservation && (
                        <button
                          onClick={() => handleCheckout(bed.current_reservation._id)}
                          className="mt-3 w-full bg-red-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
                        >
                          Checkout
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Booking panel */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-sm lg:col-span-2">
            {selectedBed ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Create reservation</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Fill patient info and check-in date to confirm booking.
                  </p>
                </div>

                <div className="border rounded-xl p-4 bg-gray-50">
                  <div className="font-semibold break-words">
                    Bed: {selectedBed.code} ({activeTab.toUpperCase()})
                  </div>
                  <div className="text-sm text-gray-600">Type: {selectedBed.type || "N/A"}</div>
                </div>

                {/* Patient lookup */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <input
                    className="border border-gray-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Patient email or user id"
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                  />
                  <button
                    onClick={handleFetchPatient}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                    disabled={!patientQuery || loadingPatient}
                  >
                    {loadingPatient ? "Loading..." : "Fetch"}
                  </button>
                </div>

                {patientInfo && (
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="font-semibold break-words">{patientInfo.name}</div>
                    <div className="text-sm text-gray-600 break-all">{patientInfo.email}</div>
                    <div className="text-sm text-gray-600 break-words">
                      {patientInfo.phone}{" "}
                      {patientInfo.location ? `• ${patientInfo.location}` : ""}
                    </div>
                  </div>
                )}

                {/* Check-in + book */}
                <div className="grid grid-cols-1 sm:grid-cols-[auto_auto] gap-2 sm:justify-start">
                  <input
                    type="date"
                    className="border border-gray-200 rounded-xl px-3 py-2 w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-green-200"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                  />
                  <button
                    onClick={handleBook}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-green-700 transition-colors"
                    disabled={!selectedBed || !patientInfo || !checkInDate}
                  >
                    Book
                  </button>
                </div>

                {bookingError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-red-700 text-sm font-semibold">Booking failed</p>
                    <p className="text-red-700 text-sm mt-1">{bookingError}</p>
                  </div>
                )}

                {bookingSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-green-700 text-sm font-semibold">Success</p>
                    <p className="text-green-700 text-sm mt-1">{bookingSuccess}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-600 text-sm">
                Select a bed from the list to create a reservation.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceptionistDashboard;
