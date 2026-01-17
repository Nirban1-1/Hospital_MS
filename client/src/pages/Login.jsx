import React, { useState } from "react";
import api from "../api/api";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // normalize values like:
  // "Staff" -> "staff"
  // "ambulance_driver" -> "ambulancedriver"
  // "ward_boy" -> "wardboy"
  const normalizeKey = (v) =>
    String(v ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")   // remove spaces
      .replace(/_/g, "");    // remove underscores

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/api/users/login", formData);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      // Trigger auth change event to update navbar
      window.dispatchEvent(new Event("authChange"));

      const user = res.data.user || {};

      // Role can come as: role, userRole, etc. (defensive)
      const userRoleRaw = user.role ?? user.userRole;
      const userRole = normalizeKey(userRoleRaw);

      // Staff category can come as: staffcategory, staffCategory, staff_category
      const staffCategoryRaw =
        user.staffcategory ?? user.staffCategory ?? user.staff_category;
      const staffCategory = normalizeKey(staffCategoryRaw);

      if (userRole === "admin") {
        navigate("/admin-dashboard");
      } else if (userRole === "doctor") {
        navigate("/dashboard/doctor");
      } else if (userRole === "donor") {
        navigate("/dashboard/donor");
      } else if (userRole === "ambulancedriver") {
        // app uses "ambulancedriver" as a role in multiple places [file:146]
        navigate("/dashboard/driver");
      } else if (userRole === "staff") {
        // staff categories used in app: receptionist, nurse, wardboy [file:144]
        if (staffCategory === "receptionist") {
          navigate("/dashboard/receptionist");
        } else if (staffCategory === "nurse") {
          navigate("/dashboard/nurse");
        } else if (staffCategory === "wardboy") {
          navigate("/dashboard/wardboy");
        } else {
          navigate("/dashboard/patient"); // fallback route
        }
      } else {
        navigate("/dashboard/patient");
      }
    } catch (err) {
      console.error("Login error:", err?.response?.data || err.message);
      setError(err?.response?.data?.message || "Login failed");
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-irisBlueColor/10 py-12 px-4">
      <div className="container">
        <div className="max-w-md mx-auto">
          {/* Back to Home Button */}
          <button
            onClick={() => navigate("/")}
            className="mb-6 inline-flex items-center gap-2 text-primaryColor hover:text-irisBlueColor font-semibold transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Home
          </button>

          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100 transform hover:scale-[1.01] transition-transform duration-300">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primaryColor to-irisBlueColor rounded-full mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-headingColor mb-2">Welcome Back</h2>
              <p className="text-textColor">Login to access your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <div className="relative">
                <label className="block text-sm font-semibold text-headingColor mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                      />
                    </svg>
                  </span>
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primaryColor focus:ring-2 focus:ring-primaryColor/20 outline-none transition-all duration-300"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="relative">
                <label className="block text-sm font-semibold text-headingColor mb-2">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </span>
                  <input
                    type="password"
                    name="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primaryColor focus:ring-2 focus:ring-primaryColor/20 outline-none transition-all duration-300"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-shake">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-primaryColor to-irisBlueColor text-white font-semibold py-3.5 rounded-xl hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <span>Login</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </button>

              {/* Forgot Password */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm text-primaryColor hover:text-irisBlueColor font-medium hover:underline transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-textColor">Don't have an account?</span>
              </div>
            </div>

            {/* Sign Up Button */}
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="w-full py-3.5 px-6 rounded-xl font-semibold bg-white border-2 border-primaryColor text-primaryColor hover:bg-primaryColor hover:text-white transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              Create New Account
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Login;
