const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Generate JWT helper
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id || user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET || "smart_campus_super_secure_jwt_secret_key_2026",
    { expiresIn: "30d" }
  );
};

// Seeded users with strict role isolation
const initialUsers = [
  {
    _id: "usr_faculty_1",
    name: "Dr. Sarah Jenkins",
    email: "faculty@campus.edu",
    password: "faculty123",
    role: "faculty",
    department: "Computer Science",
    year: "Faculty/Staff",
  },
  {
    _id: "usr_student_1",
    name: "Alex Johnson",
    email: "student@campus.edu",
    password: "student123",
    role: "student",
    department: "Computer Science",
    year: "3rd Year",
  },
  {
    _id: "usr_admin_1",
    name: "Campus Administrator",
    email: "admin@campus.edu",
    password: "admin123",
    role: "admin",
    department: "Campus Administration",
    year: "Staff",
  },
];

let inMemoryUsers = [...initialUsers];

// @route   POST /api/auth/register
// @desc    Register a new user (Student / Faculty / Admin)
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, department, year } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: name, email, password, role.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check in-memory store first
    const existingMem = inMemoryUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existingMem) {
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    // Try MongoDB
    try {
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "A user with this email already exists.",
        });
      }

      const user = await User.create({
        name: name.trim(),
        email: cleanEmail,
        password,
        role,
        department: department || "Computer Science",
        year: year || "1st Year",
      });

      inMemoryUsers.push({
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        password,
        role: user.role,
        department: user.department,
        year: user.year,
      });

      return res.status(201).json({
        success: true,
        message: `Account registered successfully as ${role.toUpperCase()}!`,
        token: generateToken(user),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          year: user.year,
        },
      });
    } catch (dbErr) {
      // Offline fallback
      const newUser = {
        _id: "user_" + Date.now(),
        name: name.trim(),
        email: cleanEmail,
        password,
        role,
        department: department || "Computer Science",
        year: year || "1st Year",
      };
      inMemoryUsers.push(newUser);

      return res.status(201).json({
        success: true,
        message: `Account registered successfully as ${role.toUpperCase()}!`,
        token: generateToken(newUser),
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          department: newUser.department,
          year: newUser.year,
        },
      });
    }
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ success: false, message: "Server error during registration." });
  }
});

// @route   POST /api/auth/login
// @desc    Strict role-based login
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter both email and password.",
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Please select your role (Student, Faculty, or Admin).",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check seeded & memory accounts
    const user = inMemoryUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (user) {
      // Validate Password
      if (user.password !== password) {
        return res.status(401).json({
          success: false,
          message: "Invalid password for this account. Please try again.",
        });
      }

      // Validate Role strictly
      if (user.role !== role) {
        return res.status(403).json({
          success: false,
          message: `Access Denied: This account is registered as a "${user.role.toUpperCase()}". You cannot log into the ${role.toUpperCase()} portal with it.`,
        });
      }

      return res.json({
        success: true,
        message: `Login successful as ${user.role}!`,
        token: generateToken(user),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          year: user.year,
        },
      });
    }

    // Try MongoDB if user not found in memory
    try {
      const dbUser = await User.findOne({ email: cleanEmail });
      if (dbUser) {
        const isMatch = await dbUser.matchPassword(password);
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            message: "Invalid password for this account.",
          });
        }

        if (dbUser.role !== role) {
          return res.status(403).json({
            success: false,
            message: `Access Denied: This account is registered as "${dbUser.role.toUpperCase()}". You cannot log in as "${role.toUpperCase()}".`,
          });
        }

        return res.json({
          success: true,
          message: "Login successful!",
          token: generateToken(dbUser),
          user: {
            id: dbUser._id,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
            department: dbUser.department,
            year: dbUser.year,
          },
        });
      }
    } catch (dbErr) {
      // Ignore
    }

    return res.status(404).json({
      success: false,
      message: `Account not found for email "${email}". Please check your email or register a new account.`,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "Server error during login." });
  }
});

module.exports = router;
