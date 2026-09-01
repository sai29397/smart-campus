const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");

const usersFilePath = path.join(__dirname, "../data/users.json");

function loadUsersFromDisk() {
  try {
    if (fs.existsSync(usersFilePath)) {
      return JSON.parse(fs.readFileSync(usersFilePath, "utf8")) || [];
    }
  } catch (e) {}
  return [];
}

const protect = async (req, res, next) => {
  let token;
  let decoded = null;

  // 1. Try Extracting JWT Bearer Token
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      if (token && !token.startsWith("local_token")) {
        decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "smart_campus_super_secure_jwt_secret_key_2026"
        );
      }
    } catch (error) {
      // Allow fallback to user id lookup
    }
  }

  // 2. If JWT Decoded Successfully
  if (decoded) {
    // Check MongoDB
    try {
      const dbUser = await User.findById(decoded.id).select("-password");
      if (dbUser) {
        req.user = dbUser;
        return next();
      }
    } catch (dbErr) {}

    // Check disk storage
    const list = loadUsersFromDisk();
    const found = list.find((u) => u._id === decoded.id || u.id === decoded.id || u.email === decoded.email);
    if (found) {
      req.user = {
        id: found._id || found.id,
        _id: found._id || found.id,
        name: found.name,
        email: found.email,
        role: found.role,
        department: found.department,
        year: found.year,
        specialization: found.specialization || "General CSE",
      };
      return next();
    }

    // Fallback from decoded payload
    req.user = {
      id: decoded.id,
      _id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name || "User",
      year: decoded.year || "1st Year",
      specialization: decoded.specialization || "General CSE",
    };
    return next();
  }

  // 3. Robust Fallback: Lookup by header / query user identity
  const queryUserId = req.headers["x-user-id"] || req.query.studentId || req.query.facultyId || req.query.userId;
  const queryUserEmail = req.headers["x-user-email"] || req.query.email;

  if (queryUserId || queryUserEmail) {
    const list = loadUsersFromDisk();
    const found = list.find(
      (u) =>
        (queryUserId && (String(u._id) === String(queryUserId) || String(u.id) === String(queryUserId))) ||
        (queryUserEmail && u.email && u.email.toLowerCase() === queryUserEmail.toLowerCase())
    );

    if (found) {
      req.user = {
        id: found._id || found.id,
        _id: found._id || found.id,
        name: found.name,
        email: found.email,
        role: found.role,
        department: found.department,
        year: found.year,
        specialization: found.specialization || "General CSE",
      };
      return next();
    }
  }

  return res.status(401).json({ success: false, message: "Not authorized, please sign in" });
};

module.exports = { protect };
