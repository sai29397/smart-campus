const express = require("express");
const router = express.Router();
const Academic = require("../models/Academic");

// In-memory fallback store to ensure seamless operation if MongoDB is offline
let inMemoryAcademics = [
  {
    _id: "acad_1",
    id: "acad_1",
    subjectName: "Data Structures & Algorithms",
    subjectCode: "CS301",
    semester: "Semester 5",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "3rd Year",
    academicYear: "3rd Year",
    facultyName: "Dr. Sarah Jenkins",
    createdAt: new Date(),
  },
  {
    _id: "acad_2",
    id: "acad_2",
    subjectName: "Database Management Systems",
    subjectCode: "CS302",
    semester: "Semester 5",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "3rd Year",
    academicYear: "3rd Year",
    facultyName: "Prof. Alan Turing",
    createdAt: new Date(),
  },
];

// @route   GET /api/academic
// @desc    Get all academic records
// @access  Public
router.get("/", async (req, res) => {
  try {
    // Attempt to query MongoDB
    try {
      const academics = await Academic.find().sort({ createdAt: -1 });
      if (academics && academics.length > 0) {
        return res.status(200).json(academics);
      }
    } catch (dbErr) {
      console.warn("MongoDB query skipped or not connected, using in-memory store for Academic GET");
    }

    // Return in-memory fallback list
    return res.status(200).json(inMemoryAcademics);
  } catch (error) {
    console.error("Error fetching academic records:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch academic details",
      error: error.message,
    });
  }
});

// @route   POST /api/academic
// @desc    Add a new academic record
// @access  Public
router.post("/", async (req, res) => {
  try {
    const {
      subjectName,
      subjectCode,
      semester,
      department,
      academicDepartment,
      year,
      academicYear,
      facultyName,
    } = req.body;

    const finalDepartment = academicDepartment || department;
    const finalYear = academicYear || year;

    // Field validation
    if (!subjectName || !subjectCode || !semester || !finalDepartment || !finalYear) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: subjectName, subjectCode, semester, department/academicDepartment, year/academicYear.",
      });
    }

    const newRecordData = {
      subjectName: subjectName.trim(),
      subjectCode: subjectCode.trim(),
      semester: semester.trim(),
      department: finalDepartment.trim(),
      academicDepartment: finalDepartment.trim(),
      year: finalYear.trim(),
      academicYear: finalYear.trim(),
      facultyName: (facultyName || "Faculty Member").trim(),
      createdAt: new Date(),
    };

    // Try saving to MongoDB
    try {
      const academicRecord = new Academic(newRecordData);
      const savedRecord = await academicRecord.save();
      
      // Also sync to memory
      inMemoryAcademics.unshift(savedRecord);

      return res.status(201).json(savedRecord);
    } catch (dbErr) {
      console.warn("MongoDB save skipped, persisting to in-memory store for Academic POST");
      
      const inMemRecord = {
        _id: "acad_" + Date.now(),
        id: "acad_" + Date.now(),
        ...newRecordData,
      };

      inMemoryAcademics.unshift(inMemRecord);
      return res.status(201).json(inMemRecord);
    }
  } catch (error) {
    console.error("Error creating academic record:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create academic record",
      error: error.message,
    });
  }
});

// @route   DELETE /api/academic/:id
// @desc    Delete an academic record by ID
// @access  Public
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Try MongoDB deletion
    try {
      await Academic.findByIdAndDelete(id);
    } catch (dbErr) {
      // Ignore DB error and clean from memory
    }

    inMemoryAcademics = inMemoryAcademics.filter(
      (item) => item._id !== id && item.id !== id
    );

    return res.status(200).json({
      success: true,
      message: "Academic record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting academic record:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete academic record",
      error: error.message,
    });
  }
});

module.exports = router;
