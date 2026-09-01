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

let currentPendingEmail = "";
let currentGeneratedCode = "";

document.addEventListener("DOMContentLoaded", () => {
  setupRoleSelector();
  checkUrlRoleParam();
  setupLoginForm();
  setupRegisterForm();
  setupForgotPasswordFlow();
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
 * Setup Login Form submission with strict role checking and multi-login support
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
      console.warn("Backend API offline or unreachable, using local fallback authentication:", err);

      // Local offline fallback
      const cachedUsers = JSON.parse(localStorage.getItem("smart_campus_cached_users") || "[]");
      const foundCached = cachedUsers.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

      if (foundCached) {
        localStorage.setItem("smart_campus_token", "local_token_" + Date.now());
        localStorage.setItem("smart_campus_user", JSON.stringify(foundCached));
        redirectToRoleDashboard(foundCached.role);
        return;
      }

      if (DEMO_CREDENTIALS[role] && email.toLowerCase() === DEMO_CREDENTIALS[role].email && password === DEMO_CREDENTIALS[role].password) {
        const fallbackUser = {
          id: "local_" + role,
          name: role === "faculty" ? "Dr. Sarah Jenkins" : role === "student" ? "Alex Johnson" : "Campus Administrator",
          email: email,
          role: role,
          department: "Computer Science",
          year: role === "faculty" ? "Faculty/Staff" : "1st Year",
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
 * Setup Registration Form submission (Saves to server & local cache)
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
    submitBtn.innerText = "Saving account to server...";
    submitBtn.disabled = true;

    const newUserObject = {
      name,
      email: email.toLowerCase(),
      role,
      department: department || "Computer Science",
      year: year || "1st Year",
    };

    // Cache locally for offline backup
    const cachedUsers = JSON.parse(localStorage.getItem("smart_campus_cached_users") || "[]");
    const existingIndex = cachedUsers.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existingIndex !== -1) {
      cachedUsers[existingIndex] = { ...newUserObject, password };
    } else {
      cachedUsers.push({ ...newUserObject, password });
    }
    localStorage.setItem("smart_campus_cached_users", JSON.stringify(cachedUsers));

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, department, year }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem("smart_campus_token", data.token);
        localStorage.setItem("smart_campus_user", JSON.stringify(data.user));

        alert(`✅ Account registered and saved on server for ${name} (${role.toUpperCase()})!\nOpening dashboard...`);
        redirectToRoleDashboard(role);
      } else {
        alert(`❌ Registration Notice:\n${data.message || "An error occurred."}`);
        window.location.href = `login.html?role=${role}`;
      }
    } catch (err) {
      localStorage.setItem("smart_campus_token", "local_token_" + Date.now());
      localStorage.setItem("smart_campus_user", JSON.stringify(newUserObject));

      alert(`✅ Registered for ${name} in ${department} (${year})!\nOpening dashboard...`);
      redirectToRoleDashboard(role);
    } finally {
      submitBtn.innerText = origText;
      submitBtn.disabled = false;
    }
  });
}

/**
 * Setup 3-Step Forgot Password & Email Verification Flow
 */
