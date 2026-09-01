const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const ClassSchedule = require("../models/ClassSchedule");
const { protect } = require("../middleware/authMiddleware");

const dataDir = path.join(__dirname, "../data");
const classesFilePath = path.join(dataDir, "classes.json");
const announcementsFilePath = path.join(dataDir, "announcements.json");

// Helper to push automatic campus notifications for class updates
function pushClassNotification({ title, description, department, year, priority = "Important", author = "Campus Administration" }) {
  try {
    let announcements = [];
    if (fs.existsSync(announcementsFilePath)) {
      announcements = JSON.parse(fs.readFileSync(announcementsFilePath, "utf8")) || [];
    }

    const newNotice = {
      _id: "ann_cls_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      id: "ann_cls_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      title,
      description,
      department: department || "All Departments",
      year: year || "All Years",
      priority,
      author,
      createdAt: new Date().toISOString(),
    };

    announcements.unshift(newNotice);
    fs.writeFileSync(announcementsFilePath, JSON.stringify(announcements, null, 2), "utf8");
  } catch (err) {
    console.error("Error creating class announcement:", err);
  }
}

// Helper to load class schedules from server disk
function loadServerClasses() {
  try {
    if (fs.existsSync(classesFilePath)) {
      const data = fs.readFileSync(classesFilePath, "utf8");
      const list = JSON.parse(data);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) {}

  // Default seed class schedules
  const defaultClasses = [
    {
      _id: "cls_101",
      id: "cls_101",
      subjectId: "sub_101",
      subjectName: "Engineering Mathematics I",
      subjectCode: "MA101",
      facultyId: "usr_faculty_1",
      facultyName: "Dr. Sarah Jenkins",
      facultyEmail: "faculty@campus.edu",
      years: ["1st Year"],
      specialization: "General CSE",
      department: "Computer Science",
      section: "Section A",
      date: "2026-09-05",
      startTime: "09:00 AM",
      endTime: "10:00 AM",
      block: "A Block",
      floor: "2nd Floor",
      roomNumber: "A-201",
      venue: "A Block – 2nd Floor – Room A-201",
      status: "Scheduled",
      cancellationReason: "",
      previousSchedule: null,
      createdBy: "Campus Administration",
      createdAt: "2026-09-01T08:00:00.000Z",
    },
    {
      _id: "cls_102",
      id: "cls_102",
      subjectId: "sub_102",
      subjectName: "Programming in C & Data Structures",
      subjectCode: "CS102",
      facultyId: "usr_faculty_1",
      facultyName: "Dr. Sarah Jenkins",
      facultyEmail: "faculty@campus.edu",
      years: ["1st Year"],
      specialization: "General CSE",
      department: "Computer Science",
      section: "Section A",
      date: "2026-09-05",
      startTime: "10:15 AM",
      endTime: "11:15 AM",
      block: "A Block",
      floor: "1st Floor",
      roomNumber: "A-108",
      venue: "A Block – 1st Floor – Room A-108",
      status: "Scheduled",
      cancellationReason: "",
      previousSchedule: null,
      createdBy: "Campus Administration",
      createdAt: "2026-09-01T08:30:00.000Z",
    },
    {
      _id: "cls_301",
      id: "cls_301",
      subjectId: "sub_1788290829094",
      subjectName: "Machine Learning & Deep Neural Nets",
      subjectCode: "CSML301",
      facultyId: "usr_faculty_1",
      facultyName: "Dr. Sarah Jenkins",
      facultyEmail: "faculty@campus.edu",
      years: ["3rd Year"],
      specialization: "Artificial Intelligence and Machine Learning",
      department: "Computer Science",
      section: "Section A",
      date: "2026-09-05",
      startTime: "11:30 AM",
      endTime: "12:30 PM",
      block: "B Block",
      floor: "3rd Floor",
      roomNumber: "B-304",
      venue: "B Block – 3rd Floor – Room B-304",
      status: "Scheduled",
      cancellationReason: "",
      previousSchedule: null,
      createdBy: "Campus Administration",
      createdAt: "2026-09-01T09:00:00.000Z",
    },
    {
      _id: "cls_302",
      id: "cls_302",
      subjectId: "sub_1788290829080",
      subjectName: "Deep Neural Nets Lab",
      subjectCode: "CSAI309",
      facultyId: "usr_faculty_1",
      facultyName: "Dr. Sarah Jenkins",
      facultyEmail: "faculty@campus.edu",
      years: ["3rd Year"],
      specialization: "Artificial Intelligence and Machine Learning",
      department: "Computer Science",
      section: "Section A",
      date: "2026-09-05",
      startTime: "02:00 PM",
      endTime: "04:00 PM",
      block: "C Block",
      floor: "Ground Floor",
      roomNumber: "AI-Lab-01",
      venue: "C Block – Ground Floor – Room AI-Lab-01",
      status: "Scheduled",
      cancellationReason: "",
      previousSchedule: null,
      createdBy: "Campus Administration",
      createdAt: "2026-09-01T09:30:00.000Z",
    },
  ];

  saveServerClasses(defaultClasses);
  return defaultClasses;
}

function saveServerClasses(list) {
  try {
    fs.writeFileSync(classesFilePath, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {}
}

let inMemoryClasses = loadServerClasses();

// Helper to format clean venue string
function formatVenueString(block, floor, roomNumber) {
  const b = block ? block.trim() : "Main Block";
  const f = floor ? floor.trim() : "1st Floor";
  const r = roomNumber ? roomNumber.trim() : "Room 101";
  return `${b} – ${f} – Room ${r.replace(/^Room\s*/i, "")}`;
}

// ==========================================================================
// 1. GET ALL CLASSES (Administration View & Filtered Listing)
// ==========================================================================
router.get("/", protect, (req, res) => {
  try {
    const { year, department, specialization, status, date } = req.query;
    inMemoryClasses = loadServerClasses();

    let filtered = inMemoryClasses;

    if (year && year !== "All Years") {
      filtered = filtered.filter((c) => Array.isArray(c.years) && c.years.includes(year));
    }

    if (department && department !== "All Departments") {
      filtered = filtered.filter((c) => (c.department || "").toLowerCase() === department.toLowerCase());
    }

    if (specialization && specialization !== "All Specializations") {
      filtered = filtered.filter(
        (c) =>
          !c.specialization ||
          c.specialization === "All Specializations" ||
          c.specialization.toLowerCase() === specialization.toLowerCase()
      );
    }

    if (status && status !== "All") {
      filtered = filtered.filter((c) => c.status === status);
    }

    if (date) {
      filtered = filtered.filter((c) => c.date === date);
    }

    return res.json({
      success: true,
      count: filtered.length,
      classes: filtered.sort((a, b) => (a.date > b.date ? 1 : -1)),
    });
  } catch (error) {
    console.error("Get Classes Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch class schedules." });
  }
});

// ==========================================================================
// 2. GET STUDENT'S RELEVANT CLASSES (Filtered Strictly by Year, Dept & Spec)
// ==========================================================================
router.get("/student", protect, (req, res) => {
  try {
    const studentYear = req.user.year || "1st Year";
    const studentDept = req.user.department || "Computer Science";
    const studentSpec = req.user.specialization || "General CSE";
    const studentSection = req.user.section || "Section A";

    inMemoryClasses = loadServerClasses();

    const relevantClasses = inMemoryClasses.filter((c) => {
      // 1. Year Match
      const matchesYear =
        !c.years ||
        c.years.length === 0 ||
        c.years.includes("All Years") ||
        c.years.some((y) => y && (y.toLowerCase() === studentYear.toLowerCase() || studentYear.toLowerCase().includes(y.toLowerCase())));

      if (!matchesYear) return false;

      // 2. Department Match
      const matchesDept =
        !c.department ||
        c.department === "All Departments" ||
        c.department.toLowerCase() === "all" ||
        c.department.toLowerCase() === studentDept.toLowerCase() ||
        studentDept.toLowerCase().includes(c.department.toLowerCase()) ||
        c.department.toLowerCase().includes(studentDept.toLowerCase());

      // 3. Specialization Match
      const matchesSpec =
        !c.specialization ||
        c.specialization === "All Specializations" ||
        c.specialization === "General CSE" ||
        c.specialization.toLowerCase() === "all" ||
        c.specialization.toLowerCase() === studentSpec.toLowerCase() ||
        studentSpec.toLowerCase().includes(c.specialization.toLowerCase()) ||
        c.specialization.toLowerCase().includes(studentSpec.toLowerCase());

      return matchesDept || matchesSpec;
    });

    return res.json({
      success: true,
      student: {
        name: req.user.name,
        year: studentYear,
        department: studentDept,
        specialization: studentSpec,
      },
      count: relevantClasses.length,
      classes: relevantClasses.sort((a, b) => (a.date > b.date ? 1 : -1)),
    });
  } catch (error) {
    console.error("Get Student Classes Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch student classes." });
  }
});

// ==========================================================================
// 3. GET FACULTY'S ASSIGNED CLASSES
// ==========================================================================
router.get("/faculty", protect, (req, res) => {
  try {
    const facultyId = String(req.user._id || req.user.id);
    const facultyEmail = req.user.email ? req.user.email.toLowerCase().trim() : "";
    const facultyName = req.user.name ? req.user.name.toLowerCase().trim() : "";

    inMemoryClasses = loadServerClasses();

    let facultyClasses = inMemoryClasses.filter((c) => {
      const matchId = String(c.facultyId) === facultyId;
      const matchEmail = facultyEmail && c.facultyEmail && c.facultyEmail.toLowerCase().trim() === facultyEmail;
      const matchName = facultyName && c.facultyName && c.facultyName.toLowerCase().trim() === facultyName;
      return matchId || matchEmail || matchName;
    });

    // Fallback: If this faculty member doesn't have custom classes yet, return default department classes
    if (facultyClasses.length === 0) {
      facultyClasses = inMemoryClasses;
    }

    return res.json({
      success: true,
      facultyId,
      count: facultyClasses.length,
      classes: facultyClasses.sort((a, b) => (a.date > b.date ? 1 : -1)),
    });
  } catch (error) {
    console.error("Get Faculty Classes Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch faculty classes." });
  }
});

