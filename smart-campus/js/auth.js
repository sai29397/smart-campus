// ==========================================================================
// SMART CAMPUS - AUTHENTICATION CONTROLLER (auth.js)
// ==========================================================================

// Helper to determine the backend API base URL
function getApiBaseUrl() {
  if (typeof window === "undefined") return "http://localhost:3000";
  // If served directly from Express on port 3000
  if (window.location.port === "3000") return "";
  // If served from VS Code Live Server (5500), Python http.server (5500), file://, or other local ports
  const host = window.location.hostname;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "" ||
    window.location.protocol === "file:" ||
    window.location.port !== ""
  ) {
    return "http://localhost:3000";
  }
  return "";
}

const API_URL = getApiBaseUrl();

// Preset default demo credentials for quick testing
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
  initLoginPage();
  setupLoginForm();
  setupRegisterForm();
  setupForgotPasswordFlow();
});

/**
 * Initialize Login page state (Preserves registered email across reloads)
 */
function initLoginPage() {
  const emailInput = document.getElementById("email");
  const roleSelect = document.getElementById("role");
  const loginAlert = document.getElementById("loginStatusAlert");

  if (!emailInput) return;

  const urlParams = new URLSearchParams(window.location.search);
  const registeredParam = urlParams.get("registered");
  const emailParam = urlParams.get("email");
  const roleParam = urlParams.get("role");

  if (registeredParam === "true" && emailParam) {
    emailInput.value = emailParam;
    if (roleSelect && roleParam) roleSelect.value = roleParam;
    showLoginAlert(
      loginAlert,
      `✅ Registration successful! Please enter your password to sign in as ${emailParam}.`,
      "success"
    );
    return;
  }

  // Restore remembered email if saved
  const rememberedEmail = localStorage.getItem("smart_campus_last_email");
  const rememberedRole = localStorage.getItem("smart_campus_last_role");

  if (rememberedEmail && !emailInput.value) {
    emailInput.value = rememberedEmail;
    if (roleSelect && rememberedRole) {
      roleSelect.value = rememberedRole;
    }
  }
}

/**
 * Fill demo credentials ONLY when explicitly clicked by user
 */
function fillDemoCredentials(roleName) {
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
 * Setup Login Form submission (Direct permanent server search)
 */
function setupLoginForm() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const roleSelect = document.getElementById("role");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const rememberMe = document.getElementById("rememberMe");
    const loginAlert = document.getElementById("loginStatusAlert");
    const submitBtn =
      document.getElementById("loginSubmitBtn") ||
      loginForm.querySelector("button[type='submit']");

    const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const password = passwordInput ? passwordInput.value : "";
    const role = roleSelect ? roleSelect.value : "student";

    if (!email || !password) {
      showLoginAlert(loginAlert, "⚠️ Please enter both your campus email and password.", "error");
      return;
    }

    const origText = submitBtn.innerText;
    submitBtn.innerText = "Authenticating with Server...";
    submitBtn.disabled = true;
    hideLoginAlert(loginAlert);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Save session permanently
        localStorage.setItem("smart_campus_token", data.token);
        localStorage.setItem("smart_campus_user", JSON.stringify(data.user));

        if (rememberMe && rememberMe.checked) {
          localStorage.setItem("smart_campus_last_email", data.user.email);
          localStorage.setItem("smart_campus_last_role", data.user.role);
        }

        showLoginAlert(loginAlert, `✅ ${data.message} Redirecting to your dashboard...`, "success");

        setTimeout(() => {
          redirectToRoleDashboard(data.user.role);
        }, 600);
      } else {
        showLoginAlert(
          loginAlert,
          `❌ ${data.message || "Invalid email or password."}`,
          "error"
        );
      }
    } catch (err) {
      console.error("Login Server Connection Error:", err);
      showLoginAlert(
        loginAlert,
        "⚠️ Cannot connect to Smart Campus Server at http://localhost:3000. Please ensure the backend server is running.",
        "error"
      );
    } finally {
      submitBtn.innerText = origText;
      submitBtn.disabled = false;
    }
  });
}

/**
 * Setup Registration Form (Saves permanently to server)
 */
function setupRegisterForm() {
  const registerForm = document.getElementById("registerForm");
  if (!registerForm) return;

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const role = document.getElementById("regRole").value;
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim().toLowerCase();
    const department = document.getElementById("regDepartment").value;
    const year = document.getElementById("regYear").value;
    const specializationEl = document.getElementById("regSpecialization");
    const specialization = specializationEl ? specializationEl.value : "General CSE";
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;

    if (!role || !name || !email || !password) {
      alert("⚠️ Please fill in all required fields!");
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
    submitBtn.innerText = "Saving Account Permanently...";
    submitBtn.disabled = true;

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          department,
          year,
          specialization,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Save session permanently
        localStorage.setItem("smart_campus_token", data.token);
        localStorage.setItem("smart_campus_user", JSON.stringify(data.user));
        localStorage.setItem("smart_campus_last_email", email);
        localStorage.setItem("smart_campus_last_role", role.toLowerCase());

        alert(`✅ Account registered permanently for ${name} (${role.toUpperCase()})!\nOpening dashboard...`);
        redirectToRoleDashboard(role);
      } else {
        alert(`❌ Registration Notice:\n${data.message || "An error occurred during registration."}`);
      }
    } catch (err) {
      console.error("Register Server Connection Error:", err);
      alert("⚠️ Could not connect to Smart Campus backend server at http://localhost:3000. Please ensure the backend server is running.");
    } finally {
      submitBtn.innerText = origText;
      submitBtn.disabled = false;
    }
  });
}

