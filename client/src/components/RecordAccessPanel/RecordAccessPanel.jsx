import React, { useCallback, useEffect, useState } from 'react';
import api from '../../api/api';

const RecordAccessPanel = ({ role }) => {
  const [requests, setRequests] = useState([]);
  const [password, setPassword] = useState('');
  const [prescriptionId, setPrescriptionId] = useState('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

  const loadRequests = useCallback(async () => {
    if (!['patient', 'doctor'].includes(role)) return;
    try {
      const response = await api.get(`/api/record-access/requests/${role}`, { headers });
      setRequests(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load record requests');
    }
  }, [role]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  if (!['patient', 'doctor'].includes(role)) return null;

  const runAction = async (action) => {
    setError('');
    setMessage('');
    try {
      await action();
      await loadRequests();
    } catch (actionError) {
      setError(actionError.response?.data?.message || 'Record access action failed');
    }
  };

  const submitRequest = (event) => {
    event.preventDefault();
    runAction(async () => {
      const response = await api.post('/api/record-access/requests', {
        prescription_id: prescriptionId,
        reason
      }, { headers });
      setPrescriptionId('');
      setReason('');
      setMessage(response.data.message || 'Access request sent');
    });
  };

  const inspectRequest = (requestId) => runAction(async () => {
    const endpoint = role === 'patient' ? 'view' : 'decrypt';
    const response = await api.post(
      `/api/record-access/requests/${requestId}/${endpoint}`,
      { password },
      { headers }
    );
    setDetails((previous) => ({ ...previous, [requestId]: response.data }));
  });

  const decide = (requestId, decision) => runAction(async () => {
    const response = await api.post(
      `/api/record-access/requests/${requestId}/${decision}`,
      decision === 'approve' ? { password } : {},
      { headers }
    );
    setMessage(response.data.message);
  });

  return (
    <section className="mt-8 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h3 className="text-xl font-bold text-headingColor">Old Record Access</h3>
        <button type="button" onClick={loadRequests} className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {role === 'doctor' && (
        <form onSubmit={submitRequest} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 mb-6">
          <input
            value={prescriptionId}
            onChange={(event) => setPrescriptionId(event.target.value)}
            placeholder="Prescription ID"
            required
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Access reason"
            minLength={3}
            maxLength={500}
            required
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <button className="px-4 py-2 bg-primaryColor text-white font-semibold rounded-lg">Request Access</button>
        </form>
      )}

      <div className="mb-4 max-w-sm">
        <label className="block text-sm font-semibold text-headingColor mb-2">Password for cryptographic actions</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
      {message && <p className="mb-4 text-sm text-green-700">{message}</p>}

      <div className="space-y-3">
        {requests.length === 0 && <p className="text-sm text-textColor">No record access requests.</p>}
        {requests.map((request) => (
          <article key={request.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-headingColor">
                  {role === 'patient' ? request.doctor?.name || 'Doctor' : request.patient?.name || 'Patient'}
                </p>
                <p className="text-xs text-textColor break-all">Prescription: {request.prescription_id}</p>
              </div>
              <span className="text-sm font-semibold capitalize">{request.status}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {(role === 'patient' || request.status === 'approved') && (
                <button type="button" onClick={() => inspectRequest(request.id)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold">
                  {role === 'patient' ? 'View Request' : 'Decrypt Record'}
                </button>
              )}
              {role === 'patient' && request.status === 'pending' && (
                <>
                  <button type="button" onClick={() => decide(request.id, 'approve')} className="px-3 py-2 bg-primaryColor text-white rounded-lg text-sm font-semibold">Approve</button>
                  <button type="button" onClick={() => decide(request.id, 'reject')} className="px-3 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-semibold">Reject</button>
                </>
              )}
            </div>
            {details[request.id] && (
              <pre className="mt-3 p-3 bg-gray-950 text-gray-100 rounded-lg text-xs overflow-auto max-h-72">
                {JSON.stringify(details[request.id], null, 2)}
              </pre>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

export default RecordAccessPanel;
