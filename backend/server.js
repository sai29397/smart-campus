const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

// Route Imports
const authRoutes = require("./routes/authRoutes");
const academicRoutes = require("./routes/academicRoutes");

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all external origins
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/academic", academicRoutes);

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
      "MongoDB Connection Notice: MongoDB is not running locally. In-memory data store is active for immediate use."
    );
  });

// Start Server on Port 3000
app.listen(PORT, () => {
  console.log("==================================================");
  console.log(` Smart Campus Server is running on port ${PORT}`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Test Route: http://localhost:${PORT}/`);
  console.log(` Academic API: http://localhost:${PORT}/api/academic`);
  console.log(` Static Frontend: http://localhost:${PORT}/index.html`);
  console.log("==================================================");
});

module.exports = app;
