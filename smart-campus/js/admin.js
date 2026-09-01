// ==========================================================================
// SMART CAMPUS - ADMIN DASHBOARD CONTROLLER (admin.js)
// ==========================================================================

// Base API URL: connects to http://localhost:3000 in local dev, or relative path on deployed Vercel
const API_URL =
  window.location.hostname === "localhost" && window.location.port !== "3000"
    ? "http://localhost:3000"
    : window.location.protocol === "file:"
    ? "http://localhost:3000"
    : "";

// ==========================================================================
// 1. STRICT ROLE-BASED ACCESS CONTROL (RBAC) GUARD
// ==========================================================================
function checkAdminAccess() {
  const userStr = localStorage.getItem("smart_campus_user");

  if (!userStr) {
    const defaultAdmin = {
      id: "usr_admin_1",
      name: "Campus Administrator",
      email: "admin@campus.edu",
      role: "admin",
      department: "Campus Administration",
      year: "Staff",
    };
    localStorage.setItem("smart_campus_user", JSON.stringify(defaultAdmin));
    return true;
  }

  try {
    const user = JSON.parse(userStr);

    if (user.role !== "admin") {
      alert(`⛔ Access Denied!\nYou are logged in as "${user.role.toUpperCase()}". Only System Administrators can access the Admin Portal.`);

      if (user.role === "faculty") {
        window.location.href = "faculty-dashboard.html";
      } else if (user.role === "student") {
        window.location.href = "student-dashboard.html";
      } else {
        window.location.href = "login.html";
      }
      return false;
    }

    return true;
  } catch (err) {
    return true;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const hasAccess = checkAdminAccess();
  if (!hasAccess) return;

  checkBackendHealth();
  loadAdminAcademics();
});

function refreshAdminData() {
  checkBackendHealth();
  loadAdminAcademics();
}

async function checkBackendHealth() {
  const statusElement = document.getElementById("serverStatus");
  if (!statusElement) return;

  try {
    const res = await fetch(`${API_URL}/`);
    const data = await res.json();
    if (res.ok) {
      statusElement.innerText = "Online";
      statusElement.style.color = "var(--success)";
    } else {
      statusElement.innerText = "Error (500)";
      statusElement.style.color = "var(--danger)";
    }
  } catch (e) {
    statusElement.innerText = "Offline (Local)";
    statusElement.style.color = "var(--danger)";
  }
}

async function loadAdminAcademics() {
  const listContainer = document.getElementById("adminAcademicList");
  const countBadge = document.getElementById("totalSubjects");
  const adminBadge = document.getElementById("adminAcademicBadge");

  if (!listContainer) return;

  listContainer.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
      <p>⏳ Loading platform academic records...</p>
    </div>
  `;

  try {
    const res = await fetch(`${API_URL}/api/academic`);
    if (!res.ok) throw new Error("API responded with error");
    const records = await res.json();
    const list = Array.isArray(records) ? records : (records.data || []);

    if (countBadge) countBadge.innerText = list.length;
    if (adminBadge) adminBadge.innerText = `${list.length} Subjects Registered`;

    if (list.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <h4>No Subjects Registered in System</h4>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = list
      .map((item) => {
        const id = item._id || item.id;
        const name = item.subjectName || "N/A";
        const code = item.subjectCode || "N/A";
        const sem = item.semester || "Semester 1";
        const dept = item.academicDepartment || item.department || "General";
        const yr = item.academicYear || item.year || "1st Year";
        const faculty = item.facultyName || "Faculty Member";

        return `
          <div class="item-card">
            <div class="item-header">
              <h4 class="item-title">${name}</h4>
              <span class="item-code">${code}</span>
            </div>
            <div class="item-meta">
              <span class="meta-chip chip-primary">${sem}</span>
              <span class="meta-chip">${dept}</span>
              <span class="meta-chip">${yr}</span>
            </div>
            <div class="item-footer">
              <span>👨‍🏫 ${faculty}</span>
              <span style="font-size: 0.75rem; color: var(--text-light);">ID: ${id.substring(0, 8)}...</span>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    listContainer.innerHTML = `
      <div style="grid-column: 1 / -1; background: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 1.5rem; text-align: center;">
        <h4 style="color: #c53030;">⚠️ Cannot Connect to Backend</h4>
        <p style="color: #742a2a; font-size: 0.9rem;">Backend server is offline</p>
      </div>
    `;
  }
}
