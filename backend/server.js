const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

// Route Imports
const authRoutes = require("./routes/authRoutes");
const academicRoutes = require("./routes/academicRoutes");
const subjectAssignmentRoutes = require("./routes/subjectAssignmentRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const chatRoutes = require("./routes/chatRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all external origins
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-user-email"],
  })
);

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Serve Static Frontend Assets from smart-campus
const frontendPath = path.join(__dirname, "../smart-campus");
app.use(express.static(frontendPath));

// Test Route: GET /
app.get("/", (req, res) => {
  res.json({
    message: "Smart Campus Backend Running Successfully",
    version: "2.1.0",
    features: [
      "Targeted Subject Assignment (Student/Multi-Year/Specialization)",
      "Real-time Faculty-Student Private Messaging",
      "Attendance Management & Analytics",
      "Permanent On-Disk JSON & MongoDB Persistence",
    ],
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/subjects", subjectAssignmentRoutes);
app.use("/subjects", subjectAssignmentRoutes);
app.use("/api/academic", subjectAssignmentRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/messages", chatRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/attendance", attendanceRoutes);

// Global 404 Handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Internal Server Error:", err.stack);
  res.status(500).json({
    success: false,
    message: "An internal server error occurred",
    error: process.env.NODE_ENV === "production" ? {} : err.message,
  });
});

// Database Connection with Fallback
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_campus";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully!");
  })
  .catch((err) => {
    console.warn(
      "MongoDB Connection Notice: MongoDB is not running locally. In-memory & JSON disk data store is active for immediate use."
    );
  });

// Start Server on Port 3000
app.listen(PORT, () => {
  console.log("==================================================");
  console.log(` Smart Campus Server is running on port ${PORT}`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Test Route: http://localhost:${PORT}/`);
  console.log(` Subjects API: http://localhost:${PORT}/api/subjects/student`);
  console.log(` Chat API: http://localhost:${PORT}/api/messages/conversations`);
  console.log(` Attendance API: http://localhost:${PORT}/api/attendance/student`);
  console.log(` Static Frontend: http://localhost:${PORT}/index.html`);
  console.log("==================================================");
});

module.exports = app;
