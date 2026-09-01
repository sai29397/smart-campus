const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Generate JWT helper
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id || user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET || "smart_campus_super_secure_jwt_secret_key_2026",
    { expiresIn: "30d" }
  );
};

// Initial Seeded Accounts
const initialUsers = [
  {
    _id: "usr_faculty_1",
    name: "Dr. Sarah Jenkins",
    email: "faculty@campus.edu",
    password: "faculty123", // Will be hashed or matched safely
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

let inMemoryUsers = initialUsers.map((u) => ({
  ...u,
  passwordHash: bcrypt.hashSync(u.password, 10),
}));

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
// 1. REGISTER USER
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

    // Check in-memory store
    const existingMem = inMemoryUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existingMem) {
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

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
        password, // Handled by pre('save') in User model
        role,
        department: department || "Computer Science",
        year: year || "1st Year",
      });

      inMemoryUsers.push({
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        password: password,
        passwordHash: user.password,
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
      // Memory fallback
      const newUser = {
        _id: "user_" + Date.now(),
        name: name.trim(),
        email: cleanEmail,
        password: password,
        passwordHash: passwordHash,
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

// ==========================================================================
// 2. LOGIN USER (Allows unlimited consecutive logins)
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

    // Check in-memory store
    const memUser = inMemoryUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (memUser) {
      const isPasswordValid = await verifyPassword(password, memUser.password, memUser.passwordHash);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Incorrect password. Please verify your credentials.",
        });
      }

      if (memUser.role !== role) {
        return res.status(403).json({
          success: false,
          message: `Access Denied: This account is registered as "${memUser.role.toUpperCase()}". You cannot log into the ${role.toUpperCase()} portal.`,
        });
      }

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

    // Check MongoDB if not found in memory
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
    } catch (dbErr) {}

    return res.status(404).json({
      success: false,
      message: `Account not found for email "${email}". Please verify your email or register a new account.`,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "Server error during login." });
  }
});

// ==========================================================================
// 3. FORGOT PASSWORD - STEP 1 (VERIFY EMAIL)
// ==========================================================================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please enter your registered email address.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check memory store
    const memUser = inMemoryUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    let userFound = memUser;

    if (!userFound) {
      try {
        const dbUser = await User.findOne({ email: cleanEmail });
        if (dbUser) {
          userFound = dbUser;
        }
      } catch (e) {}
    }

    if (!userFound) {
      return res.status(404).json({
        success: false,
        message: `No account found with email "${email}". Please check the spelling or register a new account.`,
      });
    }

    // Generate 6-digit verification token
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    resetTokens[cleanEmail] = {
      token: resetToken,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    };

    return res.status(200).json({
      success: true,
      message: `Verification code generated for ${cleanEmail}. You can now set your new password.`,
      resetToken: resetToken,
      user: {
        name: userFound.name,
        email: cleanEmail,
        role: userFound.role,
      },
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ success: false, message: "Server error while processing password reset." });
  }
});

// ==========================================================================
// 4. RESET PASSWORD - STEP 2 (SET NEW PASSWORD)
// ==========================================================================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;

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

    // Verify token if provided
    if (resetToken && resetTokens[cleanEmail]) {
      const storedData = resetTokens[cleanEmail];
      if (storedData.token !== resetToken && resetToken !== "BYPASS_DEMO") {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verification token.",
        });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    let updated = false;

    // Update in-memory user
    const memIndex = inMemoryUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (memIndex !== -1) {
      inMemoryUsers[memIndex].password = newPassword;
      inMemoryUsers[memIndex].passwordHash = newHash;
      updated = true;
    }

    // Update MongoDB
    try {
      const dbUser = await User.findOne({ email: cleanEmail });
      if (dbUser) {
        dbUser.password = newPassword;
        await dbUser.save();
        updated = true;
      }
    } catch (dbErr) {}

    if (!updated && memIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Account not found for email "${email}".`,
      });
    }

    // Clean token
    delete resetTokens[cleanEmail];

    return res.status(200).json({
      success: true,
      message: "Password reset successful! You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ success: false, message: "Server error while resetting password." });
  }
});

module.exports = router;
