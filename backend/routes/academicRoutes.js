const express = require("express");
const router = express.Router();
const Academic = require("../models/Academic");

// Helper to normalize year string/number to standard "1st Year", "2nd Year", "3rd Year", "4th Year"
function normalizeYear(yearInput) {
  if (!yearInput) return null;
  const str = String(yearInput).trim().toLowerCase();
  if (str === "1" || str === "1st" || str.includes("1st") || str.includes("first")) return "1st Year";
  if (str === "2" || str === "2nd" || str.includes("2nd") || str.includes("second")) return "2nd Year";
  if (str === "3" || str === "3rd" || str.includes("3rd") || str.includes("third")) return "3rd Year";
  if (str === "4" || str === "4th" || str.includes("4th") || str.includes("fourth") || str.includes("final")) return "4th Year";
  return yearInput;
}

// Helper to normalize semester
function normalizeSemester(semInput) {
  if (!semInput) return null;
  const str = String(semInput).trim().toLowerCase();
  const numMatch = str.match(/\d+/);
  if (numMatch) {
    return `Semester ${numMatch[0]}`;
  }
  return semInput;
}

// In-memory fallback store with multi-year curriculum subjects
let inMemoryAcademics = [
  // 1st Year Subjects
  {
    _id: "acad_1st_1",
    id: "acad_1st_1",
    subjectName: "Engineering Mathematics I",
    subjectCode: "MA101",
    semester: "Semester 1",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "1st Year",
    academicYear: "1st Year",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    createdAt: new Date(),
  },
  {
    _id: "acad_1st_2",
    id: "acad_1st_2",
    subjectName: "Programming in C & Data Basics",
    subjectCode: "CS102",
    semester: "Semester 1",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "1st Year",
    academicYear: "1st Year",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    createdAt: new Date(),
  },
  {
    _id: "acad_1st_3",
    id: "acad_1st_3",
    subjectName: "Engineering Physics & Lab",
    subjectCode: "PH103",
    semester: "Semester 1",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "1st Year",
    academicYear: "1st Year",
    facultyId: "usr_faculty_2",
    facultyName: "Prof. Walter White",
    createdAt: new Date(),
  },

  // 2nd Year Subjects
  {
    _id: "acad_2nd_1",
    id: "acad_2nd_1",
    subjectName: "Object-Oriented Programming (Java)",
    subjectCode: "CS201",
    semester: "Semester 3",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "2nd Year",
    academicYear: "2nd Year",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    createdAt: new Date(),
  },
  {
    _id: "acad_2nd_2",
    id: "acad_2nd_2",
    subjectName: "Discrete Mathematics",
    subjectCode: "CS202",
    semester: "Semester 3",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "2nd Year",
    academicYear: "2nd Year",
    facultyId: "usr_faculty_3",
    facultyName: "Dr. Grace Hopper",
    createdAt: new Date(),
  },
  {
    _id: "acad_2nd_3",
    id: "acad_2nd_3",
    subjectName: "Digital Logic & Computer Organization",
    subjectCode: "CS203",
    semester: "Semester 3",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "2nd Year",
    academicYear: "2nd Year",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    createdAt: new Date(),
  },

  // 3rd Year Subjects
  {
    _id: "acad_3rd_1",
    id: "acad_3rd_1",
    subjectName: "Data Structures & Algorithms",
    subjectCode: "CS301",
    semester: "Semester 5",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "3rd Year",
    academicYear: "3rd Year",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    createdAt: new Date(),
  },
  {
    _id: "acad_3rd_2",
    id: "acad_3rd_2",
    subjectName: "Database Management Systems",
    subjectCode: "CS302",
    semester: "Semester 5",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "3rd Year",
    academicYear: "3rd Year",
    facultyId: "usr_faculty_4",
    facultyName: "Prof. Alan Turing",
    createdAt: new Date(),
  },
  {
    _id: "acad_3rd_3",
    id: "acad_3rd_3",
    subjectName: "Operating Systems",
    subjectCode: "CS303",
    semester: "Semester 5",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "3rd Year",
    academicYear: "3rd Year",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    createdAt: new Date(),
  },

  // 4th Year Subjects
  {
    _id: "acad_4th_1",
    id: "acad_4th_1",
    subjectName: "Cloud Computing & DevOps",
    subjectCode: "CS401",
    semester: "Semester 7",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "4th Year",
    academicYear: "4th Year",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    createdAt: new Date(),
  },
  {
    _id: "acad_4th_2",
    id: "acad_4th_2",
    subjectName: "Machine Learning & Neural Networks",
    subjectCode: "CS402",
    semester: "Semester 7",
    department: "Computer Science",
    academicDepartment: "Computer Science",
    year: "4th Year",
    academicYear: "4th Year",
    facultyId: "usr_faculty_5",
    facultyName: "Prof. Geoffrey Hinton",
    createdAt: new Date(),
  },
];

