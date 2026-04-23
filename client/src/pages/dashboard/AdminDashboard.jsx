import React, { useEffect, useState } from 'react';
import api from '../../api/api';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [filteredRole, setFilteredRole] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState(null);
  const [expandedSection, setExpandedSection] = useState(true);

  // Staff scheduling state
  const [staffSchedules, setStaffSchedules] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [shiftType, setShiftType] = useState('morning');
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleSuccess, setScheduleSuccess] = useState('');
  const [expandedScheduleSection, setExpandedScheduleSection] = useState(true);
  const [expandedScheduleDetail, setExpandedScheduleDetail] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const roles = ['doctor', 'donor', 'ambulance_driver', 'patient', 'staff'];
        const allUsers = [];

        for (const role of roles) {
          const res = await api.get(`/api/admin/users/${role}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          allUsers.push(...res.data);
        }

        setUsers(allUsers);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [token]);

  const handleVerify = async (id) => {
    try {
      await api.patch(
        `/api/admin/verify/${id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUsers((prev) =>
        prev.map((user) => (user._id === id ? { ...user, is_verified: true } : user))
      );
      setExpandedUser(null);
    } catch (err) {
      console.error('Verification failed:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/admin/user/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUsers((prev) => prev.filter((user) => user._id !== id));
      setExpandedUser(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const filteredUsers = filteredRole === 'all' ? users : users.filter((user) => user.role === filteredRole);

  const roleStats = {
    all: users.length,
    doctor: users.filter((u) => u.role === 'doctor').length,
    donor: users.filter((u) => u.role === 'donor').length,
    ambulance_driver: users.filter((u) => u.role === 'ambulance_driver').length,
    patient: users.filter((u) => u.role === 'patient').length,
    staff: users.filter((u) => u.role === 'staff').length,
  };

  const toggleExpand = (userId) => setExpandedUser(expandedUser === userId ? null : userId);
  const toggleSection = () => setExpandedSection(!expandedSection);
  const toggleScheduleSection = () => setExpandedScheduleSection(!expandedScheduleSection);

  // ===== Staff scheduling functions =====
  const fetchStaffSchedules = async () => {
    setStaffLoading(true);
    setScheduleError('');

    try {
      const res = await api.get('/api/admin/staff-schedule', {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('Schedule Response:', res.data);
      setStaffSchedules(res.data || []);
    } catch (err) {
      console.error('Failed to fetch staff schedules:', err);
      setScheduleError('Failed to load staff schedules');
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffSchedules();
  }, [token]);

  const handleAssignShift = async () => {
    if (!selectedStaff || !shiftDate || !shiftType) {
      setScheduleError('Select staff, date and shift type');
      setScheduleSuccess('');
      return;
    }

    setScheduleError('');
    setScheduleSuccess('');

    try {
      await api.post(
        '/api/admin/staff-schedule',
        {
          staff_id: selectedStaff,
          date: shiftDate,
          shift_type: shiftType,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setScheduleSuccess('Shift assigned successfully');
      setSelectedStaff('');
      setShiftDate('');
      setShiftType('morning');
      fetchStaffSchedules();
    } catch (err) {
      console.error('Failed to assign shift:', err);
      setScheduleError(err.response?.data?.message || 'Failed to assign shift');
    }
  };

  // ✅ NEW: Remove shift (DELETE schedule)
  const handleRemoveShift = async (scheduleId) => {
    try {
      setScheduleError('');
      setScheduleSuccess('');

      await api.delete(`/api/admin/staff-schedule/${scheduleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setScheduleSuccess('Shift removed successfully');
      setExpandedScheduleDetail(null);
      fetchStaffSchedules();
    } catch (err) {
      console.error('Failed to remove shift:', err);
      setScheduleError(err.response?.data?.message || 'Failed to remove shift');
    }
  };

  const staffUsers = users.filter(
    (u) => u.role === 'staff' && ['receptionist', 'nurse', 'ward_boy'].includes(u.staff_category || '')
  );

  // Group schedules by date
  const groupedByDate = staffSchedules.reduce((acc, schedule) => {
    const date = new Date(schedule.date).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(schedule);
    return acc;
  }, {});

  // Get shift info
  const getShiftInfo = (type) => {
    const shifts = {
      morning: {
        icon: '🌅',
        time: '08:00 - 14:00',
        color: 'amber',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-700',
      },
      evening: {
        icon: '🌆',
        time: '14:00 - 20:00',
        color: 'orange',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-700',
      },
      night: {
        icon: '🌙',
        time: '20:00 - 08:00',
        color: 'indigo',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        badgeBg: 'bg-indigo-100',
        badgeText: 'text-indigo-700',
      },
    };

    return shifts[type] || shifts.morning;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primaryColor/5 via-white to-purpleColor/5 py-8 px-4">
      <div className="container max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-headingColor mb-2">Admin Dashboard</h2>
          <p className="text-textColor">Manage users, staff schedules and monitor system activity</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: 'Total Users', value: roleStats.all, icon: '👥', color: 'from-primaryColor to-irisBlueColor' },
            { label: 'Doctors', value: roleStats.doctor, icon: '👨‍⚕️', color: 'from-purpleColor to-primaryColor' },
            { label: 'Donors', value: roleStats.donor, icon: '🩸', color: 'from-irisBlueColor to-primaryColor' },
            { label: 'Drivers', value: roleStats.ambulance_driver, icon: '🚑', color: 'from-yellowColor to-primaryColor' },
            { label: 'Patients', value: roleStats.patient, icon: '🏥', color: 'from-primaryColor to-purpleColor' },
            { label: 'Staff', value: roleStats.staff, icon: '🧑‍💼', color: 'from-emerald-500 to-primaryColor' },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow duration-300"
            >
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                <span className="text-2xl">{stat.icon}</span>
              </div>
              <p className="text-3xl font-bold text-headingColor mb-1">{stat.value}</p>
              <p className="text-sm text-textColor font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Staff Scheduling Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-8">
          <div
            onClick={toggleScheduleSection}
            className="p-6 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
          >
            <div className="flex justify-between items-start sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-headingColor mb-1">Staff Scheduling</h3>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${
                      expandedScheduleSection ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <p className="text-sm text-textColor">Assign shifts for receptionist, nurse and ward boy.</p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchStaffSchedules();
                }}
                className="px-4 py-2.5 text-sm font-semibold rounded-xl border-2 border-gray-200 hover:border-primaryColor hover:bg-primaryColor/5 text-headingColor transition-all"
              >
                Refresh
              </button>
            </div>
          </div>

          {expandedScheduleSection && (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left assign form */}
              <div className="space-y-4">
                <h4 className="font-semibold text-headingColor mb-1">Assign Shift</h4>

                <div>
                  <label className="block text-xs font-semibold text-textColor/70 mb-1">Staff</label>
                  <select
                    value={selectedStaff}
                    onChange={(e) => setSelectedStaff(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primaryColor focus:ring-2 focus:ring-primaryColor/20 outline-none text-sm"
                  >
                    <option value="">Select staff</option>
                    {staffUsers.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.staff_category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-textColor/70 mb-1">Date</label>
                    <input
                      type="date"
                      value={shiftDate}
                      onChange={(e) => setShiftDate(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primaryColor focus:ring-2 focus:ring-primaryColor/20 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-textColor/70 mb-1">Shift</label>
                    <select
                      value={shiftType}
                      onChange={(e) => setShiftType(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primaryColor focus:ring-2 focus:ring-primaryColor/20 outline-none text-sm"
                    >
                      <option value="morning">Morning (08:00 - 14:00)</option>
                      <option value="evening">Evening (14:00 - 20:00)</option>
                      <option value="night">Night (20:00 - 08:00)</option>
                    </select>
                  </div>
                </div>

                {scheduleError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">{scheduleError}</p>
                )}
                {scheduleSuccess && (
                  <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-md px-2 py-1">{scheduleSuccess}</p>
                )}

                <button
                  onClick={handleAssignShift}
                  className="mt-2 px-5 py-2.5 bg-gradient-to-r from-primaryColor to-irisBlueColor text-white font-semibold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm"
                >
                  Assign Shift
                </button>
              </div>

              {/* Right schedule list grouped by date */}
              <div>
                <h4 className="font-semibold text-headingColor mb-4">Scheduled Shifts by Date</h4>

                {staffLoading ? (
                  <p className="text-sm text-textColor">Loading schedules...</p>
                ) : staffSchedules.length === 0 ? (
                  <p className="text-sm text-textColor">No shifts assigned yet.</p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {Object.entries(groupedByDate)
                      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
                      .map(([date, schedules]) => (
                        <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gradient-to-r from-primaryColor/10 to-irisBlueColor/10 px-4 py-3 border-b border-gray-200">
                            <h5 className="font-bold text-headingColor text-sm">{date}</h5>
                            <p className="text-xs text-textColor/70 mt-1">
                              {schedules.length} staff {schedules.length === 1 ? 'member' : 'members'} assigned
                            </p>
                          </div>

                          <div className="divide-y divide-gray-200">
                            {schedules.map((schedule) => {
                              const shiftInfo = getShiftInfo(schedule.shift_type);
                              const isExpanded = expandedScheduleDetail === (schedule._id || schedule.id);

                              // populated data could be schedule.staff_id (from backend populate)
                              const staffData = schedule.staff_id;
                              const staffName = typeof staffData === 'object' ? staffData?.name || 'Unknown Staff' : 'Unknown Staff';
                              const staffCategory =
                                typeof staffData === 'object' ? staffData?.staff_category || 'Unknown Category' : 'Unknown Category';
                              const staffPhone = typeof staffData === 'object' ? staffData?.phone : null;
                              const staffEmail = typeof staffData === 'object' ? staffData?.email : null;
                              const staffInitial =
                                typeof staffData === 'object'
                                  ? (staffData?.name || 'U').charAt(0).toUpperCase()
                                  : 'S';

                              return (
                                <div
                                  key={schedule._id || schedule.id}
                                  className={`transition-colors ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                                >
                                  {/* Summary */}
                                  <div
                                    onClick={() => setExpandedScheduleDetail(isExpanded ? null : (schedule._id || schedule.id))}
                                    className="px-4 py-3 cursor-pointer flex items-center justify-between gap-3"
                                  >
                                    <div className="flex items-center gap-3 flex-1">
                                      <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primaryColor to-purpleColor flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                        {staffInitial}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-headingColor text-sm truncate">{staffName}</p>
                                        <p className="text-xs text-textColor/70">
                                          {shiftInfo.icon}{' '}
                                          {schedule.shift_type.charAt(0).toUpperCase() + schedule.shift_type.slice(1)} Shift
                                        </p>
                                      </div>
                                    </div>

                                    <svg
                                      className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                                        isExpanded ? 'rotate-180' : ''
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                  </div>

                                  {/* Expanded */}
                                  {isExpanded && (
                                    <div className={`px-4 py-4 border-t border-gray-200 ${shiftInfo.bgColor}`}>
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                          <p className="text-xs font-semibold text-textColor/60 uppercase mb-1">Staff Name</p>
                                          <p className="font-medium text-headingColor">{staffName}</p>
                                        </div>

                                        <div>
                                          <p className="text-xs font-semibold text-textColor/60 uppercase mb-1">Category</p>
                                          <p className="font-medium text-headingColor capitalize">{staffCategory}</p>
                                        </div>

                                        <div>
                                          <p className="text-xs font-semibold text-textColor/60 uppercase mb-1">Shift Type</p>
                                          <div className="flex items-center gap-2">
                                            <span className="text-lg">{shiftInfo.icon}</span>
                                            <span className="font-medium text-headingColor capitalize">{schedule.shift_type}</span>
                                          </div>
                                        </div>

                                        <div>
                                          <p className="text-xs font-semibold text-textColor/60 uppercase mb-1">Shift Time</p>
                                          <p className="font-medium text-headingColor">{shiftInfo.time}</p>
                                        </div>

                                        <div className="col-span-2">
                                          <p className="text-xs font-semibold text-textColor/60 uppercase mb-1">Date</p>
                                          <p className="font-medium text-headingColor">
                                            {new Date(schedule.date).toLocaleDateString('en-US', {
                                              weekday: 'long',
                                              year: 'numeric',
                                              month: 'long',
                                              day: 'numeric',
                                            })}
                                          </p>
                                        </div>

                                        {staffPhone && (
                                          <div className="col-span-2">
                                            <p className="text-xs font-semibold text-textColor/60 uppercase mb-1">Phone</p>
                                            <p className="font-medium text-headingColor">{staffPhone}</p>
                                          </div>
                                        )}

                                        {staffEmail && (
                                          <div className="col-span-2">
                                            <p className="text-xs font-semibold text-textColor/60 uppercase mb-1">Email</p>
                                            <p className="font-medium text-headingColor break-all">{staffEmail}</p>
                                          </div>
                                        )}
                                      </div>

                                      {/* ✅ FIXED Remove Shift button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveShift(schedule._id || schedule.id);
                                        }}
                                        className="mt-3 w-full px-3 py-2 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                                      >
                                        Remove Shift
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Management Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
          {/* Header */}
          <div
            onClick={toggleSection}
            className="p-6 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
          >
            <div className="flex justify-between items-start sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-headingColor mb-1">User Management</h3>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${
                      expandedSection ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <p className="text-sm text-textColor">View and manage all registered users</p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <label htmlFor="role" className="text-sm font-semibold text-headingColor">
                  Filter
                </label>
                <select
                  id="role"
                  value={filteredRole}
                  onChange={(e) => setFilteredRole(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primaryColor focus:ring-2 focus:ring-primaryColor/20 outline-none transition-all bg-white font-medium"
                >
                  <option value="all">All Users</option>
                  <option value="doctor">Doctors</option>
                  <option value="donor">Donors</option>
                  <option value="ambulance_driver">Ambulance Drivers</option>
                  <option value="patient">Patients</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            </div>
          </div>

          {/* Body */}
          {expandedSection && (
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primaryColor mb-4"></div>
                    <p className="text-textColor">Loading users...</p>
                  </div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-textColor">No users found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div key={user._id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-300">
                      {/* User Row */}
                      <div
                        onClick={() => toggleExpand(user._id)}
                        className="p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primaryColor to-purpleColor flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                            {user.name?.charAt(0).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-headingColor text-lg truncate">{user.name}</h4>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-textColor mt-1">
                              <span className="truncate">{user.email}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primaryColor/10 text-primaryColor capitalize">
                                {user.role.replace('_', ' ')}
                              </span>
                              {user.staff_category && (
                                <>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 capitalize">
                                    {user.staff_category}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                          <div>
                            {user.is_verified || user.role === 'patient' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                                Pending
                              </span>
                            )}
                          </div>

                          <svg
                            className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${
                              expandedUser === user._id ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedUser === user._id && (
                        <div className="border-t border-gray-200 bg-gray-50 p-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                              <h5 className="font-bold text-headingColor mb-4">User Information</h5>
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-semibold text-textColor/60 uppercase">Email</p>
                                  <p className="text-sm text-headingColor font-medium mt-1">{user.email}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-textColor/60 uppercase">Phone</p>
                                  <p className="text-sm text-headingColor font-medium mt-1">{user.phone || 'Not provided'}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-textColor/60 uppercase">Role</p>
                                  <p className="text-sm text-headingColor font-medium mt-1 capitalize">{user.role.replace('_', ' ')}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-textColor/60 uppercase">Member Since</p>
                                  <p className="text-sm text-headingColor font-medium mt-1">
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h5 className="font-bold text-headingColor mb-4">Additional Details</h5>
                              <div className="space-y-3">
                                {user.role === 'doctor' && (
                                  <>
                                    <div>
                                      <p className="text-xs font-semibold text-textColor/60 uppercase">Specialization</p>
                                      <p className="text-sm text-headingColor font-medium mt-1">{user.specialization || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-textColor/60 uppercase">License Number</p>
                                      <p className="text-sm text-headingColor font-medium mt-1">{user.license_number || 'N/A'}</p>
                                    </div>
                                  </>
                                )}

                                {user.role === 'donor' && (
                                  <>
                                    <div>
                                      <p className="text-xs font-semibold text-textColor/60 uppercase">Blood Group</p>
                                      <p className="text-sm text-headingColor font-medium mt-1">{user.blood_group || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-textColor/60 uppercase">Availability</p>
                                      <p className="text-sm text-headingColor font-medium mt-1">
                                        {user.available ? 'Available' : 'Not Available'}
                                      </p>
                                    </div>
                                  </>
                                )}

                                {user.role === 'ambulance_driver' && (
                                  <>
                                    <div>
                                      <p className="text-xs font-semibold text-textColor/60 uppercase">License Number</p>
                                      <p className="text-sm text-headingColor font-medium mt-1">{user.license_number || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-textColor/60 uppercase">Available</p>
                                      <p className="text-sm text-headingColor font-medium mt-1">{user.available ? 'Yes' : 'No'}</p>
                                    </div>
                                  </>
                                )}

                                {user.role === 'patient' && (
                                  <>
                                    <div>
                                      <p className="text-xs font-semibold text-textColor/60 uppercase">Age</p>
                                      <p className="text-sm text-headingColor font-medium mt-1">{user.age || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-textColor/60 uppercase">Gender</p>
                                      <p className="text-sm text-headingColor font-medium mt-1">{user.gender || 'N/A'}</p>
                                    </div>
                                  </>
                                )}

                                {user.role === 'staff' && (
                                  <div>
                                    <p className="text-xs font-semibold text-textColor/60 uppercase">Staff Category</p>
                                    <p className="text-sm text-headingColor font-medium mt-1">{user.staff_category || 'N/A'}</p>
                                  </div>
                                )}

                                <div>
                                  <p className="text-xs font-semibold text-textColor/60 uppercase">Verified</p>
                                  <p className="text-sm text-headingColor font-medium mt-1">{user.is_verified ? 'Yes' : 'No'}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {!user.is_verified && user.role !== 'patient' && (
                            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <h6 className="font-bold text-yellow-800 mb-1">Pending Approval</h6>
                                  <p className="text-sm text-yellow-700">
                                    This user needs to be verified before they can access all features.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row gap-3 justify-end">
                            {user.role !== 'patient' && !user.is_verified && (
                              <button
                                onClick={() => handleVerify(user._id)}
                                className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg"
                              >
                                Approve / Verify
                              </button>
                            )}

                            <button
                              onClick={() => handleDelete(user._id)}
                              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg"
                            >
                              Delete User
                            </button>
                          </div>
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
  );
};

export default AdminDashboard;
