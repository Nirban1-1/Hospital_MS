import React from 'react';
import './App.css';
import { Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import Account from './pages/Account';
import ForgotPassword from './pages/ForgetPassword';
import PatientDashboard from './pages/dashboard/PatientDashboard';
import DoctorDashboard from './pages/dashboard/DoctorDashboard';
import DonorDashboard from './pages/dashboard/DonorDashboard';
import DriverDashboard from './pages/dashboard/DriverDashboard';
import Prescriptions from './pages/Patient/Prescriptions'; 
import ReceptionistDashboard from './pages/dashboard/ReceptionistDashboard'; 
import NurseDashboard from './pages/dashboard/NurseDashboard';          
import WardboyDashboard from './pages/dashboard/WardboyDashboard'; 
import ProtectedRoute from './components/ProtectedRoute';
import "./api/axiosConfig";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected Routes */}
        <Route 
          path="/account" 
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/patient" 
          element={
            <ProtectedRoute>
              <PatientDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/doctor" 
          element={
            <ProtectedRoute>
              <DoctorDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/donor" 
          element={
            <ProtectedRoute>
              <DonorDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/driver" 
          element={
            <ProtectedRoute>
              <DriverDashboard />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/dashboard/receptionist"
          element={
            <ProtectedRoute>
              <ReceptionistDashboard />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/admin-dashboard" 
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/dashboard/nurse"
          element={
            <ProtectedRoute>
              <NurseDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/wardboy"
          element={
            <ProtectedRoute>
              <WardboyDashboard />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/prescriptions" 
          element={
            <ProtectedRoute>
              <Prescriptions />
            </ProtectedRoute>
          } 
        />
      </Route>
    </Routes>
  );
}

export default App;