// @route   GET /api/academic (also aliases /subjects and /api/subjects)
// @desc    Get subjects with year, semester, department, and faculty filtering
// @access  Public
router.get("/", async (req, res) => {
  try {
    const { year, semester, department, facultyId, facultyName } = req.query;

    const targetYear = normalizeYear(year);
    const targetSem = normalizeSemester(semester);

    let records = [];

    // Query MongoDB
    try {
      let filter = {};
      if (targetYear) {
        filter.$or = [{ year: targetYear }, { year: year }];
      }
      if (targetSem) {
        filter.semester = targetSem;
      }
      if (department && department !== "All Departments") {
        filter.department = department;
      }
      if (facultyId) {
        filter.facultyId = facultyId;
      }

      records = await Academic.find(filter).sort({ createdAt: -1 });
    } catch (dbErr) {
      // Memory fallback
    }

    if (!records || records.length === 0) {
      records = inMemoryAcademics.filter((item) => {
        // Year filter
        if (targetYear) {
          const itemNormYear = normalizeYear(item.year || item.academicYear);
          if (itemNormYear !== targetYear && item.year !== year && item.academicYear !== year) {
            return false;
          }
        }

        // Semester filter
        if (targetSem) {
          const itemNormSem = normalizeSemester(item.semester);
          if (itemNormSem !== targetSem && item.semester !== semester) {
            return false;
          }
        }

        // Department filter
        if (department && department !== "All Departments") {
          const itemDept = (item.department || item.academicDepartment || "").toLowerCase();
          if (itemDept !== department.toLowerCase()) {
            return false;
          }
        }

        // Faculty filter
        if (facultyId && item.facultyId && item.facultyId !== facultyId) {
          return false;
        }

        return true;
      });
    }

    return res.status(200).json(records);
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
// @desc    Add a new academic record with year, semester, department, and facultyId
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
      facultyId,
      facultyName,
    } = req.body;

    const finalDepartment = academicDepartment || department;
    const rawYear = academicYear || year;
    const finalYear = normalizeYear(rawYear) || rawYear;
    const finalSemester = normalizeSemester(semester) || semester;

    // Field validation
    if (!subjectName || !subjectCode || !finalSemester || !finalDepartment || !finalYear) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: subjectName, subjectCode, semester, department, and year.",
      });
    }

    const newRecordData = {
      subjectName: subjectName.trim(),
      subjectCode: subjectCode.trim(),
      semester: finalSemester.trim(),
      department: finalDepartment.trim(),
      academicDepartment: finalDepartment.trim(),
      year: finalYear.trim(),
      academicYear: finalYear.trim(),
      facultyId: facultyId || "usr_faculty_1",
      facultyName: (facultyName || "Faculty Member").trim(),
      createdAt: new Date(),
    };

    // Save to MongoDB
    try {
      const academicRecord = new Academic(newRecordData);
      const savedRecord = await academicRecord.save();
      inMemoryAcademics.unshift(savedRecord);
      return res.status(201).json(savedRecord);
    } catch (dbErr) {
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

    try {
      await Academic.findByIdAndDelete(id);
    } catch (dbErr) {}

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
