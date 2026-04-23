import React from 'react';
import './App.css';
import { Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';

import Account from './pages/Account';
import ForgotPassword from './pages/ForgetPassword';
import PatientDashboard from './pages/dashboard/PatientDashboard';
import DoctorDashboard from './pages/dashboard/DoctorDashboard';
import Prescriptions from './pages/Patient/Prescriptions'; 

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
