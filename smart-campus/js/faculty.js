// ==========================================================================
// SMART CAMPUS - FACULTY DASHBOARD CONTROLLER (faculty.js)
// ==========================================================================

// Base API URL: connects to http://localhost:3000 in local dev, or relative path on deployed Vercel
const API_URL =
  window.location.hostname === "localhost" && window.location.port !== "3000"
    ? "http://localhost:3000"
    : window.location.protocol === "file:"
    ? "http://localhost:3000"
    : "";

// In-memory announcements list for faculty
let facultyAnnouncements = [
  {
    id: "ann_1",
    title: "Mid-Term Examination Schedule Released",
    description: "The schedule for Mid-Term Exams has been uploaded. Please verify the exam halls and timings on the portal.",
    department: "Computer Science",
    year: "3rd Year",
    priority: "Urgent",
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  },
  {
    id: "ann_2",
    title: "Mini-Project Submission Deadline",
    description: "All student groups must submit their GitHub repository links and documentation before 5:00 PM this Friday.",
    department: "Computer Science",
    year: "3rd Year",
    priority: "Important",
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  }
];

// ==========================================================================
// 1. ROLE-BASED ACCESS & SESSION BOOTSTRAP
// ==========================================================================
function ensureFacultySession() {
  let userStr = localStorage.getItem("smart_campus_user");

  if (!userStr) {
    const defaultFaculty = {
      id: "usr_faculty_1",
      name: "Dr. Sarah Jenkins",
      email: "faculty@campus.edu",
      role: "faculty",
      department: "Computer Science",
      year: "Faculty/Staff",
    };
    localStorage.setItem("smart_campus_user", JSON.stringify(defaultFaculty));
    userStr = JSON.stringify(defaultFaculty);
  }

  try {
    const user = JSON.parse(userStr);

    if (user.role === "student") {
      alert("Notice: You are currently signed in as a Student. Redirecting to the Student Portal.");
      window.location.href = "student-dashboard.html";
      return false;
    }

    return true;
  } catch (err) {
    return true;
  }
}

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  const isAllowed = ensureFacultySession();
  if (!isAllowed) return;

  console.log("SmartCampus Faculty Dashboard Initialized");
  console.log("Connecting to Backend API:", API_URL || window.location.origin);

  // Initialize faculty profile header
  initializeFacultyProfile();

  // Load Announcements
  loadAnnouncements();

  // Load Academic Details from Backend API: GET /api/academic
  loadAcademicDetails();

  // Setup Form Listeners
  setupAnnouncementForm();
  setupAcademicForm();
});

// ==========================================================================
// 2. FACULTY PROFILE INITIALIZATION
// ==========================================================================
function initializeFacultyProfile() {
  const facultyNameElement = document.getElementById("facultyName");
  const facultyTagElement = document.getElementById("facultyTag");
  const facultyDeptStat = document.getElementById("facultyDeptStat");
  const facultyHeaderDept = document.getElementById("facultyHeaderDept");
  const deptSelect = document.getElementById("department");
  const acadDeptSelect = document.getElementById("academicDepartment");

  const storedUser = localStorage.getItem("smart_campus_user");
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      const name = user.name || "Dr. Sarah Jenkins";
      const dept = user.department || "Computer Science";

      if (facultyNameElement) facultyNameElement.innerText = name;
      if (facultyTagElement) facultyTagElement.innerText = `${dept} • Faculty`;
      if (facultyDeptStat) facultyDeptStat.innerText = dept;
      if (facultyHeaderDept) facultyHeaderDept.innerText = dept;

      if (deptSelect && deptSelect.querySelector(`option[value="${dept}"]`)) {
        deptSelect.value = dept;
      }
      if (acadDeptSelect && acadDeptSelect.querySelector(`option[value="${dept}"]`)) {
        acadDeptSelect.value = dept;
      }
    } catch (e) {
      console.warn("Could not parse stored user profile", e);
    }
  }

  // Logout button handler
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("smart_campus_token");
      localStorage.removeItem("smart_campus_user");
    });
  }
}

// ==========================================================================
// 3. ACADEMIC DETAILS API INTEGRATION (GET /api/academic & POST /api/academic)
// ==========================================================================

/**
 * Fetch and display academic records from Backend API: GET /api/academic
 */
