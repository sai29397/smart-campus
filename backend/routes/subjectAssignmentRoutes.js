const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const SubjectAssignment = require("../models/SubjectAssignment");
const { protect } = require("../middleware/authMiddleware");

const dataDir = path.join(__dirname, "../data");
const subjectsFilePath = path.join(dataDir, "subjects.json");
const usersFilePath = path.join(dataDir, "users.json");

// Initial curriculum subjects with targeted assignments
const defaultSubjectAssignments = [
  {
    _id: "sub_101",
    id: "sub_101",
    subjectName: "Engineering Mathematics I",
    subjectCode: "MA101",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    department: "Computer Science",
    assignmentType: "entire_year",
    studentIds: [],
    years: ["1st Year"],
    specializations: ["General CSE", "Artificial Intelligence and Machine Learning", "Data Science"],
    semester: "Semester 1",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "sub_102",
    id: "sub_102",
    subjectName: "Programming in C & Data Structures",
    subjectCode: "CS102",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    department: "Computer Science",
    assignmentType: "entire_year",
    studentIds: [],
    years: ["1st Year"],
    specializations: ["General CSE", "Artificial Intelligence and Machine Learning", "Data Science", "Cyber Security"],
    semester: "Semester 1",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "sub_201",
    id: "sub_201",
    subjectName: "Object-Oriented Programming (Java)",
    subjectCode: "CS201",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    department: "Computer Science",
    assignmentType: "entire_year",
    studentIds: [],
    years: ["2nd Year"],
    specializations: ["General CSE", "Software Engineering"],
    semester: "Semester 3",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "sub_301",
    id: "sub_301",
    subjectName: "Machine Learning & Deep Neural Nets",
    subjectCode: "CSML301",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    department: "Computer Science",
    assignmentType: "specialization",
    studentIds: [],
    years: ["3rd Year"],
    specializations: ["Artificial Intelligence and Machine Learning"],
    semester: "Semester 5",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "sub_302",
    id: "sub_302",
    subjectName: "Big Data Analytics & Data Warehousing",
    subjectCode: "CSDS302",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    department: "Computer Science",
    assignmentType: "specialization",
    studentIds: [],
    years: ["3rd Year"],
    specializations: ["Data Science"],
    semester: "Semester 5",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "sub_303",
    id: "sub_303",
    subjectName: "Applied Artificial Intelligence",
    subjectCode: "CSAI401",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    department: "Computer Science",
    assignmentType: "multiple_years",
    studentIds: [],
    years: ["3rd Year", "4th Year"],
    specializations: ["Artificial Intelligence and Machine Learning", "Data Science"],
    semester: "Semester 6",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "sub_401",
    id: "sub_401",
    subjectName: "Cloud Computing & DevOps Architecture",
    subjectCode: "CSCC401",
    facultyId: "usr_faculty_1",
    facultyName: "Dr. Sarah Jenkins",
    department: "Computer Science",
    assignmentType: "specialization",
    studentIds: [],
    years: ["4th Year"],
    specializations: ["Cloud Computing"],
    semester: "Semester 7",
    createdAt: new Date().toISOString(),
  },
];

