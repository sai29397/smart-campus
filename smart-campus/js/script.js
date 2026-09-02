// ==========================================================================
// SMART CAMPUS - LANDING PAGE CONTROLLER (script.js)
// ==========================================================================

function getApiBaseUrl() {
  if (typeof window === "undefined") return "http://localhost:3000";
  // If running on deployed domain or production (Vercel, Render) or same port 3000
  if (
    window.location.hostname.includes("vercel.app") ||
    window.location.hostname.includes("onrender.com") ||
    window.location.port === "3000"
  ) {
    return "";
  }
  if (window.location.protocol === "file:") {
    return "http://localhost:3000";
  }
  return `${window.location.protocol}//${window.location.hostname}:3000`;
}

const API_URL = getApiBaseUrl();

document.addEventListener("DOMContentLoaded", () => {
  initLandingPageSession();
  loadLiveCampusFeed();
  setupSmoothScrolling();
});

/**
 * Check if a user is already signed in and update navbar / portal buttons
 */
function initLandingPageSession() {
  const token = localStorage.getItem("smart_campus_token");
  const userJson = localStorage.getItem("smart_campus_user");

  if (!token || !userJson) return;

  try {
    const user = JSON.parse(userJson);
    const navLinks = document.querySelector(".nav-links");
    if (navLinks) {
      navLinks.innerHTML = `
        <a href="index.html" class="active">Home</a>
        <a href="#features">Features</a>
        <a href="dashboard.html" class="btn btn-primary btn-sm">🎓 Dashboard (${user.name.split(" ")[0]})</a>
        <button onclick="handleLandingLogout()" class="btn btn-outline btn-sm">Sign Out</button>
      `;
    }

    // Update portal buttons
    const facultyBtn = document.getElementById("facultyPortalBtn");
    const studentBtn = document.getElementById("studentPortalBtn");
    const adminBtn = document.getElementById("adminPortalBtn");

    if (facultyBtn && user.role === "faculty") {
      facultyBtn.innerText = "Open Faculty Dashboard →";
      facultyBtn.href = "dashboard.html";
    }
    if (studentBtn && user.role === "student") {
      studentBtn.innerText = "Open Student Dashboard →";
      studentBtn.href = "dashboard.html";
    }
    if (adminBtn && (user.role === "admin" || user.role === "administration")) {
      adminBtn.innerText = "Open Admin Dashboard →";
      adminBtn.href = "dashboard.html";
    }
  } catch (e) {
    console.warn("Error parsing stored session:", e);
  }
}

/**
 * Logout helper from landing page
 */
function handleLandingLogout() {
  localStorage.removeItem("smart_campus_token");
  localStorage.removeItem("smart_campus_user");
  window.location.reload();
}

/**
 * Fetch and render live campus announcements on landing page feed
 */
async function loadLiveCampusFeed() {
  const container = document.getElementById("liveCampusFeedContainer");
  const badge = document.getElementById("liveFeedCountBadge");
  if (!container) return;

  try {
    const res = await fetch(`${API_URL}/api/announcements`);
    const data = await res.json();

    const notices = Array.isArray(data) ? data : data.data || [];

    if (badge) {
      badge.innerText = `${notices.length} Live`;
    }

    if (notices.length === 0) {
      container.innerHTML = `
        <div class="item-card" style="margin-bottom: 0.75rem;">
          <div class="item-header">
            <h4 class="item-title">📢 Welcome to Smart Campus</h4>
            <span class="meta-chip chip-primary">General</span>
          </div>
          <p class="item-desc">Semester activities and campus communication platform are active.</p>
          <div class="item-footer">
            <span>🏛️ Campus Wide</span>
            <span>🕒 Live</span>
          </div>
        </div>
      `;
      return;
    }

    // Display top 3 latest announcements
    const topNotices = notices.slice(0, 3);
    container.innerHTML = topNotices
      .map((n) => {
        const priorityChip =
          n.priority === "urgent" || n.priority === "high"
            ? "chip-high"
            : n.priority === "medium"
            ? "chip-medium"
            : "chip-primary";
        const priorityLabel = (n.priority || "Normal").toUpperCase();
        const dept = n.department || "Campus Wide";
        const timeStr = n.createdAt
          ? new Date(n.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "Today";

        return `
          <div class="item-card" style="margin-bottom: 0.75rem;">
            <div class="item-header">
              <h4 class="item-title">📢 ${escapeHtml(n.title)}</h4>
              <span class="meta-chip ${priorityChip}">${priorityLabel}</span>
            </div>
            <p class="item-desc">${escapeHtml(n.content || n.message || "")}</p>
            <div class="item-footer">
              <span>🏛️ ${escapeHtml(dept)}</span>
              <span>🕒 ${timeStr}</span>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.warn("Could not load live feed from server:", err);
    container.innerHTML = `
      <div class="item-card" style="margin-bottom: 1rem;">
        <div class="item-header">
          <h4 class="item-title">📢 Mid-Term Exam Schedule</h4>
          <span class="meta-chip chip-high">Urgent</span>
        </div>
        <p class="item-desc">CS501 & CS502 examination timetable published.</p>
        <div class="item-footer">
          <span>🏛️ Computer Science</span>
          <span>🕒 Today</span>
        </div>
      </div>
      <div class="item-card">
        <div class="item-header">
          <h4 class="item-title">📚 Hackathon 2026 Registration</h4>
          <span class="meta-chip chip-medium">Important</span>
        </div>
        <p class="item-desc">Annual intra-college hackathon registrations are open.</p>
        <div class="item-footer">
          <span>🏛️ Campus Wide</span>
          <span>🕒 Yesterday</span>
        </div>
      </div>
    `;
  }
}

/**
 * Smooth scrolling for landing page hash links
 */
function setupSmoothScrolling() {
  const links = document.querySelectorAll("a[href^='#']");
  links.forEach((link) => {
    link.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId && targetId !== "#") {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({ behavior: "smooth" });
        }
      }
    });
  });
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
