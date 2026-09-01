const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const Attendance = require("../models/Attendance");
const { protect } = require("../middleware/authMiddleware");

const dataDir = path.join(__dirname, "../data");
const attendanceFilePath = path.join(dataDir, "attendance.json");

// Helper to load server attendance records
function loadServerAttendance() {
  try {
    if (fs.existsSync(attendanceFilePath)) {
      const data = fs.readFileSync(attendanceFilePath, "utf8");
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}

  // Initial demo attendance seed
  const initialAttendance = [
    {
      _id: "att_1",
      id: "att_1",
      studentId: "usr_student_1",
      studentName: "Alex Johnson",
      studentEmail: "student@campus.edu",
      subjectId: "sub_101",
      subjectName: "Engineering Mathematics I",
      facultyId: "usr_faculty_1",
      date: new Date().toISOString().split("T")[0],
      status: "Present",
      year: "1st Year",
      specialization: "General CSE",
      markedAt: new Date().toISOString(),
    },
    {
      _id: "att_2",
      id: "att_2",
      studentId: "usr_student_1",
      studentName: "Alex Johnson",
      studentEmail: "student@campus.edu",
      subjectId: "sub_102",
      subjectName: "Programming in C & Data Structures",
      facultyId: "usr_faculty_1",
      date: new Date().toISOString().split("T")[0],
      status: "Present",
      year: "1st Year",
      specialization: "General CSE",
      markedAt: new Date().toISOString(),
    },
  ];
  saveServerAttendance(initialAttendance);
  return initialAttendance;
}

function saveServerAttendance(list) {
  try {
    fs.writeFileSync(attendanceFilePath, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {}
}

let inMemoryAttendance = loadServerAttendance();

// ==========================================================================
// 1. MARK ATTENDANCE (Faculty Batch or Single)
// ==========================================================================
router.post("/", protect, async (req, res) => {
  try {
    const { subjectId, subjectName, date, attendanceList } = req.body;

    if (!subjectId || !date || !attendanceList || !Array.isArray(attendanceList) || attendanceList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Subject ID, Date (YYYY-MM-DD), and Attendance list of students are required.",
      });
    }

    const facultyId = String(req.user._id || req.user.id || "usr_faculty_1");
    const targetDate = date.trim();

    inMemoryAttendance = loadServerAttendance();
    const savedRecords = [];
    let updatedCount = 0;
    let newCount = 0;

    for (const item of attendanceList) {
      const studentId = String(item.studentId || item.id || item._id);
      const studentName = item.studentName || item.name || "Student";
      const studentEmail = item.studentEmail || item.email || "";
      const status = item.status === "Absent" ? "Absent" : "Present";
      const year = item.year || "1st Year";
      const specialization = item.specialization || "General CSE";

      // Check if attendance already exists for same student + subject + date
      const existingIndex = inMemoryAttendance.findIndex(
        (a) => String(a.studentId) === studentId && String(a.subjectId) === String(subjectId) && a.date === targetDate
      );

      if (existingIndex !== -1) {
        // Update existing attendance
        inMemoryAttendance[existingIndex].status = status;
        inMemoryAttendance[existingIndex].markedAt = new Date().toISOString();
        savedRecords.push(inMemoryAttendance[existingIndex]);
        updatedCount++;
      } else {
        // Create new record
        const newRecord = {
          _id: "att_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          id: "att_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          studentId,
          studentName,
          studentEmail,
          subjectId: String(subjectId),
          subjectName: subjectName || "Subject",
          facultyId,
          date: targetDate,
          status,
          year,
          specialization,
          markedAt: new Date().toISOString(),
        };

        // Try MongoDB save
        try {
          const dbAtt = await Attendance.create(newRecord);
          newRecord._id = dbAtt._id.toString();
        } catch (dbErr) {}

        inMemoryAttendance.unshift(newRecord);
        savedRecords.push(newRecord);
        newCount++;
      }
    }

    saveServerAttendance(inMemoryAttendance);

    return res.status(201).json({
      success: true,
      message: `Attendance saved for ${savedRecords.length} students (${newCount} new, ${updatedCount} updated) on ${targetDate}!`,
      records: savedRecords,
    });
  } catch (error) {
    console.error("Save Attendance Error:", error);
    res.status(500).json({ success: false, message: "Server error while saving attendance." });
  }
});

// ==========================================================================
// 2. GET STUDENT'S ATTENDANCE ANALYTICS (Subject-wise statistics)
// ==========================================================================
router.get("/student", protect, (req, res) => {
  try {
    const studentId = String(req.user._id || req.user.id);
    inMemoryAttendance = loadServerAttendance();

    const studentRecords = inMemoryAttendance.filter((a) => String(a.studentId) === studentId);

    // Group stats by subject
    const subjectStatsMap = {};

    studentRecords.forEach((rec) => {
      const subId = rec.subjectId;
      if (!subjectStatsMap[subId]) {
        subjectStatsMap[subId] = {
          subjectId: subId,
          subjectName: rec.subjectName || "Subject",
          totalClasses: 0,
          classesPresent: 0,
          classesAbsent: 0,
          records: [],
        };
      }

      subjectStatsMap[subId].totalClasses += 1;
      if (rec.status === "Present") {
        subjectStatsMap[subId].classesPresent += 1;
      } else {
        subjectStatsMap[subId].classesAbsent += 1;
      }

      subjectStatsMap[subId].records.push({
        date: rec.date,
        status: rec.status,
      });
    });

    const summaryList = Object.values(subjectStatsMap).map((item) => {
      const percentage = item.totalClasses > 0 ? ((item.classesPresent / item.totalClasses) * 100).toFixed(1) : "0.0";
      return {
        ...item,
        percentage: parseFloat(percentage),
      };
    });

    return res.json({
      success: true,
      studentId,
      totalSubjectsTracked: summaryList.length,
      attendanceSummary: summaryList,
    });
  } catch (error) {
    console.error("Get Student Attendance Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch student attendance." });
  }
});

// ==========================================================================
// 3. GET FACULTY ATTENDANCE ROSTER BY SUBJECT & DATE
// ==========================================================================
router.get("/faculty/:subjectId", protect, (req, res) => {
  try {
    const { subjectId } = req.params;
    const { date } = req.query;

    inMemoryAttendance = loadServerAttendance();

    let records = inMemoryAttendance.filter((a) => String(a.subjectId) === String(subjectId));

    if (date) {
      records = records.filter((a) => a.date === date.trim());
    }

    return res.json(records);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch subject attendance." });
  }
});

// ==========================================================================
// 4. EDIT ATTENDANCE RECORD
// ==========================================================================
router.put("/:attendanceId", protect, async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { status } = req.body;

    if (!status || (status !== "Present" && status !== "Absent")) {
      return res.status(400).json({ success: false, message: "Status must be 'Present' or 'Absent'." });
    }

    inMemoryAttendance = loadServerAttendance();
    const record = inMemoryAttendance.find((a) => a._id === attendanceId || a.id === attendanceId);

    if (!record) {
      return res.status(404).json({ success: false, message: "Attendance record not found." });
    }

    record.status = status;
    record.markedAt = new Date().toISOString();
    saveServerAttendance(inMemoryAttendance);

    try {
      await Attendance.findByIdAndUpdate(attendanceId, { status, markedAt: new Date() });
    } catch (e) {}

    return res.json({ success: true, message: "Attendance status updated.", record });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating attendance." });
  }
});

module.exports = router;
