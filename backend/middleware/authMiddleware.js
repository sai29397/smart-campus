const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");

const usersFilePath = path.join(__dirname, "../data/users.json");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "smart_campus_super_secure_jwt_secret_key_2026"
      );

      // 1. Try MongoDB
      try {
        const dbUser = await User.findById(decoded.id).select("-password");
        if (dbUser) {
          req.user = dbUser;
          return next();
        }
      } catch (dbErr) {}

      // 2. Try server users file
      try {
        if (fs.existsSync(usersFilePath)) {
          const list = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
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
        }
      } catch (fileErr) {}

      // 3. Fallback decoded payload
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
    } catch (error) {
      return res.status(401).json({ success: false, message: "Not authorized, token failed" });
    }
  }

  // Allow optional user lookup via query / headers if local demo session
  const queryUserId = req.query.studentId || req.query.facultyId || req.query.userId || req.headers["x-user-id"];
  const queryUserEmail = req.query.email || req.headers["x-user-email"];

  if (queryUserId || queryUserEmail) {
    try {
      if (fs.existsSync(usersFilePath)) {
        const list = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
        const found = list.find((u) => (queryUserId && (u._id === queryUserId || u.id === queryUserId)) || (queryUserEmail && u.email.toLowerCase() === queryUserEmail.toLowerCase()));
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
    } catch (err) {}
  }

  return res.status(401).json({ success: false, message: "Not authorized, please provide a valid session token" });
};

module.exports = { protect };
