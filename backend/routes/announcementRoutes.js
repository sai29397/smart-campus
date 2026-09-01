const express = require("express");
const router = express.Router();
const Announcement = require("../models/Announcement");

// In-memory fallback store with targeted announcements for different years
let inMemoryAnnouncements = [
  {
    _id: "ann_1st_1",
    id: "ann_1st_1",
    title: "1st Year Orientation & Welcome Address",
    description: "Welcome freshers! The orientation ceremony will take place in the Main Auditorium at 9:30 AM.",
    department: "All Departments",
    year: "1st Year",
    priority: "Important",
    authorName: "Dean of Academic Affairs",
    createdAt: new Date(),
  },
  {
    _id: "ann_1st_2",
    id: "ann_1st_2",
    title: "1st Year Physics & Chemistry Lab Batches",
    description: "Lab batch allocations for 1st Year engineering science modules are posted on department notice boards.",
    department: "Computer Science",
    year: "1st Year",
    priority: "Normal",
    authorName: "Dr. Sarah Jenkins",
    createdAt: new Date(),
  },
  {
    _id: "ann_2nd_1",
    id: "ann_2nd_1",
    title: "2nd Year Data Structures Lab Assignments",
    description: "All 2nd year students must complete and submit Lab Exercise 3 before Friday 5:00 PM.",
    department: "Computer Science",
    year: "2nd Year",
    priority: "Normal",
    authorName: "Dr. Sarah Jenkins",
    createdAt: new Date(),
  },
  {
    _id: "ann_3rd_1",
    id: "ann_3rd_1",
    title: "3rd Year Internship & Placement Briefing",
    description: "Mandatory pre-placement training session for 3rd Year students in Seminar Hall 2.",
    department: "Computer Science",
    year: "3rd Year",
    priority: "Urgent",
    authorName: "Placement Cell",
    createdAt: new Date(),
  },
  {
    _id: "ann_4th_1",
    id: "ann_4th_1",
    title: "4th Year Final Project Viva Dates Announced",
    description: "Final semester project reviews will be conducted between the 15th and 20th of this month.",
    department: "All Departments",
    year: "4th Year",
    priority: "Urgent",
    authorName: "Project Coordinator",
    createdAt: new Date(),
  },
  {
    _id: "ann_all_1",
    id: "ann_all_1",
    title: "Campus Library Extended Hours",
    description: "The central library is accessible 24/7 during semester exam preparation weeks.",
    department: "All Departments",
    year: "All Years",
    priority: "Normal",
    authorName: "Chief Librarian",
    createdAt: new Date(),
  },
];

// @route   GET /api/announcements
// @desc    Get announcements (optionally filtered by student's year and department)
// @access  Public
router.get("/", async (req, res) => {
  try {
    const { year, department } = req.query;

    let announcements = [];

    // Try MongoDB query
    try {
      let filter = {};
      if (year && year !== "All Years") {
        filter.$or = [{ year: "All Years" }, { year: year }];
      }
      if (department && department !== "All Departments" && department !== "Campus Wide") {
        filter.$and = [
          filter.$or ? { $or: filter.$or } : {},
          { $or: [{ department: "All Departments" }, { department: "Campus Wide" }, { department: department }] },
        ];
        delete filter.$or;
      }

      announcements = await Announcement.find(filter).sort({ createdAt: -1 });
    } catch (dbErr) {
      // In-memory filter
    }

    if (!announcements || announcements.length === 0) {
      announcements = inMemoryAnnouncements.filter((item) => {
        if (!year && !department) return true; // return all for faculty/admin
        
        const yearMatch =
          !year ||
          year === "All Years" ||
          item.year === "All Years" ||
          item.year.toLowerCase() === year.toLowerCase();

        const deptMatch =
          !department ||
          department === "All Departments" ||
          department === "Campus Wide" ||
          item.department === "All Departments" ||
          item.department === "Campus Wide" ||
          item.department.toLowerCase() === department.toLowerCase();

        return yearMatch && deptMatch;
      });
    }

    return res.status(200).json(announcements);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch announcements" });
  }
});

// @route   POST /api/announcements
// @desc    Create a new announcement for a target year and department
// @access  Public
router.post("/", async (req, res) => {
  try {
    const { title, description, department, year, priority, authorName } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    const newRecord = {
      title: title.trim(),
      description: description.trim(),
      department: department || "All Departments",
      year: year || "All Years",
      priority: priority || "Normal",
      authorName: authorName || "Faculty Member",
      createdAt: new Date(),
    };

    // Try MongoDB
    try {
      const created = await Announcement.create(newRecord);
      inMemoryAnnouncements.unshift(created);
      return res.status(201).json(created);
    } catch (dbErr) {
      const memRecord = {
        _id: "ann_" + Date.now(),
        id: "ann_" + Date.now(),
        ...newRecord,
      };
      inMemoryAnnouncements.unshift(memRecord);
      return res.status(201).json(memRecord);
    }
  } catch (error) {
    console.error("Error creating announcement:", error);
    return res.status(500).json({ success: false, message: "Failed to create announcement" });
  }
});

// @route   DELETE /api/announcements/:id
// @desc    Delete an announcement
// @access  Public
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    try {
      await Announcement.findByIdAndDelete(id);
    } catch (dbErr) {
      // Memory cleanup
    }

    inMemoryAnnouncements = inMemoryAnnouncements.filter(
      (a) => a._id !== id && a.id !== id
    );

    return res.status(200).json({ success: true, message: "Announcement deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete announcement" });
  }
});

module.exports = router;
