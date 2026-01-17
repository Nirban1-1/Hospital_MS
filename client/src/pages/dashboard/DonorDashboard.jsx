import React, { useEffect, useState } from "react";
import api from "../../api/api";

const DonorDashboard = () => {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  // Incoming requests (requested + accepted for me)
  const [bloodRequests, setBloodRequests] = useState([]);

  // Completed donations history (with info)
  const [donationHistoryInfo, setDonationHistoryInfo] = useState([]);

  const token = localStorage.getItem("token");

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const formatDateTime = (d) => {
    if (!d) return "N/A";
    try {
      return new Date(d).toLocaleString();
    } catch {
      return String(d);
    }
  };

  const genderLabel = (g) => {
    if (!g) return "N/A";
    const v = String(g).toLowerCase();
    if (v === "male") return "Male";
    if (v === "female") return "Female";
    if (v === "other") return "Other";
    return g;
  };

  const fetchDashboard = async () => {
    try {
      const res = await api.get("/api/donor/dashboard", { headers });
      setAvailable(res.data.available);
    } catch (err) {
      console.error("Failed to load donor dashboard:", err);
    }
  };

  const fetchRequests = async () => {
    try {
      // Donors endpoint from bloodRoutes.js: GET /api/blood/requests [file:248]
      const res = await api.get("/api/blood/requests", { headers });
      setBloodRequests(res.data || []);
    } catch (err) {
      console.error("Failed to load blood requests:", err);
    }
  };

  const fetchDonationHistory = async () => {
    try {
      // New route you will add: GET /api/blood/history
      const res = await api.get("/api/blood/history", { headers });
      setDonationHistoryInfo(res.data || []);
    } catch (err) {
      console.error("Failed to load donation history:", err);
      setDonationHistoryInfo([]);
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchRequests(), fetchDonationHistory()]);
      setLoading(false);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = async () => {
    await Promise.all([fetchDashboard(), fetchRequests(), fetchDonationHistory()]);
  };

  const toggleAvailability = async () => {
    try {
      const res = await api.patch("/api/donor/availability", {}, { headers });
      setAvailable(res.data.available);
    } catch (err) {
      console.error("Failed to update availability:", err);
      alert(err?.response?.data?.message || "Failed to update availability");
    }
  };

  const acceptRequest = async (id) => {
    try {
      // Donors accept endpoint: PATCH /api/blood/accept/:id [file:248]
      await api.patch(`/api/blood/accept/${id}`, {}, { headers });
      alert("Request accepted successfully.");
      await refreshAll();
    } catch (err) {
      console.error("Failed to accept request:", err);
      alert(err?.response?.data?.message || "Failed to accept request");
    }
  };

  const completeDonation = async (id) => {
    try {
      // Controller route: PATCH /api/blood/complete/:id [file:249]
      await api.patch(`/api/blood/complete/${id}`, {}, { headers });
      alert("Marked as completed.");
      await refreshAll();
    } catch (err) {
      console.error("Failed to complete donation:", err);
      alert(err?.response?.data?.message || "Failed to complete donation");
    }
  };

  // getPendingRequests adds current_user_id in response [file:249]
  const isMine = (req) => String(req?.donor_id || "") === String(req?.current_user_id || "");

  return (
    <div className="container">
      <h2 className="heading mt-[30px]">Blood Donor Dashboard</h2>

      {loading ? (
        <p className="text_para mt-5">Loading...</p>
      ) : (
        <>
          {/* Availability */}
          <div className="my-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-semibold text-lg">Availability</h3>
              <button
                onClick={refreshAll}
                className="px-4 py-2 rounded font-semibold border border-gray-200 bg-white"
              >
                Refresh
              </button>
            </div>

            <button
              onClick={toggleAvailability}
              className={`mt-3 px-4 py-2 rounded font-semibold ${
                available ? "bg-green-600 text-white" : "bg-gray-400 text-white"
              }`}
            >
              {available ? "Active - Available to Donate" : "Inactive - Not Available"}
            </button>
          </div>

          {/* Incoming Blood Requests */}
          <div className="my-6">
            <h3 className="font-semibold text-lg mb-2">Incoming Blood Requests</h3>

            {bloodRequests.length === 0 ? (
              <p>No requests at this time.</p>
            ) : (
              <ul className="space-y-3">
                {bloodRequests.map((req) => {
                  const name = req.name || req.patient_id?.name || "Unknown";
                  const phone = req.phone || req.patient_id?.phone || "N/A";
                  const email = req.email || req.patient_id?.email || "N/A";

                  return (
                    <li key={req._id} className="border p-5 rounded-xl shadow bg-white">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-lg font-bold text-headingColor">{name}</h4>

                          <div className="mt-1 text-sm text-textColor flex flex-wrap gap-x-3 gap-y-1">
                            <span>
                              <span className="font-semibold">Blood Group:</span>{" "}
                              {req.blood_group || "N/A"}
                            </span>
                            <span>
                              <span className="font-semibold">Age:</span> {req.age ?? "N/A"}
                            </span>
                            <span>
                              <span className="font-semibold">Gender:</span>{" "}
                              {genderLabel(req.gender)}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            req.status === "requested"
                              ? "bg-yellow-100 text-yellow-700"
                              : req.status === "accepted"
                              ? "bg-green-100 text-green-700"
                              : req.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {req.status || "N/A"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded-lg border bg-slate-50">
                          <p className="font-semibold mb-2 text-headingColor">Contact</p>
                          <p>
                            <span className="font-semibold">Phone:</span> {phone}
                          </p>
                          <p className="break-all">
                            <span className="font-semibold">Email:</span> {email}
                          </p>
                        </div>

                        <div className="p-3 rounded-lg border bg-slate-50">
                          <p className="font-semibold mb-2 text-headingColor">Timing</p>
                          <p>
                            <span className="font-semibold">Requested:</span>{" "}
                            {formatDateTime(req.requested_at)}
                          </p>
                          <p>
                            <span className="font-semibold">Accepted:</span>{" "}
                            {formatDateTime(req.accepted_at)}
                          </p>
                          <p>
                            <span className="font-semibold">Completed:</span>{" "}
                            {formatDateTime(req.completed_at)}
                          </p>
                        </div>
                      </div>

                      {req.note ? (
                        <div className="mt-3 p-3 rounded-lg border bg-blue-50">
                          <p className="font-semibold text-headingColor mb-1">Note</p>
                          <p className="text-sm text-textColor">{req.note}</p>
                        </div>
                      ) : null}

                      {/* Actions */}
                      {req.status === "requested" && (
                        <button
                          onClick={() => acceptRequest(req._id)}
                          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold"
                        >
                          Accept Request
                        </button>
                      )}

                      {req.status === "accepted" && isMine(req) && (
                        <button
                          onClick={() => completeDonation(req._id)}
                          className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold"
                        >
                          Mark as Completed
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Donation History (Completed) */}
          <div className="my-6">
            <h3 className="font-semibold text-lg mb-2">Donation History</h3>

            {donationHistoryInfo.length === 0 ? (
              <p>No completed donations yet.</p>
            ) : (
              <ul className="space-y-3">
                {donationHistoryInfo.map((d) => {
                  const name = d.name || d.patient_id?.name || "Unknown";
                  const phone = d.phone || d.patient_id?.phone || "N/A";
                  const email = d.email || d.patient_id?.email || "N/A";

                  return (
                    <li key={d.id || d._id} className="border p-5 rounded-xl shadow bg-white">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-lg font-bold text-headingColor">{name}</h4>
                          <div className="mt-1 text-sm text-textColor flex flex-wrap gap-x-3 gap-y-1">
                            <span>
                              <span className="font-semibold">Blood Group:</span>{" "}
                              {d.blood_group || "N/A"}
                            </span>
                            <span>
                              <span className="font-semibold">Age:</span> {d.age ?? "N/A"}
                            </span>
                            <span>
                              <span className="font-semibold">Gender:</span>{" "}
                              {genderLabel(d.gender)}
                            </span>
                          </div>
                        </div>

                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                          completed
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded-lg border bg-slate-50">
                          <p className="font-semibold mb-2 text-headingColor">Contact</p>
                          <p>
                            <span className="font-semibold">Phone:</span> {phone}
                          </p>
                          <p className="break-all">
                            <span className="font-semibold">Email:</span> {email}
                          </p>
                        </div>

                        <div className="p-3 rounded-lg border bg-slate-50">
                          <p className="font-semibold mb-2 text-headingColor">Timing</p>
                          <p>
                            <span className="font-semibold">Requested:</span>{" "}
                            {formatDateTime(d.requested_at)}
                          </p>
                          <p>
                            <span className="font-semibold">Accepted:</span>{" "}
                            {formatDateTime(d.accepted_at)}
                          </p>
                          <p>
                            <span className="font-semibold">Completed:</span>{" "}
                            {formatDateTime(d.completed_at)}
                          </p>
                        </div>
                      </div>

                      {d.note ? (
                        <div className="mt-3 p-3 rounded-lg border bg-blue-50">
                          <p className="font-semibold text-headingColor mb-1">Note</p>
                          <p className="text-sm text-textColor">{d.note}</p>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DonorDashboard;
