const mongoose = require("mongoose");

const SubjectAssignmentSchema = new mongoose.Schema(
  {
    subjectName: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
    },
    subjectCode: {
      type: String,
      required: [true, "Subject code is required"],
      trim: true,
    },
    facultyId: {
      type: String,
      required: true,
    },
    facultyName: {
      type: String,
      default: "Faculty Member",
    },
    department: {
      type: String,
      default: "Computer Science",
    },
    assignmentType: {
      type: String,
      enum: ["entire_year", "specific_student", "multiple_students", "specialization", "multiple_years"],
      default: "entire_year",
    },
    studentIds: {
      type: [String],
      default: [],
    },
    years: {
      type: [String],
      default: ["1st Year"],
    },
    specializations: {
      type: [String],
      default: [],
    },
    semester: {
      type: String,
      default: "Semester 1",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SubjectAssignment", SubjectAssignmentSchema);