async function loadAcademicDetails() {
  const academicList = document.getElementById("academicList");
  const academicCount = document.getElementById("academicCount");

  if (!academicList) return;

  academicList.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
      <p>⏳ Loading academic details from server...</p>
    </div>
  `;

  try {
    const response = await fetch(`${API_URL}/api/academic`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const records = Array.isArray(data) ? data : (data.data || []);

    if (academicCount) {
      academicCount.innerText = records.length;
    }

    renderAcademicList(records);
  } catch (error) {
    console.error("Error loading academic details:", error);
    
    academicList.innerHTML = `
      <div style="grid-column: 1 / -1; background: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 1.5rem; text-align: center;">
        <h4 style="color: #c53030; margin-bottom: 0.5rem;">⚠️ Could not connect to Backend API</h4>
        <p style="color: #742a2a; font-size: 0.9rem; margin-bottom: 1rem;">
          Make sure backend server is running using <code>node server.js</code>
        </p>
        <button onclick="loadAcademicDetails()" class="btn btn-outline btn-sm">🔄 Retry Connection</button>
      </div>
    `;

    if (academicCount) {
      academicCount.innerText = "0";
    }
  }
}

/**
 * Render academic items into the UI grid
 */
function renderAcademicList(records) {
  const academicList = document.getElementById("academicList");
  if (!academicList) return;

  if (!records || records.length === 0) {
    academicList.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📚</div>
        <h4>No Academic Subjects Added Yet</h4>
        <p>Use the form above to add subject allocations and syllabus details.</p>
      </div>
    `;
    return;
  }

  academicList.innerHTML = records
    .map((item) => {
      const recordId = item._id || item.id;
      const dept = item.academicDepartment || item.department || "General";
      const yr = item.academicYear || item.year || "1st Year";
      const sem = item.semester || "Semester 1";
      const code = item.subjectCode || "N/A";
      const name = item.subjectName || "Untitled Subject";
      const faculty = item.facultyName || "Faculty Member";

      return `
        <div class="item-card" id="academic-card-${recordId}">
          <div class="item-header">
            <h4 class="item-title">${escapeHTML(name)}</h4>
            <span class="item-code">${escapeHTML(code)}</span>
          </div>

          <div class="item-meta">
            <span class="meta-chip chip-primary">${escapeHTML(sem)}</span>
            <span class="meta-chip">${escapeHTML(dept)}</span>
            <span class="meta-chip">${escapeHTML(yr)}</span>
          </div>

          <div class="item-footer">
            <span>👨‍🏫 ${escapeHTML(faculty)}</span>
            <button onclick="deleteAcademicRecord('${recordId}')" class="btn btn-danger btn-sm" style="padding: 2px 8px; font-size: 0.75rem;">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

/**
 * Setup Academic Form Submission: POST /api/academic
 */
function setupAcademicForm() {
  const academicForm = document.getElementById("academicForm");
  if (!academicForm) return;

  academicForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Get input values by required IDs
    const subjectNameInput = document.getElementById("subjectName");
    const subjectCodeInput = document.getElementById("subjectCode");
    const semesterInput = document.getElementById("semester");
    const academicDepartmentInput = document.getElementById("academicDepartment");
    const academicYearInput = document.getElementById("academicYear");
    const facultyNameElement = document.getElementById("facultyName");

    const subjectName = subjectNameInput ? subjectNameInput.value.trim() : "";
    const subjectCode = subjectCodeInput ? subjectCodeInput.value.trim() : "";
    const semester = semesterInput ? semesterInput.value : "";
    const academicDepartment = academicDepartmentInput ? academicDepartmentInput.value : "";
    const academicYear = academicYearInput ? academicYearInput.value : "";
    const facultyName = facultyNameElement ? facultyNameElement.innerText.trim() : "Dr. Sarah Jenkins";

    if (!subjectName || !subjectCode || !semester || !academicDepartment || !academicYear) {
      showToast("Please fill in all academic details!", "error");
      return;
    }

    const payload = {
      subjectName,
      subjectCode,
      semester,
      academicDepartment,
      department: academicDepartment,
      academicYear,
      year: academicYear,
      facultyName,
    };

    const submitBtn = academicForm.querySelector("button[type='submit']");
    const originalText = submitBtn ? submitBtn.innerText : "Save";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Saving to Server...";
    }

    try {
      const response = await fetch(`${API_URL}/api/academic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log("Academic Record Created Successfully:", result);

      showToast("Academic details saved successfully!", "success");

      // Reset form
      academicForm.reset();

      // Reload academic details from server
      await loadAcademicDetails();
    } catch (error) {
      console.error("Error submitting academic details:", error);
      showToast(`Submission Error: ${error.message}`, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
      }
    }
  });
}

