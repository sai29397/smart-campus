const mongoose = require("mongoose");

const classScheduleSchema = new mongoose.Schema(
  {
    subjectId: {
      type: String,
      default: "",
    },
    subjectName: {
      type: String,
      required: [true, "Please add subject name"],
      trim: true,
    },
    subjectCode: {
      type: String,
      required: [true, "Please add subject code"],
      trim: true,
    },
    facultyId: {
      type: String,
      required: true,
      default: "usr_faculty_1",
    },
    facultyName: {
      type: String,
      required: true,
      default: "Dr. Sarah Jenkins",
    },
    facultyEmail: {
      type: String,
      default: "faculty@campus.edu",
    },
    years: {
      type: [String],
      required: true,
      default: ["1st Year"],
    },
    specialization: {
      type: String,
      default: "All Specializations",
    },
    department: {
      type: String,
      required: true,
      default: "Computer Science",
    },
    section: {
      type: String,
      default: "Section A",
    },
    date: {
      type: String,
      required: [true, "Please specify class date"],
    },
    startTime: {
      type: String,
      required: [true, "Please specify start time"],
    },
    endTime: {
      type: String,
      required: [true, "Please specify end time"],
    },
    block: {
      type: String,
      required: true,
      default: "A Block",
    },
    floor: {
      type: String,
      required: true,
      default: "2nd Floor",
    },
    roomNumber: {
      type: String,
      required: true,
      default: "A-201",
    },
    venue: {
      type: String,
      required: true,
      default: "A Block – 2nd Floor – Room A-201",
    },
    status: {
      type: String,
      enum: ["Scheduled", "Ongoing", "Completed", "Cancelled", "Rescheduled"],
      default: "Scheduled",
    },
    cancellationReason: {
      type: String,
      default: "",
    },
    previousSchedule: {
      date: String,
      startTime: String,
      endTime: String,
      venue: String,
    },
    createdBy: {
      type: String,
      default: "Campus Administration",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClassSchedule", classScheduleSchema);
