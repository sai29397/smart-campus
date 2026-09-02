const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../models/User");

// Ensure data directory exists on server for permanent storage
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const usersFilePath = path.join(dataDir, "users.json");
const loginLogsFilePath = path.join(dataDir, "login_logs.json");
const resetRequestsFilePath = path.join(dataDir, "reset_requests.json");

// Generate JWT helper
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      department: user.department,
      year: user.year,
      specialization: user.specialization,
    },
    process.env.JWT_SECRET || "smart_campus_super_secure_jwt_secret_key_2026",
    { expiresIn: "30d" }
  );
};

// Initial default accounts
const defaultInitialUsers = [
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
    year: "1st Year",
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

// Helper: Load users from server persistent storage
function loadServerUsers() {
  try {
    if (fs.existsSync(usersFilePath)) {
      const data = fs.readFileSync(usersFilePath, "utf8");
      const list = JSON.parse(data);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch (err) {
    console.warn("Could not read users.json, initializing defaults:", err.message);
  }

  // Initialize defaults if file doesn't exist
  const seeded = defaultInitialUsers.map((u) => ({
    ...u,
    passwordHash: bcrypt.hashSync(u.password, 10),
    createdAt: new Date().toISOString(),
  }));
  saveServerUsers(seeded);
  return seeded;
}

// Helper: Save users permanently to server file system
function saveServerUsers(users) {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save users.json to server storage:", err);
  }
}

// Helper: Log login event permanently
function recordLoginEvent(user, req) {
  try {
    let logs = [];
    if (fs.existsSync(loginLogsFilePath)) {
      const data = fs.readFileSync(loginLogsFilePath, "utf8");
      logs = JSON.parse(data) || [];
    }

    const logEntry = {
      userId: user._id || user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      year: user.year,
      ip: req.ip || (req.connection && req.connection.remoteAddress) || "127.0.0.1",
      userAgent: req.headers["user-agent"] || "Browser",
      timestamp: new Date().toISOString(),
    };

    logs.unshift(logEntry);
    if (logs.length > 500) logs = logs.slice(0, 500);

    fs.writeFileSync(loginLogsFilePath, JSON.stringify(logs, null, 2), "utf8");
  } catch (err) {
    console.warn("Could not record login log:", err.message);
  }
}

// Password comparison helper supporting both hashed and plaintext
async function verifyPassword(enteredPassword, storedPassword, storedHash) {
  if (storedHash) {
    try {
      const match = await bcrypt.compare(enteredPassword, storedHash);
      if (match) return true;
    } catch (e) {}
  }
  if (storedPassword) {
    if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$")) {
      try {
        const match = await bcrypt.compare(enteredPassword, storedPassword);
        if (match) return true;
      } catch (e) {}
    }
    if (storedPassword === enteredPassword) {
      return true;
    }
  }
  return false;
}

// ==========================================================================
// 1. REGISTER USER (Persisted to Server Storage & MongoDB)
// ==========================================================================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, department, year, specialization } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: name, email, password, role.",
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 4 characters long.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanRole = role.toLowerCase().trim();

    // Reload from server storage
    const currentUsers = loadServerUsers();

    // Check existing in server storage
    const existing = currentUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `An account with email "${email}" is already registered. Please log in with your password.`,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      _id: "usr_" + Date.now(),
      id: "usr_" + Date.now(),
      name: name.trim(),
      email: cleanEmail,
      password: password,
      passwordHash: passwordHash,
      role: cleanRole,
      department: department || "Computer Science",
      year: year || (cleanRole === "faculty" ? "Faculty/Staff" : "1st Year"),
      specialization: specialization || (cleanRole === "faculty" ? "Faculty" : "General CSE"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Save permanently to server storage (synchronous & immediate)
    currentUsers.push(newUser);
    saveServerUsers(currentUsers);

    // 2. Save to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const dbUser = await User.create({
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          department: newUser.department,
          year: newUser.year,
          specialization: newUser.specialization,
        });
        if (dbUser && dbUser._id) {
          newUser._id = dbUser._id.toString();
          newUser.id = dbUser._id.toString();
          saveServerUsers(currentUsers);
        }
      } catch (dbErr) {}
    }

    return res.status(201).json({
      success: true,
      message: `Account registered successfully as ${cleanRole.toUpperCase()}! Data permanently saved.`,
      token: generateToken(newUser),
      user: {
        id: newUser._id,
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        year: newUser.year,
        specialization: newUser.specialization,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ success: false, message: "Server error during registration." });
  }
});

