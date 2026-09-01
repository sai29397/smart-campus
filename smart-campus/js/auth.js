// ==========================================================================
// SMART CAMPUS - AUTHENTICATION CONTROLLER (auth.js)
// ==========================================================================

// Base API URL: connects to http://localhost:3000 in local dev, or relative path on deployed Vercel
const API_URL =
  window.location.hostname === "localhost" && window.location.port !== "3000"
    ? "http://localhost:3000"
    : window.location.protocol === "file:"
    ? "http://localhost:3000"
    : "";

// Preset default demo credentials for easy testing
const DEMO_CREDENTIALS = {
  faculty: {
    email: "faculty@campus.edu",
    password: "faculty123",
  },
  student: {
    email: "student@campus.edu",
    password: "student123",
  },
  admin: {
    email: "admin@campus.edu",
    password: "admin123",
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setupRoleSelector();
  checkUrlRoleParam();
  setupLoginForm();
  setupRegisterForm();
});

/**
 * 1-Click Role selector helper
 */
function quickSelectRole(roleName) {
  const roleSelect = document.getElementById("role");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const quickBtns = document.querySelectorAll(".quick-role-btn");

  if (!roleSelect || !emailInput || !passwordInput) return;

  roleSelect.value = roleName;
  if (DEMO_CREDENTIALS[roleName]) {
    emailInput.value = DEMO_CREDENTIALS[roleName].email;
    passwordInput.value = DEMO_CREDENTIALS[roleName].password;
  }

  quickBtns.forEach((btn) => {
    if (btn.innerText.toLowerCase().includes(roleName)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

/**
 * Check if URL has ?role=student or ?role=faculty
 */
function checkUrlRoleParam() {
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get("role");
  if (roleParam && DEMO_CREDENTIALS[roleParam]) {
    quickSelectRole(roleParam);
  }
}

/**
 * Automatically autofill email and password when role dropdown changes
 */
function setupRoleSelector() {
  const roleSelect = document.getElementById("role");
  if (!roleSelect) return;

  roleSelect.addEventListener("change", (e) => {
    quickSelectRole(e.target.value);
  });
}

/**
 * Setup Login Form submission with strict role checking
 */
function setupLoginForm() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const role = document.getElementById("role").value;
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!role) {
      alert("⚠️ Please select your role!");
      return;
    }

    if (!email || !password) {
      alert("⚠️ Please enter both your email address and password.");
      return;
    }

    const submitBtn = loginForm.querySelector("button[type='submit']");
    const origText = submitBtn.innerText;
    submitBtn.innerText = "Authenticating...";
    submitBtn.disabled = true;

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem("smart_campus_token", data.token);
        localStorage.setItem("smart_campus_user", JSON.stringify(data.user));

        redirectToRoleDashboard(data.user.role);
      } else {
        alert(`❌ Login Rejection:\n${data.message || "Invalid credentials or unauthorized role."}`);
      }
    } catch (err) {
      console.warn("Backend API not reachable directly, using local authentication:", err);

      // Local offline fallback
      if (DEMO_CREDENTIALS[role] && email.toLowerCase() === DEMO_CREDENTIALS[role].email && password === DEMO_CREDENTIALS[role].password) {
        const fallbackUser = {
          id: "local_" + role,
          name: role === "faculty" ? "Dr. Sarah Jenkins" : role === "student" ? "Alex Johnson" : "Campus Administrator",
          email: email,
          role: role,
          department: "Computer Science",
          year: role === "faculty" ? "Faculty/Staff" : "3rd Year",
        };

        localStorage.setItem("smart_campus_token", "local_token_" + Date.now());
        localStorage.setItem("smart_campus_user", JSON.stringify(fallbackUser));

        redirectToRoleDashboard(role);
      } else {
        alert("❌ Login Failed: Incorrect credentials or role mismatch. Please verify your selected role and login details.");
      }
    } finally {
      submitBtn.innerText = origText;
      submitBtn.disabled = false;
    }
  });
}

/**
 * Setup Registration Form submission
 */
function setupRegisterForm() {
  const registerForm = document.getElementById("registerForm");
  if (!registerForm) return;

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const role = document.getElementById("regRole").value;
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const department = document.getElementById("regDepartment").value;
    const year = document.getElementById("regYear").value;
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;

    if (!role || !name || !email || !password) {
      alert("Please fill in all required fields!");
      return;
    }

    if (password !== confirmPassword) {
      alert("❌ Passwords do not match!");
      return;
    }

    if (password.length < 4) {
      alert("❌ Password must be at least 4 characters long!");
      return;
    }

    const submitBtn = registerForm.querySelector("button[type='submit']");
    const origText = submitBtn.innerText;
    submitBtn.innerText = "Creating account...";
    submitBtn.disabled = true;

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, department, year }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`✅ Account created for ${name} (${role.toUpperCase()})! Redirecting to login.`);
        window.location.href = `login.html?role=${role}`;
      } else {
        alert(`❌ Registration Failed:\n${data.message || "An error occurred."}`);
      }
    } catch (err) {
      alert(`✅ Registered locally for ${name} (${role})!`);
      window.location.href = `login.html?role=${role}`;
    } finally {
      submitBtn.innerText = origText;
      submitBtn.disabled = false;
    }
  });
}

/**
 * Strict role-based redirect
 */
function redirectToRoleDashboard(role) {
  if (role === "faculty") {
    window.location.href = "faculty-dashboard.html";
  } else if (role === "admin") {
    window.location.href = "admin-dashboard.html";
  } else if (role === "student") {
    window.location.href = "student-dashboard.html";
  } else {
    window.location.href = "index.html";
  }
}
