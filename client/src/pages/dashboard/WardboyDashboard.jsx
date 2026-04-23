import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/api";

const WardboyDashboard = () => {
  const token = localStorage.getItem("token");

  const [profile, setProfile] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    const fetchAll = async () => {
      if (!token) {
        setError("Not authenticated.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const profileRes = await api.get("/api/users/profile", { headers });
        setProfile(profileRes.data);

        const scheduleRes = await api.get("/api/staff/my-schedule", { headers });
        setSchedules(scheduleRes.data || []);
      } catch (err) {
        setError(err?.response?.data?.message || err.message || "Failed to load.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [token, headers]);

  // Same time ranges used in AdminDashboard
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-primaryColor5 via-white to-irisBlueColor5 py-5 sm:py-8 px-3 sm:px-4">
      <div className="mx-auto w-full max-w-5xl space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100">
          <h2 className="text-2xl sm:text-3xl font-bold text-headingColor">
            Wardboy Dashboard
          </h2>
          <p className="text-sm sm:text-base text-textColor mt-1">
            Your profile and assigned shifts.
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow p-4 sm:p-6 border border-gray-100">
            <p className="text-textColor text-sm sm:text-base">Loading...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-6">
            <p className="text-red-700 font-semibold">Error</p>
            <p className="text-red-700 text-sm mt-1 break-words">{error}</p>
          </div>
        ) : (
          <>
            {/* Personal info */}
            <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100">
              <h3 className="text-lg sm:text-xl font-bold text-headingColor mb-3 sm:mb-4">
                Personal info
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                <div className="min-w-0">
                  <p className="text-textColor70 font-semibold uppercase text-xs">
                    Name
                  </p>
                  <p className="text-headingColor font-medium break-words">
                    {profile?.name || "N/A"}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-textColor70 font-semibold uppercase text-xs">
                    Email
                  </p>
                  <p className="text-headingColor font-medium break-all">
                    {profile?.email || "N/A"}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-textColor70 font-semibold uppercase text-xs">
                    Phone
                  </p>
                  <p className="text-headingColor font-medium break-words">
                    {profile?.phone || "N/A"}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-textColor70 font-semibold uppercase text-xs">
                    Staff category
                  </p>
                  <p className="text-headingColor font-medium break-words">
                    {profile?.staffcategory || "wardboy"}
                  </p>
                </div>
              </div>
            </div>

            {/* My schedule */}
            <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-headingColor">
                  My schedule
                </h3>
                <span className="w-fit text-xs font-semibold px-3 py-1 rounded-full bg-primaryColor10 text-primaryColor">
                  {schedules.length} shifts
                </span>
              </div>

              {schedules.length === 0 ? (
                <p className="text-textColor text-sm sm:text-base">
                  No shifts assigned yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {schedules.map((s) => {
                    // Backend may populate one of these; handle both safely
                    const staffObj = s.staff_id || s.staffid;
                    const shiftType = s.shift_type || s.shifttype;

                    const shift = getShiftInfo(shiftType);

                    return (
                      <div
                        key={s._id || s.id}
                        className="border border-gray-200 rounded-xl p-4"
                      >
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-headingColor font-semibold">
                              {shift.label} shift
                            </p>
                            <p className="text-textColor text-sm break-words">
                              <span className="font-semibold text-headingColor">
                                Date:
                              </span>{" "}
                              {formatFullDate(s.date)}
                            </p>
                            <p className="text-textColor text-sm break-words">
                              <span className="font-semibold text-headingColor">
                                Time:
                              </span>{" "}
                              {shift.time}
                            </p>
                          </div>

                          <div className="min-w-0 text-sm text-textColor">
                            <p className="break-words">
                              Staff:{" "}
                              <span className="font-semibold text-headingColor">
                                {staffObj?.name || profile?.name || "N/A"}
                              </span>
                            </p>
                            <p className="break-words">
                              Phone: {staffObj?.phone || profile?.phone || "N/A"}
                            </p>
                            <p className="break-all">
                              Email: {staffObj?.email || profile?.email || "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WardboyDashboard;