// ==========================================================================
// 4. GET SINGLE CLASS DETAILS
// ==========================================================================
router.get("/:classId", protect, (req, res) => {
  try {
    const { classId } = req.params;
    inMemoryClasses = loadServerClasses();

    const cls = inMemoryClasses.find((c) => c._id === classId || c.id === classId);
    if (!cls) {
      return res.status(404).json({ success: false, message: "Class schedule not found." });
    }

    return res.json({ success: true, class: cls });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch class." });
  }
});

// ==========================================================================
// 5. CREATE CLASS SCHEDULE (Administration Permission Only)
// ==========================================================================
router.post("/", protect, async (req, res) => {
  try {
    const userRole = (req.user.role || "").toLowerCase();
    if (userRole !== "admin" && userRole !== "administration") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: Only Administration can create class schedules.",
      });
    }

    const {
      subjectName,
      subjectCode,
      subjectId,
      facultyId,
      facultyName,
      facultyEmail,
      years,
      specialization,
      department,
      section,
      date,
      startTime,
      endTime,
      block,
      floor,
      roomNumber,
      venue,
    } = req.body;

    if (!subjectName || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Subject Name, Date, Start Time, and End Time are required.",
      });
    }

    const assignedYears = Array.isArray(years) && years.length > 0 ? years : ["1st Year"];
    const formattedVenue = venue || formatVenueString(block, floor, roomNumber);

    const newClass = {
      _id: "cls_" + Date.now(),
      id: "cls_" + Date.now(),
      subjectId: subjectId || "sub_" + Date.now(),
      subjectName: subjectName.trim(),
      subjectCode: (subjectCode || "SUB101").trim().toUpperCase(),
      facultyId: facultyId || "usr_faculty_1",
      facultyName: facultyName || "Dr. Sarah Jenkins",
      facultyEmail: facultyEmail || "faculty@campus.edu",
      years: assignedYears,
      specialization: specialization || "All Specializations",
      department: department || "Computer Science",
      section: section || "Section A",
      date: date.trim(),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      block: block || "A Block",
      floor: floor || "1st Floor",
      roomNumber: roomNumber || "A-101",
      venue: formattedVenue,
      status: "Scheduled",
      cancellationReason: "",
      previousSchedule: null,
      createdBy: req.user.name || "Campus Administration",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const dbCls = await ClassSchedule.create(newClass);
      newClass._id = dbCls._id.toString();
    } catch (dbErr) {}

    inMemoryClasses = loadServerClasses();
    inMemoryClasses.unshift(newClass);
    saveServerClasses(inMemoryClasses);

    // Automatically send notification
    pushClassNotification({
      title: `📅 New Class Scheduled: ${newClass.subjectName} (${newClass.subjectCode})`,
      description: `Class is scheduled for ${assignedYears.join(", ")} (${newClass.specialization}) on ${newClass.date} from ${newClass.startTime} to ${newClass.endTime} at ${newClass.venue}. Faculty: ${newClass.facultyName}.`,
      department: newClass.department,
      year: assignedYears[0],
      priority: "Normal",
      author: "Campus Administration",
    });

    return res.status(201).json({
      success: true,
      message: `Class schedule for "${newClass.subjectName}" created successfully!`,
      class: newClass,
    });
  } catch (error) {
    console.error("Create Class Error:", error);
    res.status(500).json({ success: false, message: "Server error creating class schedule." });
  }
});

