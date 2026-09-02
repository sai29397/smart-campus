const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/smart_campus";

let isConnecting = false;
let lastAttemptTime = 0;
const RETRY_INTERVAL = 30000; // 30 seconds backoff between reconnection attempts

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const now = Date.now();
  if (isConnecting || now - lastAttemptTime < RETRY_INTERVAL) {
    return null;
  }

  isConnecting = true;
  lastAttemptTime = now;

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 1500, // Fast 1.5s timeout
    });
    console.log("Connected to MongoDB database successfully!");
    isConnecting = false;
    return conn;
  } catch (err) {
    console.warn(
      "MongoDB Notice: Running with permanent server file/memory database storage."
    );
    isConnecting = false;
    return null;
  }
}

module.exports = connectDB;
