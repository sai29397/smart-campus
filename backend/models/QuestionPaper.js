const mongoose = require("mongoose");

const questionPaperSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a paper title"],
      trim: true,
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
    department: {
      type: String,
      required: true,
      default: "Computer Science",
    },
    year: {
      type: String,
      required: true,
      enum: ["1st Year", "2nd Year", "3rd Year", "4th Year"],
    },
    semester: {
      type: String,
      default: "Semester 1",
    },
    examType: {
      type: String,
      required: true,
      enum: ["End-Semester Exam", "Mid-Term Exam", "Practical / Lab Exam", "Model Question Paper", "Supplementary Exam"],
      default: "End-Semester Exam",
    },
    examYear: {
      type: String,
      required: true,
      default: "2024",
    },
    totalMarks: {
      type: Number,
      default: 100,
    },
    duration: {
      type: String,
      default: "3 Hours",
    },
    instructions: {
      type: String,
      default: "Answer all questions from Section A and any four questions from Section B.",
    },
    sections: [
      {
        sectionTitle: String,
        description: String,
        questions: [
          {
            qNumber: String,
            text: String,
            marks: Number,
            topic: String,
          },
        ],
      },
    ],
    fileUrl: {
      type: String,
      default: "",
    },
    uploadedBy: {
      type: String,
      default: "Faculty Member",
    },
    facultyId: {
      type: String,
      default: "usr_faculty_1",
    },
    downloadsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuestionPaper", questionPaperSchema);
