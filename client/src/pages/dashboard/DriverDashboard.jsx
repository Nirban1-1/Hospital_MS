import React, { useEffect, useState } from 'react';
import api from '../../api/api';

const DriverDashboard = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [assignedRequests, setAssignedRequests] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/api/driver/dashboard', { headers });
        setPendingRequests(res.data.pending_requests);
        setAssignedRequests(res.data.assigned_requests);
        setCompletedCount(res.data.completed_requests);
      } catch (err) {
        console.error('Failed to load driver dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const handleAccept = async (id) => {
    try {
      await api.patch(`/api/driver/accept/${id}`, {}, { headers });
      window.location.reload();
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const handleComplete = async (id) => {
    try {
      await api.patch(`/api/driver/complete/${id}`, {}, { headers });
      window.location.reload();
    } catch (err) {
      console.error('Failed to complete request:', err);
    }
  };

  return (
    <div className="container">
      <h2 className="heading mt-[30px]">Ambulance Driver Dashboard</h2>

      {loading ? (
        <p className="text_para mt-5">Loading...</p>
      ) : (
        <>
          {/* ✅ Completed counter */}
          <div className="my-5 text_para">
            <strong>Total Completed Requests:</strong> {completedCount}
          </div>

          {/* ✅ Pending Requests Section */}
          <div className="my-6">
            <h3 className="font-semibold text-lg mb-2">Pending Ambulance Requests</h3>
            {pendingRequests.length === 0 ? (
              <p>No pending requests.</p>
            ) : (
              <ul className="space-y-3">
                {pendingRequests.map((req) => (
                  <li key={req._id} className="border p-3 rounded">
                    <p><strong>Patient:</strong> {req.patient_id?.name}</p>
                    <p><strong>Pickup:</strong> {req.pickup_location}</p>
                    <button
                      onClick={() => handleAccept(req._id)}
                      className="mt-2 px-3 py-1 bg-green-600 text-white rounded"
                    >
                      Accept
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ✅ Assigned/Completed Requests Section */}
          <div className="my-6">
            <h3 className="font-semibold text-lg mb-2">Your Assigned Requests</h3>
            {assignedRequests.length === 0 ? (
              <p>You haven't accepted any requests yet.</p>
            ) : (
              <ul className="space-y-3">
                {assignedRequests.map((req) => (
                  <li key={req._id} className="border p-3 rounded">
                    <p><strong>Patient:</strong> {req.patient_id?.name}</p>
                    <p><strong>Pickup:</strong> {req.pickup_location}</p>
                    <p><strong>Status:</strong> {req.status}</p>
                    {req.status === 'accepted' && (
                      <button
                        onClick={() => handleComplete(req._id)}
                        className="mt-2 px-3 py-1 bg-blue-600 text-white rounded"
                      >
                        Mark as Completed
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DriverDashboard;