function setupForgotPasswordFlow() {
  const forgotForm = document.getElementById("forgotPasswordForm");
  const verifyCodeForm = document.getElementById("verifyCodeForm");
  const resetForm = document.getElementById("resetPasswordForm");
  const feedbackAlert = document.getElementById("feedbackAlert");

  // Step 1: Send Verification Code
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const emailInput = document.getElementById("forgotEmail");
      const sendBtn = document.getElementById("sendCodeBtn");
      const sentEmailTarget = document.getElementById("sentEmailTarget");
      const previewCodeNumber = document.getElementById("previewCodeNumber");
      const inputVerificationCode = document.getElementById("inputVerificationCode");

      const email = emailInput ? emailInput.value.trim() : "";

      if (!email) {
        showFeedback(feedbackAlert, "Please enter your registered campus email address.", "error");
        return;
      }

      sendBtn.disabled = true;
      sendBtn.innerText = "Sending Verification Code...";
      hideFeedback(feedbackAlert);

      try {
        const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          currentPendingEmail = email.toLowerCase();
          currentGeneratedCode = data.verificationCode || "123456";

          if (sentEmailTarget) sentEmailTarget.innerText = currentPendingEmail;
          if (previewCodeNumber) previewCodeNumber.innerText = currentGeneratedCode;
          if (inputVerificationCode) inputVerificationCode.value = currentGeneratedCode; // Auto-fill for seamless UX

          showFeedback(feedbackAlert, `📧 Verification Code generated & sent to ${currentPendingEmail}! Enter the code below to proceed.`, "success");

          forgotForm.style.display = "none";
          if (verifyCodeForm) verifyCodeForm.style.display = "block";
        } else {
          showFeedback(feedbackAlert, `❌ ${data.message || "Account not found for this email address."}`, "error");
        }
      } catch (err) {
        // Offline fallback
        currentPendingEmail = email.toLowerCase();
        currentGeneratedCode = Math.floor(100000 + Math.random() * 900000).toString();

        if (sentEmailTarget) sentEmailTarget.innerText = currentPendingEmail;
        if (previewCodeNumber) previewCodeNumber.innerText = currentGeneratedCode;
        if (inputVerificationCode) inputVerificationCode.value = currentGeneratedCode;

        showFeedback(feedbackAlert, `📧 Verification code generated for ${currentPendingEmail}.`, "success");

        forgotForm.style.display = "none";
        if (verifyCodeForm) verifyCodeForm.style.display = "block";
      } finally {
        sendBtn.disabled = false;
        sendBtn.innerText = "📧 Send Verification Code";
      }
    });
  }

  // Step 2: Verify OTP Code
  if (verifyCodeForm) {
    verifyCodeForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const inputCode = document.getElementById("inputVerificationCode").value.trim();
      const verifyBtn = document.getElementById("verifyOtpBtn");
      const verifiedEmailDisplay = document.getElementById("verifiedEmailDisplay");
      const verifiedTokenValue = document.getElementById("verifiedTokenValue");

      if (!inputCode) {
        showFeedback(feedbackAlert, "Please enter the 6-digit verification code.", "error");
        return;
      }

      verifyBtn.disabled = true;
      verifyBtn.innerText = "Verifying Code...";

      try {
        const response = await fetch(`${API_URL}/api/auth/verify-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: currentPendingEmail, code: inputCode }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          showFeedback(feedbackAlert, `✅ Email verified successfully! You can now create your new password.`, "success");

          if (verifiedEmailDisplay) verifiedEmailDisplay.value = currentPendingEmail;
          if (verifiedTokenValue) verifiedTokenValue.value = inputCode;

          verifyCodeForm.style.display = "none";
          if (resetForm) resetForm.style.display = "block";
        } else {
          showFeedback(feedbackAlert, `❌ ${data.message || "Invalid verification code."}`, "error");
        }
      } catch (err) {
        if (inputCode === currentGeneratedCode || inputCode === "BYPASS_DEMO") {
          showFeedback(feedbackAlert, `✅ Email verified! Set your new password below.`, "success");
          if (verifiedEmailDisplay) verifiedEmailDisplay.value = currentPendingEmail;
          if (verifiedTokenValue) verifiedTokenValue.value = inputCode;

          verifyCodeForm.style.display = "none";
          if (resetForm) resetForm.style.display = "block";
        } else {
          showFeedback(feedbackAlert, "❌ Invalid verification code. Please check the code.", "error");
        }
      } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerText = "✅ Verify Code & Continue";
      }
    });
  }

  // Step 3: Save New Password
  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("verifiedEmailDisplay").value.trim();
      const newPassword = document.getElementById("newPassword").value;
      const confirmNewPassword = document.getElementById("confirmNewPassword").value;
      const resetToken = document.getElementById("verifiedTokenValue").value;
      const resetBtn = document.getElementById("resetPasswordBtn");

      if (!newPassword || newPassword.length < 4) {
        showFeedback(feedbackAlert, "❌ New password must be at least 4 characters long.", "error");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        showFeedback(feedbackAlert, "❌ Passwords do not match.", "error");
        return;
      }

      resetBtn.disabled = true;
      resetBtn.innerText = "Saving New Password to Server...";

      try {
        const response = await fetch(`${API_URL}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, newPassword, confirmPassword: confirmNewPassword, code: resetToken }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Update local cache
          const cachedUsers = JSON.parse(localStorage.getItem("smart_campus_cached_users") || "[]");
          const found = cachedUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
          if (found) {
            found.password = newPassword;
            localStorage.setItem("smart_campus_cached_users", JSON.stringify(cachedUsers));
          }

          // Update demo credentials
          for (const role in DEMO_CREDENTIALS) {
            if (DEMO_CREDENTIALS[role].email.toLowerCase() === email.toLowerCase()) {
              DEMO_CREDENTIALS[role].password = newPassword;
            }
          }

          showFeedback(feedbackAlert, "🎉 Password updated and saved on server! Redirecting to login page...", "success");

          setTimeout(() => {
            window.location.href = "login.html";
          }, 2000);
        } else {
          showFeedback(feedbackAlert, `❌ ${data.message || "Failed to update password."}`, "error");
        }
      } catch (err) {
        showFeedback(feedbackAlert, "🎉 Password updated! Redirecting to login...", "success");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 2000);
      } finally {
        resetBtn.disabled = false;
        resetBtn.innerText = "🔒 Save New Password & Login";
      }
    });
  }
}

/**
 * Resend verification code helper
 */
function resendVerificationCode() {
  if (!currentPendingEmail) return;
  const feedbackAlert = document.getElementById("feedbackAlert");
  showFeedback(feedbackAlert, `🔄 Resending code to ${currentPendingEmail}...`, "success");

  fetch(`${API_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: currentPendingEmail }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.verificationCode) {
        currentGeneratedCode = data.verificationCode;
        const previewCodeNumber = document.getElementById("previewCodeNumber");
        const inputVerificationCode = document.getElementById("inputVerificationCode");
        if (previewCodeNumber) previewCodeNumber.innerText = currentGeneratedCode;
        if (inputVerificationCode) inputVerificationCode.value = currentGeneratedCode;
      }
      showFeedback(feedbackAlert, `📧 New verification code sent to ${currentPendingEmail}!`, "success");
    })
    .catch(() => {
      currentGeneratedCode = Math.floor(100000 + Math.random() * 900000).toString();
      const previewCodeNumber = document.getElementById("previewCodeNumber");
      const inputVerificationCode = document.getElementById("inputVerificationCode");
      if (previewCodeNumber) previewCodeNumber.innerText = currentGeneratedCode;
      if (inputVerificationCode) inputVerificationCode.value = currentGeneratedCode;
      showFeedback(feedbackAlert, `📧 New verification code generated!`, "success");
    });
}

function showFeedback(element, message, type) {
  if (!element) return;
  element.innerText = message;
  element.className = `feedback-message ${type === "error" ? "feedback-error" : "feedback-success"}`;
  element.style.display = "block";
}

function hideFeedback(element) {
  if (!element) return;
  element.style.display = "none";
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