// ==========================================================================
// 2. LOGIN USER (Permanent Database Search & Password Verification)
// ==========================================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter both your email address and password.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Reload from server persistent storage
    const currentUsers = loadServerUsers();

    // 1. Search for user by email across server database
    let foundUser = currentUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    // 2. Search MongoDB if not in memory
    if (!foundUser && mongoose.connection.readyState === 1) {
      try {
        const dbUser = await User.findOne({ email: cleanEmail });
        if (dbUser) {
          foundUser = {
            _id: dbUser._id.toString(),
            id: dbUser._id.toString(),
            name: dbUser.name,
            email: dbUser.email,
            password: dbUser.password,
            passwordHash: dbUser.password,
            role: dbUser.role,
            department: dbUser.department,
            year: dbUser.year,
            specialization: dbUser.specialization || "General CSE",
          };
          currentUsers.push(foundUser);
          saveServerUsers(currentUsers);
        }
      } catch (dbErr) {}
    }

    // 3. If user is not found in database, return 404 "User Not Found"
    if (!foundUser) {
      return res.status(404).json({
        success: false,
        message: `User not found with email "${email}". Please verify your email or register a new account.`,
      });
    }

    // 4. Verify password securely using bcrypt
    const isPasswordValid = await verifyPassword(password, foundUser.password, foundUser.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password for this account. Please try again.",
      });
    }

    // 5. Strict Role Enforcement
    if (role && foundUser.role.toLowerCase() !== role.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: `Access Denied: This account is registered as "${foundUser.role.toUpperCase()}". You cannot log into the ${role.toUpperCase()} portal. Please select "${foundUser.role.toUpperCase()}" role.`,
        registeredRole: foundUser.role,
      });
    }

    // 6. Record login audit event permanently on server
    recordLoginEvent(foundUser, req);

    // 7. Return successful session with user's verified registered role
    return res.json({
      success: true,
      message: `Login successful as ${foundUser.role}!`,
      token: generateToken(foundUser),
      user: {
        id: foundUser._id || foundUser.id,
        _id: foundUser._id || foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        role: foundUser.role,
        department: foundUser.department,
        year: foundUser.year,
        specialization: foundUser.specialization || "General CSE",
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "Server error during login." });
  }
});

// ==========================================================================
// 3. FORGOT PASSWORD - SEND 6-DIGIT VERIFICATION CODE
// ==========================================================================
let resetTokens = {};

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please enter your registered campus email address.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const currentUsers = loadServerUsers();
    const user = currentUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No account found for "${email}". Please verify the email address.`,
      });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    resetTokens[cleanEmail] = {
      code: verificationCode,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };

    return res.json({
      success: true,
      message: `Verification code generated successfully for ${email}.`,
      verificationCode: verificationCode,
      debugCode: verificationCode,
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ success: false, message: "Server error generating reset code." });
  }
});

// ==========================================================================
// 4. VERIFY CODE
// ==========================================================================
router.post("/verify-code", (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "Please provide both email and 6-digit verification code.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const record = resetTokens[cleanEmail];

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "No verification request found for this email. Please request a new code.",
      });
    }

    if (Date.now() > record.expiresAt) {
      delete resetTokens[cleanEmail];
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new code.",
      });
    }

    if (String(record.code).trim() !== String(code).trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code. Please check and try again.",
      });
    }

    return res.json({
      success: true,
      message: "Verification code confirmed successfully.",
    });
  } catch (error) {
    console.error("Verify Code Error:", error);
    res.status(500).json({ success: false, message: "Server error verifying code." });
  }
});

// ==========================================================================
// 5. RESET PASSWORD
// ==========================================================================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, verification code, and new password.",
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 4 characters long.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const record = resetTokens[cleanEmail];

    if (!record || String(record.code).trim() !== String(code).trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification session. Please request a new code.",
      });
    }

    const currentUsers = loadServerUsers();
    const userIndex = currentUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Account not found with email "${email}".`,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    currentUsers[userIndex].password = newPassword;
    currentUsers[userIndex].passwordHash = passwordHash;
    currentUsers[userIndex].updatedAt = new Date().toISOString();

    saveServerUsers(currentUsers);

    if (mongoose.connection.readyState === 1) {
      try {
        await User.findOneAndUpdate({ email: cleanEmail }, { password: newPassword });
      } catch (e) {}
    }

    delete resetTokens[cleanEmail];

    return res.json({
      success: true,
      message: "Password reset successfully! You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ success: false, message: "Server error resetting password." });
  }
});

// ==========================================================================
// 6. GET CURRENT USER PROFILE
// ==========================================================================
router.get("/me", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "smart_campus_super_secure_jwt_secret_key_2026"
    );

    const currentUsers = loadServerUsers();
    const user = currentUsers.find(
      (u) => String(u._id) === String(decoded.id) || (u.email && u.email.toLowerCase() === (decoded.email || "").toLowerCase())
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      user: {
        id: user._id || user.id,
        _id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        year: user.year,
        specialization: user.specialization,
      },
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
});

module.exports = router;
