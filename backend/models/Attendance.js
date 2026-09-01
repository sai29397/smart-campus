const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      index: true,
    },
    studentName: {
      type: String,
      default: "Student",
    },
    studentEmail: {
      type: String,
      default: "",
    },
    subjectId: {
      type: String,
      required: true,
      index: true,
    },
    subjectName: {
      type: String,
      required: true,
    },
    facultyId: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true, // YYYY-MM-DD format
      index: true,
    },
    status: {
      type: String,
      enum: ["Present", "Absent"],
      required: true,
    },
    year: {
      type: String,
      default: "1st Year",
    },
    specialization: {
      type: String,
      default: "General CSE",
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate attendance for same student, subject, and date
AttendanceSchema.index({ studentId: 1, subjectId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