// ==========================================================================
// 6. UPDATE CLASSROOM LOCATION & VENUE (Administration Only)
// ==========================================================================
router.put("/:classId", protect, async (req, res) => {
  try {
    const userRole = (req.user.role || "").toLowerCase();
    if (userRole !== "admin" && userRole !== "administration") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: Only Administration can update classroom venues.",
      });
    }

    const { classId } = req.params;
    const { block, floor, roomNumber, venue, date, startTime, endTime } = req.body;

    inMemoryClasses = loadServerClasses();
    const cls = inMemoryClasses.find((c) => c._id === classId || c.id === classId);

    if (!cls) {
      return res.status(404).json({ success: false, message: "Class schedule not found." });
    }

    const previousVenue = cls.venue;

    if (block) cls.block = block.trim();
    if (floor) cls.floor = floor.trim();
    if (roomNumber) cls.roomNumber = roomNumber.trim();
    if (date) cls.date = date.trim();
    if (startTime) cls.startTime = startTime.trim();
    if (endTime) cls.endTime = endTime.trim();

    cls.venue = venue || formatVenueString(cls.block, cls.floor, cls.roomNumber);
    cls.updatedAt = new Date().toISOString();

    saveServerClasses(inMemoryClasses);

    try {
      await ClassSchedule.findByIdAndUpdate(classId, {
        block: cls.block,
        floor: cls.floor,
        roomNumber: cls.roomNumber,
        venue: cls.venue,
        date: cls.date,
        startTime: cls.startTime,
        endTime: cls.endTime,
        updatedAt: new Date(),
      });
    } catch (e) {}

    // Dispatch classroom change notification
    pushClassNotification({
      title: `🏛️ Classroom Updated: ${cls.subjectName} (${cls.subjectCode})`,
      description: `Your ${cls.subjectName} class venue has been changed.\nPrevious Venue: ${previousVenue}\nNew Venue: ${cls.venue}\nDate & Time: ${cls.date} (${cls.startTime} – ${cls.endTime}).`,
      department: cls.department,
      year: Array.isArray(cls.years) ? cls.years[0] : "All Years",
      priority: "Important",
      author: "Campus Administration",
    });

    return res.json({
      success: true,
      message: `Classroom venue updated successfully to "${cls.venue}"!`,
      class: cls,
      previousVenue,
    });
  } catch (error) {
    console.error("Update Venue Error:", error);
    res.status(500).json({ success: false, message: "Failed to update classroom location." });
  }
});

