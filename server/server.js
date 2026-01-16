import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import connectDB from "./database/connectDB.js";

import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import ambulanceRoutes from "./routes/ambulanceRoutes.js";
import bloodRoutes from "./routes/bloodRoutes.js";
import donorRoutes from "./routes/donorRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import medicineRoutes from "./routes/medicineRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import testReportRoutes from "./routes/testReportRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import chatbotRoutes from "./routes/chatbotRoutes.js";
import receptionRoutes from "./routes/receptionRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";

dotenv.config();

// Connect DB
connectDB();

const app = express();

// Body parsers (BEFORE CORS)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",       // Vite dev
  "http://localhost:3000",       // CRA fallback
  "https://h-msystem-mern.vercel.app" // production
];

// ✅ Step 1: Basic CORS middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
}));

// ✅ Step 2: Explicit preflight handler (BEFORE routes)
app.options(/.*/, (req, res) => {
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin) || !origin) {
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Max-Age", "86400"); // 24 hours
  }
  
  res.sendStatus(200);
});

// ✅ Step 3: Debug middleware - log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/ambulance", ambulanceRoutes);
app.use("/api/blood", bloodRoutes);
app.use("/api/donor", donorRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/appointment", appointmentRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/test-reports", testReportRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/reception", receptionRoutes);
app.use("/api/staff", staffRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("API is running...");
});

// 404 handler (BEFORE error handler)
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ✅ Step 4: Global error handler (sends CORS headers even on error)
app.use((err, req, res, next) => {
  const origin = req.headers.origin;
  
  // Send CORS headers even if there's an error
  if (allowedOrigins.includes(origin) || !origin) {
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
  }
  
  console.error(`[ERROR] ${err.message}`);
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    error: err.message || "Server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
});

// Listen
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

export default app;