/**
 * Delete Academic Record
 */
async function deleteAcademicRecord(id) {
  if (!confirm("Are you sure you want to remove this academic record?")) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/academic/${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      showToast("Academic record deleted!", "success");
      loadAcademicDetails();
    } else {
      throw new Error("Could not delete record");
    }
  } catch (error) {
    console.error("Delete error:", error);
    showToast("Failed to delete record from server.", "error");
  }
}

// ==========================================================================
// 4. ANNOUNCEMENTS SECTION CONTROLLER
// ==========================================================================

function loadAnnouncements() {
  const announcementList = document.getElementById("announcementList");
  const announcementCount = document.getElementById("announcementCount");

  if (announcementCount) {
    announcementCount.innerText = facultyAnnouncements.length;
  }

  if (!announcementList) return;

  if (facultyAnnouncements.length === 0) {
    announcementList.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📢</div>
        <h4>No Announcements Published Yet</h4>
        <p>Fill out the form above to broadcast an announcement to students.</p>
      </div>
    `;
    return;
  }

  announcementList.innerHTML = facultyAnnouncements
    .map((item) => {
      let priorityChipClass = "chip-low";
      if (item.priority === "Urgent") priorityChipClass = "chip-high";
      else if (item.priority === "Important") priorityChipClass = "chip-medium";

      return `
        <div class="item-card" id="ann-card-${item.id}">
          <div class="item-header">
            <h4 class="item-title">${escapeHTML(item.title)}</h4>
            <span class="meta-chip ${priorityChipClass}">${escapeHTML(item.priority)}</span>
          </div>

          <p class="item-desc">${escapeHTML(item.description)}</p>

          <div class="item-meta">
            <span class="meta-chip chip-primary">🏛️ ${escapeHTML(item.department)}</span>
            <span class="meta-chip">📅 ${escapeHTML(item.year)}</span>
          </div>

          <div class="item-footer">
            <span>🕒 Published: ${escapeHTML(item.date)}</span>
            <button onclick="deleteAnnouncement('${item.id}')" class="btn btn-danger btn-sm" style="padding: 2px 8px; font-size: 0.75rem;">
              Delete
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function setupAnnouncementForm() {
  const announcementForm = document.getElementById("announcementForm");
  if (!announcementForm) return;

  announcementForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const titleInput = document.getElementById("announcementTitle");
    const descInput = document.getElementById("announcementDescription");
    const deptInput = document.getElementById("department");
    const yearInput = document.getElementById("year");
    const priorityInput = document.getElementById("priority");

    const title = titleInput ? titleInput.value.trim() : "";
    const description = descInput ? descInput.value.trim() : "";
    const department = deptInput ? deptInput.value : "All Departments";
    const year = yearInput ? yearInput.value : "All Years";
    const priority = priorityInput ? priorityInput.value : "Normal";

    if (!title || !description) {
      showToast("Please provide both announcement title and description!", "error");
      return;
    }

    const newAnnouncement = {
      id: "ann_" + Date.now(),
      title,
      description,
      department,
      year,
      priority,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };

    facultyAnnouncements.unshift(newAnnouncement);
    loadAnnouncements();
    announcementForm.reset();
    showToast("Announcement published successfully!", "success");
  });
}

function deleteAnnouncement(id) {
  facultyAnnouncements = facultyAnnouncements.filter((a) => a.id !== id);
  loadAnnouncements();
  showToast("Announcement deleted.", "success");
}

// ==========================================================================
// 5. UI UTILITIES & TOAST NOTIFICATIONS
// ==========================================================================

function showToast(message, type = "info") {
  const existing = document.querySelector(".alert-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `alert-toast ${type}`;
  toast.innerHTML = `
    <span>${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}</span>
    <span>${escapeHTML(message)}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.remove();
    }
  }, 4000);
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