function loadServerSubjects() {
  try {
    if (fs.existsSync(subjectsFilePath)) {
      const data = fs.readFileSync(subjectsFilePath, "utf8");
      const list = JSON.parse(data);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) {}

  saveServerSubjects(defaultSubjectAssignments);
  return defaultSubjectAssignments;
}

function saveServerSubjects(list) {
  try {
    fs.writeFileSync(subjectsFilePath, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {}
}

function loadServerUsers() {
  try {
    if (fs.existsSync(usersFilePath)) {
      return JSON.parse(fs.readFileSync(usersFilePath, "utf8")) || [];
    }
  } catch (e) {}
  return [];
}

let inMemorySubjects = loadServerSubjects();

// Helper to normalize year string/number
function normalizeYear(yearInput) {
  if (!yearInput) return "";
  const str = String(yearInput).trim().toLowerCase();
  if (str === "1" || str.includes("1st")) return "1st Year";
  if (str === "2" || str.includes("2nd")) return "2nd Year";
  if (str === "3" || str.includes("3rd")) return "3rd Year";
  if (str === "4" || str.includes("4th")) return "4th Year";
  return yearInput;
}

// ==========================================================================
// 1. ASSIGN SUBJECT (Faculty endpoint)
// ==========================================================================
router.post("/assign", protect, async (req, res) => {
  try {
    const {
      subjectName,
      subjectCode,
      assignmentType,
      studentIds,
      years,
      specializations,
      semester,
      department,
    } = req.body;

    if (!subjectName || !subjectCode) {
      return res.status(400).json({ success: false, message: "Subject Name and Code are required." });
    }

    const facultyId = req.user._id || req.user.id || "usr_faculty_1";
    const facultyName = req.user.name || "Dr. Sarah Jenkins";

    // Normalize years array
    let normalizedYears = [];
    if (Array.isArray(years) && years.length > 0) {
      normalizedYears = years.map(normalizeYear);
    } else if (req.body.year) {
      normalizedYears = [normalizeYear(req.body.year)];
    } else {
      normalizedYears = ["1st Year"];
    }

    let studentIdList = [];
    if (Array.isArray(studentIds)) {
      studentIdList = studentIds;
    } else if (req.body.studentId) {
      studentIdList = [req.body.studentId];
    }

    let specializationList = [];
    if (Array.isArray(specializations)) {
      specializationList = specializations;
    } else if (req.body.specialization) {
      specializationList = [req.body.specialization];
    }

    const newAssignment = {
      _id: "sub_" + Date.now(),
      id: "sub_" + Date.now(),
      subjectName: subjectName.trim(),
      subjectCode: subjectCode.trim(),
      facultyId: String(facultyId),
      facultyName: facultyName.trim(),
      department: department || req.user.department || "Computer Science",
      assignmentType: assignmentType || "entire_year",
      studentIds: studentIdList,
      years: normalizedYears,
      specializations: specializationList,
      semester: semester || "Semester 1",
      createdAt: new Date().toISOString(),
    };

    // Save to MongoDB if available
    try {
      const dbRecord = await SubjectAssignment.create(newAssignment);
      newAssignment._id = dbRecord._id.toString();
    } catch (dbErr) {}

    // Save permanently to server
    inMemorySubjects = loadServerSubjects();
    inMemorySubjects.unshift(newAssignment);
    saveServerSubjects(inMemorySubjects);

    return res.status(201).json({
      success: true,
      message: `Subject "${subjectName}" assigned successfully!`,
      assignment: newAssignment,
    });
  } catch (error) {
    console.error("Assign Subject Error:", error);
    res.status(500).json({ success: false, message: "Server error while assigning subject." });
  }
});

// ==========================================================================
// 2. GET STUDENT'S ASSIGNED SUBJECTS (Strict backend filtering)
// ==========================================================================
router.get("/student", protect, (req, res) => {
  try {
    const student = req.user;
    const studentId = String(student._id || student.id);
    const studentYear = normalizeYear(student.year || "1st Year");
    const studentSpec = student.specialization || "General CSE";

    inMemorySubjects = loadServerSubjects();

    const assignedSubjects = inMemorySubjects.filter((sub) => {
      // 1. Specific student assignment
      if (sub.assignmentType === "specific_student" || sub.assignmentType === "multiple_students") {
        return Array.isArray(sub.studentIds) && sub.studentIds.map(String).includes(studentId);
      }

      // Check year match
      const subYears = Array.isArray(sub.years) ? sub.years.map(normalizeYear) : [normalizeYear(sub.year)];
      const yearMatches = subYears.includes(studentYear) || subYears.includes("All Years");

      if (!yearMatches) return false;

      // 2. Specialization-based assignment
      if (sub.assignmentType === "specialization") {
        if (!Array.isArray(sub.specializations) || sub.specializations.length === 0) {
          return true;
        }
        return sub.specializations.some(
          (spec) => spec.toLowerCase().trim() === studentSpec.toLowerCase().trim()
        );
      }

      // 3. Entire year or Multiple years assignment
      if (sub.assignmentType === "entire_year" || sub.assignmentType === "multiple_years") {
        if (Array.isArray(sub.specializations) && sub.specializations.length > 0) {
          return sub.specializations.some(
            (spec) => spec.toLowerCase().trim() === studentSpec.toLowerCase().trim()
          );
        }
        return true;
      }

      return yearMatches;
    });

    return res.json(assignedSubjects);
  } catch (error) {
    console.error("Get Student Subjects Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch student subjects." });
  }
});

// ==========================================================================
// 3. GET FACULTY'S SUBJECTS
// ==========================================================================
router.get("/faculty", protect, (req, res) => {
  try {
    const facultyId = String(req.user._id || req.user.id);
    inMemorySubjects = loadServerSubjects();

    const facultySubjects = inMemorySubjects.filter(
      (sub) => String(sub.facultyId) === facultyId || String(sub.facultyId) === "usr_faculty_1" || req.user.role === "admin"
    );

    return res.json(facultySubjects);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch faculty subjects." });
  }
});

// ==========================================================================
// 4. GET ASSIGNED STUDENTS FOR A SUBJECT (Roster for Attendance & Chat)
// ==========================================================================
router.get("/assigned-students/:subjectId", protect, (req, res) => {
  try {
    const { subjectId } = req.params;
    inMemorySubjects = loadServerSubjects();
    const allUsers = loadServerUsers();

    const subject = inMemorySubjects.find((s) => s._id === subjectId || s.id === subjectId);

    if (!subject) {
      return res.status(404).json({ success: false, message: "Subject not found." });
    }

    const students = allUsers.filter((u) => u.role === "student");

    let eligibleStudents = [];

    if (subject.assignmentType === "specific_student" || subject.assignmentType === "multiple_students") {
      eligibleStudents = students.filter((st) => {
        const sid = String(st._id || st.id);
        return subject.studentIds.map(String).includes(sid);
      });
    } else {
      const subYears = Array.isArray(subject.years) ? subject.years.map(normalizeYear) : [normalizeYear(subject.year)];

      eligibleStudents = students.filter((st) => {
        const stYear = normalizeYear(st.year);
        const yearMatches = subYears.includes(stYear);
        if (!yearMatches) return false;

        if (Array.isArray(subject.specializations) && subject.specializations.length > 0) {
          const stSpec = st.specialization || "General CSE";
          return subject.specializations.some((s) => s.toLowerCase() === stSpec.toLowerCase());
        }

        return true;
      });
    }

    return res.json(
      eligibleStudents.map((st) => ({
        id: st._id || st.id,
        _id: st._id || st.id,
        name: st.name,
        email: st.email,
        year: st.year,
        department: st.department,
        specialization: st.specialization || "General CSE",
      }))
    );
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch assigned students." });
  }
});

// ==========================================================================
// 5. SEARCH ELIGIBLE STUDENTS (For Faculty Assignment Autocomplete)
// ==========================================================================
router.get("/eligible-students", protect, (req, res) => {
  try {
    const { year, search, specialization } = req.query;
    const allUsers = loadServerUsers();
    let students = allUsers.filter((u) => u.role === "student");

    if (year && year !== "All Years") {
      const targetYear = normalizeYear(year);
      students = students.filter((s) => normalizeYear(s.year) === targetYear);
    }

    if (specialization && specialization !== "All Specializations") {
      students = students.filter(
        (s) => (s.specialization || "General CSE").toLowerCase() === specialization.toLowerCase()
      );
    }

    if (search) {
      const q = search.toLowerCase().trim();
      students = students.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          String(s._id || s.id).includes(q)
      );
    }

    return res.json(
      students.map((s) => ({
        id: s._id || s.id,
        _id: s._id || s.id,
        name: s.name,
        email: s.email,
        year: s.year,
        department: s.department,
        specialization: s.specialization || "General CSE",
      }))
    );
  } catch (error) {
    res.status(500).json({ success: false, message: "Error searching students." });
  }
});

// ==========================================================================
// 6. ADD STUDENT DIRECTLY FROM FACULTY DASHBOARD
// ==========================================================================
router.post("/add-student", protect, async (req, res) => {
  try {
    const { name, email, department, year, specialization, password } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Student Name and Email Address are required.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const bcrypt = require("bcryptjs");
    const User = require("../models/User");

    const users = loadServerUsers();
    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Student with email "${email}" already exists in the system.`,
      });
    }

    const userPassword = password || "student123";
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userPassword, salt);

    const newStudent = {
      _id: "usr_" + Date.now(),
      id: "usr_" + Date.now(),
      name: name.trim(),
      email: cleanEmail,
      password: userPassword,
      passwordHash: passwordHash,
      role: "student",
      department: department || req.user.department || "Computer Science",
      year: normalizeYear(year || "1st Year"),
      specialization: specialization || "General CSE",
      createdAt: new Date().toISOString(),
    };

    // Try MongoDB
    try {
      const dbUser = await User.create(newStudent);
      newStudent._id = dbUser._id.toString();
    } catch (dbErr) {}

    users.push(newStudent);
    try {
      fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), "utf8");
    } catch (e) {}

    return res.status(201).json({
      success: true,
      message: `Student "${name}" successfully added to the platform!`,
      student: {
        id: newStudent._id,
        _id: newStudent._id,
        name: newStudent.name,
        email: newStudent.email,
        department: newStudent.department,
        year: newStudent.year,
        specialization: newStudent.specialization,
      },
    });
  } catch (error) {
    console.error("Add Student Error:", error);
    res.status(500).json({ success: false, message: "Failed to add student." });
  }
});

module.exports = router;
