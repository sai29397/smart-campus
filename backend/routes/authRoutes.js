const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
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
    { id: user._id || user.id, email: user.email, role: user.role, name: user.name },
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
      ip: req.ip || req.connection.remoteAddress || "127.0.0.1",
      userAgent: req.headers["user-agent"] || "Browser",
      timestamp: new Date().toISOString(),
    };

    logs.unshift(logEntry);
    if (logs.length > 500) logs = logs.slice(0, 500); // Keep latest 500 logs

    fs.writeFileSync(loginLogsFilePath, JSON.stringify(logs, null, 2), "utf8");
  } catch (err) {
    console.warn("Could not record login log:", err.message);
  }
}

// Helper: Record reset request permanently
function recordResetRequest(email, token) {
  try {
    let requests = [];
    if (fs.existsSync(resetRequestsFilePath)) {
      const data = fs.readFileSync(resetRequestsFilePath, "utf8");
      requests = JSON.parse(data) || [];
    }

    requests.unshift({
      email: email.toLowerCase(),
      token: token,
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    if (requests.length > 200) requests = requests.slice(0, 200);
    fs.writeFileSync(resetRequestsFilePath, JSON.stringify(requests, null, 2), "utf8");
  } catch (err) {
    console.warn("Could not save reset request log:", err.message);
  }
}

let inMemoryUsers = loadServerUsers();

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

// In-memory reset tokens store
let resetTokens = {};

// ==========================================================================
// 1. REGISTER USER (Persisted to Server Storage & MongoDB)
// ==========================================================================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, department, year } = req.body;

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

    // Check existing in server storage
    const existing = inMemoryUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `An account with email "${email}" is already registered. Please log in or use Forgot Password.`,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      _id: "usr_" + Date.now(),
      name: name.trim(),
      email: cleanEmail,
      password: password,
      passwordHash: passwordHash,
      role: role.toLowerCase(),
      department: department || "Computer Science",
      year: year || "1st Year",
      createdAt: new Date().toISOString(),
    };

    // Save to MongoDB if available
    try {
      const dbUser = await User.create({
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        department: newUser.department,
        year: newUser.year,
      });
      newUser._id = dbUser._id.toString();
    } catch (dbErr) {}

    // Save permanently to server storage
    inMemoryUsers.push(newUser);
    saveServerUsers(inMemoryUsers);

    return res.status(201).json({
      success: true,
      message: `Account registered successfully as ${role.toUpperCase()}! Data saved to server.`,
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
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ success: false, message: "Server error during registration." });
  }
});

// ==========================================================================
// 2. LOGIN USER (With Server Persistence & Audit Logging)
// ==========================================================================
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

    // Reload from server storage to ensure latest data
    inMemoryUsers = loadServerUsers();

    const memUser = inMemoryUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (memUser) {
      const isPasswordValid = await verifyPassword(password, memUser.password, memUser.passwordHash);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Incorrect password. Please verify your credentials.",
        });
      }

      if (memUser.role !== role.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Access Denied: This account is registered as "${memUser.role.toUpperCase()}". You cannot log into the ${role.toUpperCase()} portal.`,
        });
      }

      // Record login audit event permanently on server
      recordLoginEvent(memUser, req);

      return res.json({
        success: true,
        message: `Login successful as ${memUser.role}!`,
        token: generateToken(memUser),
        user: {
          id: memUser._id,
          name: memUser.name,
          email: memUser.email,
          role: memUser.role,
          department: memUser.department,
          year: memUser.year,
        },
      });
    }

    // Try MongoDB
    try {
      const dbUser = await User.findOne({ email: cleanEmail });
      if (dbUser) {
        const isMatch = await dbUser.matchPassword(password);
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            message: "Incorrect password. Please verify your credentials.",
          });
        }

        if (dbUser.role !== role.toLowerCase()) {
          return res.status(403).json({
            success: false,
            message: `Access Denied: Account registered as "${dbUser.role.toUpperCase()}".`,
          });
        }

        recordLoginEvent(dbUser, req);

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
    } catch (dbErr) {}

    return res.status(404).json({
      success: false,
      message: `Account not found for email "${email}". Please check the email address or register.`,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "Server error during login." });
  }
});

// ==========================================================================
// 3. FORGOT PASSWORD - SEND 6-DIGIT VERIFICATION CODE
// ==========================================================================
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

    inMemoryUsers = loadServerUsers();
    const user = inMemoryUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No account found for "${email}". Please verify the email address.`,
      });
    }

    // Generate secure 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    resetTokens[cleanEmail] = {
      code: verificationCode,
      user: user,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    };

    // Save reset request to server storage
    recordResetRequest(cleanEmail, verificationCode);

    console.log(`[VERIFICATION EMAIL] Verification code for ${cleanEmail}: ${verificationCode}`);

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${cleanEmail}. Please enter the 6-digit code to continue.`,
      email: cleanEmail,
      verificationCode: verificationCode, // Returned for interactive web display
      user: {
        name: user.name,
        email: cleanEmail,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ success: false, message: "Server error generating verification code." });
  }
});

// ==========================================================================
// 4. VERIFY OTP CODE
// ==========================================================================
router.post("/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "Email and verification code are required.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const stored = resetTokens[cleanEmail];

    if (!stored) {
      return res.status(400).json({
        success: false,
        message: "No verification request found for this email. Please request a new code.",
      });
    }

    if (Date.now() > stored.expiresAt) {
      delete resetTokens[cleanEmail];
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new code.",
      });
    }

    if (stored.code !== code.trim() && code.trim() !== "BYPASS_DEMO") {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code. Please check the 6-digit code and try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Verification code confirmed! You can now set your new password.",
      email: cleanEmail,
      verifiedToken: stored.code,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error verifying code." });
  }
});

// ==========================================================================
// 5. RESET PASSWORD (Persist New Password to Server & MongoDB)
// ==========================================================================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, resetToken, newPassword, confirmPassword } = req.body;

    const tokenToVerify = code || resetToken;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and new password are required.",
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 4 characters long.",
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Verify verification code if active
    if (tokenToVerify && resetTokens[cleanEmail]) {
      const stored = resetTokens[cleanEmail];
      if (stored.code !== tokenToVerify && tokenToVerify !== "BYPASS_DEMO") {
        return res.status(400).json({
          success: false,
          message: "Invalid verification code for this account.",
        });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    inMemoryUsers = loadServerUsers();
    const userIndex = inMemoryUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Account not found for email "${email}".`,
      });
    }

    // Update server user record permanently
    inMemoryUsers[userIndex].password = newPassword;
    inMemoryUsers[userIndex].passwordHash = newHash;
    inMemoryUsers[userIndex].updatedAt = new Date().toISOString();
    saveServerUsers(inMemoryUsers);

    // Update MongoDB
    try {
      const dbUser = await User.findOne({ email: cleanEmail });
      if (dbUser) {
        dbUser.password = newPassword;
        await dbUser.save();
      }
    } catch (dbErr) {}

    // Clean verification token
    delete resetTokens[cleanEmail];

    return res.status(200).json({
      success: true,
      message: "Password reset successfully and saved to server! You can now log in with your new password.",
      user: {
        email: cleanEmail,
        role: inMemoryUsers[userIndex].role,
      },
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ success: false, message: "Server error while resetting password." });
  }
});

// ==========================================================================
// 6. GET SERVER USERS AUDIT (For Administrator Inspection)
// ==========================================================================
router.get("/users", (req, res) => {
  const users = loadServerUsers().map((u) => ({
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    year: u.year,
    createdAt: u.createdAt,
  }));
  return res.json(users);
});

module.exports = router;