/**
 * Setup 3-Step Forgot Password Flow
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
      const emailInput = document.getElementById("resetEmail");
      const email = emailInput ? emailInput.value.trim().toLowerCase() : "";

      if (!email) {
        showLoginAlert(feedbackAlert, "⚠️ Please enter your registered campus email.", "error");
        return;
      }

      const submitBtn = forgotForm.querySelector("button[type='submit']");
      const origText = submitBtn.innerText;
      submitBtn.innerText = "Generating Code...";
      submitBtn.disabled = true;
      hideLoginAlert(feedbackAlert);

      try {
        const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          currentPendingEmail = email;
          currentGeneratedCode = data.verificationCode || data.debugCode || "";

          // Show Step 2
          document.getElementById("step1Card").style.display = "none";
          document.getElementById("step2Card").style.display = "block";
          const sentToEl = document.getElementById("codeSentToEmail");
          if (sentToEl) sentToEl.innerText = email;

          showLoginAlert(
            feedbackAlert,
            `✅ 6-digit verification code sent to ${email}. (Demo Code: ${currentGeneratedCode})`,
            "success"
          );
        } else {
          showLoginAlert(feedbackAlert, `❌ ${data.message || "Email not registered."}`, "error");
        }
      } catch (err) {
        showLoginAlert(feedbackAlert, "⚠️ Server error generating reset code.", "error");
      } finally {
        submitBtn.innerText = origText;
        submitBtn.disabled = false;
      }
    });
  }

  // Step 2: Verify Code
  if (verifyCodeForm) {
    verifyCodeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const codeInput = document.getElementById("verificationCodeInput");
      const code = codeInput ? codeInput.value.trim() : "";

      if (!code) {
        showLoginAlert(feedbackAlert, "⚠️ Please enter the 6-digit verification code.", "error");
        return;
      }

      const submitBtn = verifyCodeForm.querySelector("button[type='submit']");
      const origText = submitBtn.innerText;
      submitBtn.innerText = "Verifying...";
      submitBtn.disabled = true;

      try {
        const res = await fetch(`${API_URL}/api/auth/verify-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: currentPendingEmail, code }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          document.getElementById("step2Card").style.display = "none";
          document.getElementById("step3Card").style.display = "block";
          showLoginAlert(feedbackAlert, "✅ Code verified! Please enter your new password.", "success");
        } else {
          showLoginAlert(feedbackAlert, `❌ ${data.message || "Invalid verification code."}`, "error");
        }
      } catch (err) {
        showLoginAlert(feedbackAlert, "⚠️ Server error verifying code.", "error");
      } finally {
        submitBtn.innerText = origText;
        submitBtn.disabled = false;
      }
    });
  }

  // Step 3: Reset Password
  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newPassInput = document.getElementById("newPassword");
      const confirmPassInput = document.getElementById("confirmNewPassword");
      const codeInput = document.getElementById("verificationCodeInput");

      const newPassword = newPassInput ? newPassInput.value : "";
      const confirmPassword = confirmPassInput ? confirmPassInput.value : "";
      const code = codeInput ? codeInput.value.trim() : currentGeneratedCode;

      if (!newPassword || newPassword.length < 4) {
        showLoginAlert(feedbackAlert, "⚠️ Password must be at least 4 characters long.", "error");
        return;
      }

      if (newPassword !== confirmPassword) {
        showLoginAlert(feedbackAlert, "❌ Passwords do not match.", "error");
        return;
      }

      const submitBtn = resetForm.querySelector("button[type='submit']");
      const origText = submitBtn.innerText;
      submitBtn.innerText = "Updating Password...";
      submitBtn.disabled = true;

      try {
        const res = await fetch(`${API_URL}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: currentPendingEmail,
            code,
            newPassword,
          }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          showLoginAlert(feedbackAlert, "✅ Password reset successfully! Redirecting to login...", "success");
          setTimeout(() => {
            window.location.href = "login.html";
          }, 1500);
        } else {
          showLoginAlert(feedbackAlert, `❌ ${data.message || "Failed to reset password."}`, "error");
        }
      } catch (err) {
        showLoginAlert(feedbackAlert, "⚠️ Server error updating password.", "error");
      } finally {
        submitBtn.innerText = origText;
        submitBtn.disabled = false;
      }
    });
  }
}

/**
 * Navigate user to their respective dashboard
 */
function redirectToRoleDashboard(role) {
  window.location.href = "dashboard.html";
}

/**
 * Utility: Show alert message in login/forgot password card
 */
function showLoginAlert(alertEl, msg, type) {
  if (!alertEl) return;
  alertEl.innerText = msg;
  alertEl.style.display = "block";
  if (type === "success") {
    alertEl.style.background = "#dcfce7";
    alertEl.style.color = "#15803d";
    alertEl.style.border = "1px solid #bbf7d0";
  } else {
    alertEl.style.background = "#fee2e2";
    alertEl.style.color = "#b91c1c";
    alertEl.style.border = "1px solid #fecaca";
  }
}

function hideLoginAlert(alertEl) {
  if (!alertEl) return;
  alertEl.style.display = "none";
}
