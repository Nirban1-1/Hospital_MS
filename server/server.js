// server.js
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

/**
 * CORS (Render backend) - allow your Vercel frontend + localhost dev
 * Important:
 * - Use a Set + .has()
 * - Use the SAME cors options for both app.use(cors(...)) and app.options(...)
 */
const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://hmsystem-opal.vercel.app",
]);

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (Postman, curl, Render health checks)
    if (!origin) return callback(null, true);

    if (allowedOrigins.has(origin)) return callback(null, true);

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Optional: request logger (helps debugging)
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin}`
  );
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

// Global error handler (keep it last)
app.use((err, req, res, next) => {
  const origin = req.headers.origin;

  // If the request is from an allowed origin (or has no origin), include CORS headers on errors too
  if (!origin || allowedOrigins.has(origin)) {
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Vary", "Origin");
  }

  console.error(`[ERROR] ${err.message}`);
  console.error(err.stack);

  res.status(err.status || 500).json({
    error: err.message || "Server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Listen (Render uses PORT; Vercel serverless uses export default app)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

export default app;