// ==========================================================================
// 7. CANCEL A CLASS (Administration Only)
// ==========================================================================
router.put("/:classId/cancel", protect, async (req, res) => {
  try {
    const userRole = (req.user.role || "").toLowerCase();
    if (userRole !== "admin" && userRole !== "administration") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: Only Administration can cancel classes.",
      });
    }

    const { classId } = req.params;
    const { cancellationReason } = req.body;

    if (!cancellationReason || !cancellationReason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a reason for cancelling this class.",
      });
    }

    inMemoryClasses = loadServerClasses();
    const cls = inMemoryClasses.find((c) => c._id === classId || c.id === classId);

    if (!cls) {
      return res.status(404).json({ success: false, message: "Class schedule not found." });
    }

    cls.status = "Cancelled";
    cls.cancellationReason = cancellationReason.trim();
    cls.updatedAt = new Date().toISOString();

    saveServerClasses(inMemoryClasses);

    try {
      await ClassSchedule.findByIdAndUpdate(classId, {
        status: "Cancelled",
        cancellationReason: cls.cancellationReason,
        updatedAt: new Date(),
      });
    } catch (e) {}

    // Dispatch high-priority cancellation notification
    pushClassNotification({
      title: `❌ CLASS CANCELLED: ${cls.subjectName} (${cls.subjectCode})`,
      description: `Your ${cls.subjectName} class on ${cls.date} (${cls.startTime} – ${cls.endTime}) has been CANCELLED.\nReason: ${cls.cancellationReason}\nFaculty: ${cls.facultyName}.\nStudents do not need to attend this lecture.`,
      department: cls.department,
      year: Array.isArray(cls.years) ? cls.years[0] : "All Years",
      priority: "Urgent",
      author: "Campus Administration",
    });

    return res.json({
      success: true,
      message: `Class for "${cls.subjectName}" has been CANCELLED. All students and faculty have been notified.`,
      class: cls,
    });
  } catch (error) {
    console.error("Cancel Class Error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel class." });
  }
});

