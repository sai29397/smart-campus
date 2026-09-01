const mongoose = require("mongoose");

const AcademicSchema = new mongoose.Schema(
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
    semester: {
      type: String,
      required: [true, "Semester is required"],
      trim: true,
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
    },
    year: {
      type: String,
      required: [true, "Year is required"],
      trim: true,
    },
    facultyName: {
      type: String,
      default: "Faculty Member",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtuals / aliases for flexible frontend compatibility
AcademicSchema.virtual("academicDepartment").get(function () {
  return this.department;
});

AcademicSchema.virtual("academicYear").get(function () {
  return this.year;
});

AcademicSchema.set("toJSON", { virtuals: true });
AcademicSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Academic", AcademicSchema);
