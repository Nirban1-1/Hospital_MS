import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/api";

const WardboyDashboard = () => {
  const token = localStorage.getItem("token");

  const [profile, setProfile] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

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
    <div className="min-h-screen bg-gradient-to-br from-primaryColor5 via-white to-irisBlueColor5 py-8 px-4">
      <div className="container max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-3xl font-bold text-headingColor">Wardboy Dashboard</h2>
          <p className="text-textColor mt-1">Your profile and assigned shifts.</p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
            <p className="text-textColor">Loading...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <p className="text-red-700 font-semibold">Error</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        ) : (
          <>
            {/* Personal info */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="text-xl font-bold text-headingColor mb-4">Personal info</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-textColor70 font-semibold uppercase text-xs">Name</p>
                  <p className="text-headingColor font-medium">{profile?.name || "N/A"}</p>
                </div>

                <div>
                  <p className="text-textColor70 font-semibold uppercase text-xs">Email</p>
                  <p className="text-headingColor font-medium">{profile?.email || "N/A"}</p>
                </div>

                <div>
                  <p className="text-textColor70 font-semibold uppercase text-xs">Phone</p>
                  <p className="text-headingColor font-medium">{profile?.phone || "N/A"}</p>
                </div>

                <div>
                  <p className="text-textColor70 font-semibold uppercase text-xs">Staff category</p>
                  <p className="text-headingColor font-medium">
                    {profile?.staffcategory || "wardboy"}
                  </p>
                </div>
              </div>
            </div>

            {/* My schedule */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-xl font-bold text-headingColor">My schedule</h3>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primaryColor10 text-primaryColor">
                  {schedules.length} shifts
                </span>
              </div>

              {schedules.length === 0 ? (
                <p className="text-textColor">No shifts assigned yet.</p>
              ) : (
                <div className="space-y-3">
                  {schedules.map((s) => {
                    // If your backend populates staff, it will be here (common pattern)
                    // NOTE: some parts of your backend use "staffid" / "shifttype" (Admin side) [file:146]
                    // If your /api/staff/my-schedule uses staff_id/shift_type, keep these lines.
                    const staffObj = s.staff_id || s.staffid;
                    const shiftType = s.shift_type || s.shifttype;

                    const shift = getShiftInfo(shiftType);

                    return (
                      <div key={s._id || s.id} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div>
                            <p className="text-headingColor font-semibold">
                              {shift.label} shift
                            </p>
                            <p className="text-textColor text-sm">
                              Date: {formatFullDate(s.date)}
                            </p>
                            <p className="text-textColor text-sm">
                              Time: {shift.time}
                            </p>
                          </div>

                          <div className="text-sm text-textColor">
                            <p>
                              Staff:{" "}
                              <span className="font-semibold text-headingColor">
                                {staffObj?.name || profile?.name || "N/A"}
                              </span>
                            </p>
                            <p>Phone: {staffObj?.phone || profile?.phone || "N/A"}</p>
                            <p>Email: {staffObj?.email || profile?.email || "N/A"}</p>
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