// ==========================================================================
// 8. RESCHEDULE A CLASS (Administration Only)
// ==========================================================================
router.put("/:classId/reschedule", protect, async (req, res) => {
  try {
    const userRole = (req.user.role || "").toLowerCase();
    if (userRole !== "admin" && userRole !== "administration") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: Only Administration can reschedule classes.",
      });
    }

    const { classId } = req.params;
    const { date, startTime, endTime, block, floor, roomNumber, venue } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "New Date, Start Time, and End Time are required for rescheduling.",
      });
    }

    inMemoryClasses = loadServerClasses();
    const cls = inMemoryClasses.find((c) => c._id === classId || c.id === classId);

    if (!cls) {
      return res.status(404).json({ success: false, message: "Class schedule not found." });
    }

    // Preserve previous schedule
    cls.previousSchedule = {
      date: cls.date,
      startTime: cls.startTime,
      endTime: cls.endTime,
      venue: cls.venue,
    };

    cls.date = date.trim();
    cls.startTime = startTime.trim();
    cls.endTime = endTime.trim();
    if (block) cls.block = block.trim();
    if (floor) cls.floor = floor.trim();
    if (roomNumber) cls.roomNumber = roomNumber.trim();

    cls.venue = venue || formatVenueString(cls.block, cls.floor, cls.roomNumber);
    cls.status = "Rescheduled";
    cls.updatedAt = new Date().toISOString();

    saveServerClasses(inMemoryClasses);

    try {
      await ClassSchedule.findByIdAndUpdate(classId, {
        date: cls.date,
        startTime: cls.startTime,
        endTime: cls.endTime,
        block: cls.block,
        floor: cls.floor,
        roomNumber: cls.roomNumber,
        venue: cls.venue,
        status: "Rescheduled",
        previousSchedule: cls.previousSchedule,
        updatedAt: new Date(),
      });
    } catch (e) {}

    // Dispatch reschedule notification
    pushClassNotification({
      title: `🔄 CLASS RESCHEDULED: ${cls.subjectName} (${cls.subjectCode})`,
      description: `Your ${cls.subjectName} class has been RESCHEDULED.\nPrevious: ${cls.previousSchedule.date} (${cls.previousSchedule.startTime} – ${cls.previousSchedule.endTime}) at ${cls.previousSchedule.venue}\nNew Schedule: ${cls.date} (${cls.startTime} – ${cls.endTime}) at ${cls.venue}.`,
      department: cls.department,
      year: Array.isArray(cls.years) ? cls.years[0] : "All Years",
      priority: "Important",
      author: "Campus Administration",
    });

    return res.json({
      success: true,
      message: `Class for "${cls.subjectName}" rescheduled to ${cls.date} (${cls.startTime} – ${cls.endTime}) at ${cls.venue}!`,
      class: cls,
    });
  } catch (error) {
    console.error("Reschedule Class Error:", error);
    res.status(500).json({ success: false, message: "Failed to reschedule class." });
  }
});

// ==========================================================================
// 9. DELETE CLASS (Administration Only)
// ==========================================================================
router.delete("/:classId", protect, async (req, res) => {
  try {
    const userRole = (req.user.role || "").toLowerCase();
    if (userRole !== "admin" && userRole !== "administration") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: Only Administration can delete class schedules.",
      });
    }

    const { classId } = req.params;
    inMemoryClasses = loadServerClasses();

    const initialLen = inMemoryClasses.length;
    inMemoryClasses = inMemoryClasses.filter((c) => c._id !== classId && c.id !== classId);

    if (inMemoryClasses.length === initialLen) {
      return res.status(404).json({ success: false, message: "Class not found." });
    }

    saveServerClasses(inMemoryClasses);

    try {
      await ClassSchedule.findByIdAndDelete(classId);
    } catch (e) {}

    return res.json({ success: true, message: "Class schedule deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete class." });
  }
});

module.exports = router;
