const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
require("dotenv").config();

// Route Imports
const authRoutes = require("./routes/authRoutes");
const academicRoutes = require("./routes/academicRoutes");
const subjectAssignmentRoutes = require("./routes/subjectAssignmentRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const chatRoutes = require("./routes/chatRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const paperRoutes = require("./routes/paperRoutes");
const classRoutes = require("./routes/classRoutes");

// Initialize Express App & HTTP Server
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Enable CORS for all external origins
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-user-email", "Accept", "Origin", "X-Requested-With"],
  })
);

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Socket.IO for real-time WebSocket messaging
let io = null;
try {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    // User joins their personal private room for real-time messages
    socket.on("join_user_room", (userId) => {
      if (userId) {
        socket.join(String(userId));
      }
    });

    socket.on("join_room", (userId) => {
      if (userId) {
        socket.join(String(userId));
      }
    });

    socket.on("disconnect", () => {});
  });

  app.set("io", io);
} catch (e) {
  console.warn("Socket.io initialization notice:", e.message);
}

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
    version: "3.0.0",
    environment: process.env.VERCEL ? "Vercel Serverless" : "Node.js Server",
    database: "Connected & Persistent",
    features: [
      "Permanent Database Persistence for Users, Profiles, Messages & Academic Data",
      "Direct User-to-User Private Messaging & Conversation Threads",
      "Real-time WebSocket & Live Background Synchronization",
      "Classroom and Class Schedule Management System",
      "Targeted Subject Assignment (Student/Multi-Year/Specialization)",
      "Attendance Management & Analytics",
      "Previous Year Question Papers (PYQs) & Exam Resources",
    ],
  });
});

// API Routes & Root Aliases
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);

app.use("/api/subjects", subjectAssignmentRoutes);
app.use("/subjects", subjectAssignmentRoutes);
app.use("/api/academic", subjectAssignmentRoutes);

app.use("/api/announcements", announcementRoutes);
app.use("/announcements", announcementRoutes);

app.use("/api/messages", chatRoutes);
app.use("/messages", chatRoutes);
app.use("/api/chat", chatRoutes);
app.use("/chat", chatRoutes);

app.use("/api/attendance", attendanceRoutes);
app.use("/attendance", attendanceRoutes);

app.use("/api/papers", paperRoutes);
app.use("/papers", paperRoutes);

app.use("/api/classes", classRoutes);
app.use("/classes", classRoutes);

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

// Initialize DB Connection
connectDB();

// Only listen on port if not running as a Vercel serverless function
if (process.env.VERCEL !== "1" && process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log("==================================================");
    console.log(` Smart Campus Server is running on port ${PORT}`);
    console.log(` URL: http://localhost:${PORT}`);
    console.log(` Test Route: http://localhost:${PORT}/`);
    console.log(` Chat API: http://localhost:${PORT}/api/messages/conversations`);
    console.log(` Static Frontend: http://localhost:${PORT}/index.html`);
    console.log("==================================================");
  });
}

module.exports = app;
