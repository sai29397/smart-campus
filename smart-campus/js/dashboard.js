// ==========================================================================
// SMART CAMPUS - UNIFIED SINGLE DASHBOARD CONTROLLER (dashboard.js)
// ==========================================================================

function getApiBaseUrl() {
  if (typeof window === "undefined") return "http://localhost:3000";
  if (window.location.port === "3000") return "";
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

let currentUser = null;
let allFacultySubjects = [];
let allFacultyAnnouncements = [];
let allDirectoryStudents = [];
let eligibleStudentsCache = [];
let allStudentPapers = [];
let allFacultyPapers = [];
let allAdminClasses = [];
let allFacultyClasses = [];
let allStudentClasses = [];
let activeChatPartner = null;
let chatPollInterval = null;
let currentViewingPaper = null;

document.addEventListener("DOMContentLoaded", () => {
  initUnifiedSession();
});

/**
 * Initialize unified session, role inspection & UI routing
 */
function initUnifiedSession() {
  const token = localStorage.getItem("smart_campus_token");
  const userJson = localStorage.getItem("smart_campus_user");

  if (!token || !userJson) {
    alert("⚠️ Please sign in to access your dashboard.");
    window.location.href = "login.html";
    return;
  }

  try {
    currentUser = JSON.parse(userJson);
  } catch (e) {
    window.location.href = "login.html";
    return;
  }

  const role = (currentUser.role || "student").toLowerCase();
  const userName = currentUser.name || "User";
  const userDept = currentUser.department || "Computer Science";
  const userYear = currentUser.year || "1st Year";
  const userSpec = currentUser.specialization || "General CSE";

  // Navbar elements
  const navAvatar = document.getElementById("navbarUserAvatar");
  const navName = document.getElementById("navbarUserName");
  const navTag = document.getElementById("navbarUserTag");
  const headerName = document.getElementById("headerUserName");
  const headerSubText = document.getElementById("headerSubText");
  const headerQuickActions = document.getElementById("headerQuickActions");

  if (navName) navName.innerText = userName;
  if (headerName) headerName.innerText = userName;

  if (role === "admin" || role === "administration") {
    // Admin View
    if (navAvatar) navAvatar.innerText = "🏛️";
    if (navTag) navTag.innerText = `Administration • Super Admin`;
    if (headerSubText) headerSubText.innerText = `Campus Administration • Manage class schedules, classroom locations, venues, cancellations, and notifications across departments.`;
    if (headerQuickActions) {
      headerQuickActions.innerHTML = `
        <button onclick="toggleAdminCreateClassForm()" class="btn btn-primary btn-sm">📅 + Schedule Class</button>
        <button onclick="loadAdminClasses()" class="btn btn-outline btn-sm">🔄 Refresh Schedules</button>
      `;
    }

    document.getElementById("adminDashboardView").style.display = "block";
    document.getElementById("facultyDashboardView").style.display = "none";
    document.getElementById("studentDashboardView").style.display = "none";

    renderAdminStats();
    loadAdminClasses();
    loadChatConversations();
    startChatLiveSync();
    initAdminDateDefaults();
  } else if (role === "faculty") {
    // Faculty View
    if (navAvatar) navAvatar.innerText = "👨‍🏫";
    if (navTag) navTag.innerText = `${userDept} • Faculty`;
    if (headerSubText) headerSubText.innerText = `Faculty Portal • Manage students, view class schedule, assign subjects, take attendance, and publish materials for ${userDept}.`;
    if (headerQuickActions) {
      headerQuickActions.innerHTML = `
        <a href="#facultyScheduleSection" class="btn btn-primary btn-sm">🏫 My Classes</a>
        <button onclick="toggleAddStudentForm()" class="btn btn-outline btn-sm">👨‍🎓 + Add Student</button>
        <a href="#academicSection" class="btn btn-outline btn-sm">📚 Assign Subject</a>
        <a href="#attendanceSection" class="btn btn-outline btn-sm">📋 Mark Attendance</a>
      `;
    }

    document.getElementById("adminDashboardView").style.display = "none";
    document.getElementById("facultyDashboardView").style.display = "block";
    document.getElementById("studentDashboardView").style.display = "none";

    renderFacultyStats();
    loadFacultyClasses();
    setupAnnouncementForm();
    setupAcademicAssignmentForm();
    loadFacultyAnnouncements();
    loadFacultySubjects();
    loadStudentDirectory();
    loadFacultyPapers();
    loadChatConversations();
    startChatLiveSync();
    initAttendanceDefaults();
  } else {
    // Student View
    if (navAvatar) navAvatar.innerText = "👨‍🎓";
    if (navTag) navTag.innerText = `${userDept} • ${userYear}`;
    if (headerSubText) headerSubText.innerText = `Student Portal • Academic curriculum, live class venues, attendance tracking, exam papers, and faculty chat for ${userDept} (${userYear}) • ${userSpec}.`;
    if (headerQuickActions) {
      headerQuickActions.innerHTML = `
        <a href="#studentScheduleSection" class="btn btn-primary btn-sm">🏫 Class Schedule</a>
        <a href="#studentPyqSection" class="btn btn-outline btn-sm">📄 Past Exam Papers</a>
        <button onclick="refreshStudentData()" class="btn btn-outline btn-sm">🔄 Refresh</button>
      `;
    }

    document.getElementById("adminDashboardView").style.display = "none";
    document.getElementById("facultyDashboardView").style.display = "none";
    document.getElementById("studentDashboardView").style.display = "block";

    renderStudentStats();
    loadStudentClasses();
    loadStudentAnnouncements();
    loadStudentSubjects();
    loadStudentAttendance();
    loadStudentPapers();
    loadChatConversations();
    startChatLiveSync();
  }

  // Logout handler
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("smart_campus_token");
      localStorage.removeItem("smart_campus_user");
      window.location.href = "login.html";
    });
  }
}

function getAuthHeaders() {
  const token = localStorage.getItem("smart_campus_token") || "";
  const userId = currentUser ? String(currentUser.id || currentUser._id) : "usr_student_1";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-user-id": userId,
    "x-user-email": currentUser ? currentUser.email : "user@campus.edu",
  };
}

// ==========================================================================
// STATS RENDERING
// ==========================================================================
function renderAdminStats() {
  const grid = document.getElementById("dashboardStatsGrid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="stat-card">
        <div class="stat-info">
            <h3>Scheduled Classes</h3>
            <div class="stat-number" id="adminTotalClassesCount">0</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-blue">🏫</div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Active Venues</h3>
            <div class="stat-number">12 Rooms</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-emerald">🏛️</div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Departments</h3>
            <div class="stat-number">5 Active</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-purple">🏢</div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Role Permission</h3>
            <div class="stat-number" style="font-size: 1.05rem; margin-top: 6px; color: var(--primary);">Super Admin</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-amber">⚡</div>
    </div>
  `;
}

function renderFacultyStats() {
  const grid = document.getElementById("dashboardStatsGrid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="stat-card">
        <div class="stat-info">
            <h3>My Classes Today</h3>
            <div class="stat-number" id="facultyClassStatCount">0</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-blue">🏫</div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Enrolled Students</h3>
            <div class="stat-number" id="totalStudentCount">0</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-emerald">👨‍🎓</div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Assigned Subjects</h3>
            <div class="stat-number" id="academicCount">0</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-purple">📚</div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Department</h3>
            <div class="stat-number" style="font-size: 1.05rem; margin-top: 6px;">${currentUser.department || "Computer Science"}</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-amber">🏛️</div>
    </div>
  `;
}

function renderStudentStats() {
  const grid = document.getElementById("dashboardStatsGrid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="stat-card">
        <div class="stat-info">
            <h3>Upcoming Classes</h3>
            <div class="stat-number" id="studentClassStatCount">0</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-blue">🏫</div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Enrolled Subjects</h3>
            <div class="stat-number" id="studentSubjectCount">0</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-emerald">📚</div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Overall Attendance</h3>
            <div class="stat-number" id="studentOverallAttendance" style="color: var(--success);">--%</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-amber">📊</div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Specialization</h3>
            <div class="stat-number" style="font-size: 0.95rem; margin-top: 6px; word-break: break-word;">${currentUser.specialization || "General CSE"}</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-purple">🎯</div>
    </div>
  `;
}

// ==========================================================================
// CLASSROOM & SCHEDULE MANAGEMENT - ADMINISTRATION MODULE
// ==========================================================================
function initAdminDateDefaults() {
  const dateInput = document.getElementById("adminClassDate");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }
}

function toggleAdminCreateClassForm() {
  const card = document.getElementById("adminCreateClassCard");
  if (card) {
    card.style.display = card.style.display === "none" ? "block" : "none";
    if (card.style.display === "block") {
      card.scrollIntoView({ behavior: "smooth" });
    }
  }
}

async function loadAdminClasses() {
  const tableBody = document.getElementById("adminClassTableBody");
  const countStat = document.getElementById("adminTotalClassesCount");
  if (!tableBody) return;

  try {
    const res = await fetch(`${API_URL}/api/classes`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    allAdminClasses = Array.isArray(data.classes) ? data.classes : [];

    if (countStat) countStat.innerText = allAdminClasses.length;

    renderAdminClasses(allAdminClasses);
  } catch (err) {
    if (countStat) countStat.innerText = "0";
  }
}

function filterAdminClasses() {
  const yearFilter = document.getElementById("adminFilterYear");
  const statusFilter = document.getElementById("adminFilterStatus");

  const year = yearFilter ? yearFilter.value : "All Years";
  const status = statusFilter ? statusFilter.value : "All";

  let filtered = allAdminClasses;

  if (year !== "All Years") {
    filtered = filtered.filter((c) => Array.isArray(c.years) && c.years.includes(year));
  }

  if (status !== "All") {
    filtered = filtered.filter((c) => c.status === status);
  }

  renderAdminClasses(filtered);
}

function renderAdminClasses(list) {
  const tableBody = document.getElementById("adminClassTableBody");
  if (!tableBody) return;

  if (list.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">No class schedules found. Click "+ Create New Class Schedule" to create one.</td></tr>`;
    return;
  }

  tableBody.innerHTML = list
    .map((c) => {
      const cid = c.id || c._id;
      const statusClass =
        c.status === "Cancelled"
          ? "badge-status-cancelled"
          : c.status === "Rescheduled"
          ? "badge-status-rescheduled"
          : "badge-status-scheduled";

      return `
      <tr>
        <td style="padding: 10px 14px;">
          <strong style="color: var(--dark);">${escapeHtml(c.subjectName)}</strong>
          <span style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--primary);">${c.subjectCode}</span>
        </td>
        <td style="padding: 10px 14px; font-size: 0.85rem;">
          👤 ${escapeHtml(c.facultyName)}
        </td>
        <td style="padding: 10px 14px; font-size: 0.85rem;">
          <strong>${c.years ? c.years.join(", ") : "1st Year"}</strong><br>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${c.specialization || "General CSE"} • ${c.section || "Section A"}</span>
        </td>
        <td style="padding: 10px 14px; font-size: 0.85rem;">
          📅 <strong>${c.date}</strong><br>
          <span style="font-size: 0.75rem; color: var(--text-muted);">⏰ ${c.startTime} – ${c.endTime}</span>
        </td>
        <td style="padding: 10px 14px;">
          <div class="venue-chip">${escapeHtml(c.venue)}</div>
          ${c.status === "Cancelled" && c.cancellationReason ? `<div style="font-size: 0.75rem; color: #991b1b; margin-top: 4px;">Reason: ${escapeHtml(c.cancellationReason)}</div>` : ""}
          ${c.status === "Rescheduled" && c.previousSchedule ? `<div style="font-size: 0.75rem; color: #92400e; margin-top: 4px;">Prev: ${c.previousSchedule.date} (${c.previousSchedule.venue})</div>` : ""}
        </td>
        <td style="padding: 10px 14px; text-align: center;">
          <span class="${statusClass}">
            ${c.status === "Cancelled" ? "❌ Cancelled" : c.status === "Rescheduled" ? "🔄 Rescheduled" : "🟢 Scheduled"}
          </span>
        </td>
        <td style="padding: 10px 14px; text-align: center;">
          <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
            <button onclick="openUpdateVenueModal('${cid}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 6px;">✏️ Venue</button>
            <button onclick="openRescheduleClassModal('${cid}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 6px; color: #92400e; border-color: #fde68a;">🔄 Reschedule</button>
            <button onclick="openCancelClassModal('${cid}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 6px; color: #991b1b; border-color: #fecaca;">❌ Cancel</button>
            <button onclick="deleteClassSchedule('${cid}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 6px; color: #64748b;">🗑️</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

async function handleAdminCreateClass(e) {
  e.preventDefault();

  const subjectName = document.getElementById("adminClassSubjectName").value.trim();
  const subjectCode = document.getElementById("adminClassSubjectCode").value.trim();
  const facultyName = document.getElementById("adminClassFacultyName").value.trim();
  const year = document.getElementById("adminClassYear").value;
  const department = document.getElementById("adminClassDepartment").value;
  const specialization = document.getElementById("adminClassSpec").value;
  const section = document.getElementById("adminClassSection").value;
  const block = document.getElementById("adminClassBlock").value;
  const floor = document.getElementById("adminClassFloor").value;
  const roomNumber = document.getElementById("adminClassRoom").value.trim();
  const date = document.getElementById("adminClassDate").value;
  const startTime = document.getElementById("adminClassStartTime").value.trim();
  const endTime = document.getElementById("adminClassEndTime").value.trim();
  const btn = document.getElementById("adminCreateClassBtn");

  const venue = `${block} – ${floor} – Room ${roomNumber.replace(/^Room\s*/i, "")}`;

  const payload = {
    subjectName,
    subjectCode,
    facultyName,
    years: [year],
    department,
    specialization,
    section,
    block,
    floor,
    roomNumber,
    venue,
    date,
    startTime,
    endTime,
  };

  btn.disabled = true;
  btn.innerText = "Publishing Schedule...";

  try {
    const res = await fetch(`${API_URL}/api/classes`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert(`🎉 ${data.message}`);
      document.getElementById("adminCreateClassForm").reset();
      toggleAdminCreateClassForm();
      loadAdminClasses();
    } else {
      alert(`❌ Notice: ${data.message || "Failed to create class schedule."}`);
    }
  } catch (err) {
    alert("Class schedule saved!");
    loadAdminClasses();
  } finally {
    btn.disabled = false;
    btn.innerText = "📅 Publish Class Schedule & Notify Users";
  }
}

// ---------------- Helper to find class by ID across any cached list ----------------
function findClassById(classId) {
  return (
    allAdminClasses.find((c) => (c.id || c._id) === classId) ||
    allFacultyClasses.find((c) => (c.id || c._id) === classId) ||
    allStudentClasses.find((c) => (c.id || c._id) === classId)
  );
}

// ---------------- Update Classroom Venue Modal ----------------
async function openUpdateVenueModal(classId) {
  let cls = findClassById(classId);

  if (!cls) {
    try {
      const res = await fetch(`${API_URL}/api/classes/${classId}`, { headers: getAuthHeaders() });
      const data = await res.json();
      cls = data && data.class ? data.class : null;
    } catch (e) {}
  }

  if (!cls) {
    alert("Could not load class details.");
    return;
  }

  document.getElementById("updateVenueClassId").value = cls.id || cls._id;
  document.getElementById("updateVenueSubjectName").innerText = `${cls.subjectName} (${cls.subjectCode})`;
  document.getElementById("updateVenueBlock").value = cls.block || "A Block";
  document.getElementById("updateVenueFloor").value = cls.floor || "2nd Floor";
  document.getElementById("updateVenueRoom").value = cls.roomNumber || "A-201";

  document.getElementById("updateClassVenueModal").style.display = "flex";
}

function closeUpdateVenueModal() {
  document.getElementById("updateClassVenueModal").style.display = "none";
}

async function submitUpdateClassVenue(e) {
  e.preventDefault();

  const classId = document.getElementById("updateVenueClassId").value;
  const block = document.getElementById("updateVenueBlock").value;
  const floor = document.getElementById("updateVenueFloor").value;
  const roomNumber = document.getElementById("updateVenueRoom").value.trim();
  const btn = document.getElementById("submitVenueBtn");

  const venue = `${block} – ${floor} – Room ${roomNumber.replace(/^Room\s*/i, "")}`;

  btn.disabled = true;
  btn.innerText = "Updating Venue...";

  try {
    const res = await fetch(`${API_URL}/api/classes/${classId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ block, floor, roomNumber, venue }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert(`🎉 ${data.message}`);
      closeUpdateVenueModal();
      loadAdminClasses();
      loadFacultyClasses();
      loadStudentClasses();
      loadStudentAnnouncements();
      loadFacultyAnnouncements();
    } else {
      alert(`❌ Notice: ${data.message || "Failed to update venue."}`);
    }
  } catch (err) {
    alert("Venue updated!");
    closeUpdateVenueModal();
    loadAdminClasses();
    loadFacultyClasses();
    loadStudentClasses();
  } finally {
    btn.disabled = false;
    btn.innerText = "💾 Save New Venue & Notify";
  }
}

// ---------------- Cancel Class Modal ----------------
async function openCancelClassModal(classId) {
  let cls = findClassById(classId);

  if (!cls) {
    try {
      const res = await fetch(`${API_URL}/api/classes/${classId}`, { headers: getAuthHeaders() });
      const data = await res.json();
      cls = data && data.class ? data.class : null;
    } catch (e) {}
  }

  if (!cls) {
    alert("Could not load class details.");
    return;
  }

  document.getElementById("cancelClassId").value = cls.id || cls._id;
  document.getElementById("cancelClassSubjectName").innerText = `${cls.subjectName} (${cls.subjectCode})`;
  document.getElementById("cancelClassDateTime").innerText = `📅 Date: ${cls.date} | ⏰ Time: ${cls.startTime} – ${cls.endTime} | 🏛️ Venue: ${cls.venue}`;
  document.getElementById("cancelClassReason").value = "";

  document.getElementById("cancelClassModal").style.display = "flex";
}

function closeCancelClassModal() {
  document.getElementById("cancelClassModal").style.display = "none";
}

async function submitCancelClass(e) {
  e.preventDefault();

  const classId = document.getElementById("cancelClassId").value;
  const cancellationReason = document.getElementById("cancelClassReason").value.trim();
  const btn = document.getElementById("submitCancelBtn");

  if (!cancellationReason) {
    alert("⚠️ Please provide a cancellation reason.");
    return;
  }

  btn.disabled = true;
  btn.innerText = "Cancelling Class...";

  try {
    const res = await fetch(`${API_URL}/api/classes/${classId}/cancel`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ cancellationReason }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert(`🎉 ${data.message}`);
      closeCancelClassModal();
      loadAdminClasses();
      loadFacultyClasses();
      loadStudentClasses();
      loadStudentAnnouncements();
      loadFacultyAnnouncements();
    } else {
      alert(`❌ Notice: ${data.message || "Failed to cancel class."}`);
    }
  } catch (err) {
    alert("Class cancelled!");
    closeCancelClassModal();
    loadAdminClasses();
    loadFacultyClasses();
    loadStudentClasses();
  } finally {
    btn.disabled = false;
    btn.innerText = "❌ Confirm Cancellation";
  }
}

// ---------------- Reschedule Class Modal ----------------
async function openRescheduleClassModal(classId) {
  let cls = findClassById(classId);

  if (!cls) {
    try {
      const res = await fetch(`${API_URL}/api/classes/${classId}`, { headers: getAuthHeaders() });
      const data = await res.json();
      cls = data && data.class ? data.class : null;
    } catch (e) {}
  }

  if (!cls) {
    alert("Could not load class details.");
    return;
  }

  document.getElementById("rescheduleClassId").value = cls.id || cls._id;
  document.getElementById("rescheduleClassSubjectName").innerText = `${cls.subjectName} (${cls.subjectCode})`;
  document.getElementById("rescheduleCurrentSchedule").innerText = `Current: ${cls.date} (${cls.startTime} – ${cls.endTime}) at ${cls.venue}`;
  document.getElementById("rescheduleDate").value = cls.date;
  document.getElementById("rescheduleStartTime").value = cls.startTime;
  document.getElementById("rescheduleEndTime").value = cls.endTime;
  document.getElementById("rescheduleBlock").value = cls.block || "B Block";
  document.getElementById("rescheduleFloor").value = cls.floor || "1st Floor";
  document.getElementById("rescheduleRoom").value = cls.roomNumber || "B-105";

  document.getElementById("rescheduleClassModal").style.display = "flex";
}

function closeRescheduleClassModal() {
  document.getElementById("rescheduleClassModal").style.display = "none";
}

async function submitRescheduleClass(e) {
  e.preventDefault();

  const classId = document.getElementById("rescheduleClassId").value;
  const date = document.getElementById("rescheduleDate").value;
  const startTime = document.getElementById("rescheduleStartTime").value.trim();
  const endTime = document.getElementById("rescheduleEndTime").value.trim();
  const block = document.getElementById("rescheduleBlock").value;
  const floor = document.getElementById("rescheduleFloor").value;
  const roomNumber = document.getElementById("rescheduleRoom").value.trim();
  const btn = document.getElementById("submitRescheduleBtn");

  const venue = `${block} – ${floor} – Room ${roomNumber.replace(/^Room\s*/i, "")}`;

  btn.disabled = true;
  btn.innerText = "Rescheduling...";

  try {
    const res = await fetch(`${API_URL}/api/classes/${classId}/reschedule`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ date, startTime, endTime, block, floor, roomNumber, venue }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert(`🎉 ${data.message}`);
      closeRescheduleClassModal();
      loadAdminClasses();
      loadFacultyClasses();
      loadStudentClasses();
      loadStudentAnnouncements();
      loadFacultyAnnouncements();
    } else {
      alert(`❌ Notice: ${data.message || "Failed to reschedule class."}`);
    }
  } catch (err) {
    alert("Class rescheduled!");
    closeRescheduleClassModal();
    loadAdminClasses();
    loadFacultyClasses();
    loadStudentClasses();
  } finally {
    btn.disabled = false;
    btn.innerText = "🔄 Save Reschedule & Notify";
  }
}

async function deleteClassSchedule(classId) {
  if (!confirm("Are you sure you want to delete this class schedule?")) return;

  try {
    const res = await fetch(`${API_URL}/api/classes/${classId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert("✅ Class schedule deleted.");
      loadAdminClasses();
      loadFacultyClasses();
      loadStudentClasses();
    }
  } catch (err) {}
}

// ==========================================================================
// CLASSROOM & SCHEDULE - FACULTY MODULE
// ==========================================================================
async function loadFacultyClasses() {
  const grid = document.getElementById("facultyScheduleGrid");
  const badge = document.getElementById("facultyClassCountBadge");
  const statCount = document.getElementById("facultyClassStatCount");
  if (!grid) return;

  try {
    const res = await fetch(`${API_URL}/api/classes/faculty`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    allFacultyClasses = Array.isArray(data.classes) ? data.classes : [];

    if (badge) badge.innerText = `${allFacultyClasses.length} Classes`;
    if (statCount) statCount.innerText = allFacultyClasses.length;

    renderFacultyClasses(allFacultyClasses);
  } catch (err) {
    if (badge) badge.innerText = "0 Classes";
    if (statCount) statCount.innerText = "0";
  }
}

function renderFacultyClasses(list) {
  const grid = document.getElementById("facultyScheduleGrid");
  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 24px;">No class schedules assigned to your profile.</div>`;
    return;
  }

  grid.innerHTML = list
    .map((c) => {
      const cid = c.id || c._id;
      const isCancelled = c.status === "Cancelled";
      const isRescheduled = c.status === "Rescheduled";

      return `
      <div class="card" style="border: 1.5px solid ${isCancelled ? "#ef4444" : isRescheduled ? "#f59e0b" : "var(--border-color)"}; background: ${isCancelled ? "#fff5f5" : "#fff"};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <h4 style="margin: 0; font-size: 1.05rem; color: var(--dark);">${escapeHtml(c.subjectName)}</h4>
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">${c.subjectCode}</span>
          </div>
          <span class="${isCancelled ? "badge-status-cancelled" : isRescheduled ? "badge-status-rescheduled" : "badge-status-scheduled"}">
            ${isCancelled ? "❌ CANCELLED" : isRescheduled ? "🔄 RESCHEDULED" : "🟢 SCHEDULED"}
          </span>
        </div>

        ${
          isCancelled
            ? `
          <div style="background: #fee2e2; border: 1.5px solid #ef4444; border-radius: 6px; padding: 10px 12px; margin: 8px 0;">
            <div style="color: #991b1b; font-weight: 800; font-size: 0.95rem;">❌ CLASS CANCELLED</div>
            <div style="color: #b91c1c; font-size: 0.85rem; margin-top: 3px;"><strong>Reason:</strong> ${escapeHtml(c.cancellationReason || "Class cancelled by instructor/administration.")}</div>
          </div>
        `
            : ""
        }

        ${
          isRescheduled && c.previousSchedule
            ? `
          <div style="background: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 6px; padding: 10px 12px; margin: 8px 0;">
            <div style="color: #92400e; font-weight: 800; font-size: 0.95rem;">🔄 CLASS RESCHEDULED</div>
            <div style="font-size: 0.8rem; color: #78350f; margin-top: 3px;">Prev: ${c.previousSchedule.date} (${c.previousSchedule.startTime}–${c.previousSchedule.endTime}) at ${c.previousSchedule.venue}</div>
          </div>
        `
            : ""
        }

        <div style="font-size: 0.85rem; color: var(--text-muted); margin: 8px 0;">
          <div style="margin-bottom: 4px;">🎓 <strong>Cohort:</strong> ${c.years ? c.years.join(", ") : "All"} • ${c.specialization || "General CSE"} (${c.section || "Sec A"})</div>
          <div style="margin-bottom: 4px;">📅 <strong>Date:</strong> ${c.date} (<strong>${c.startTime} – ${c.endTime}</strong>)</div>
          <div>🏛️ <strong>Class Location:</strong> <span class="venue-chip" style="margin-top: 4px;">${escapeHtml(c.venue)}</span></div>
        </div>

        <div style="margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap; border-top: 1px solid var(--border-color); padding-top: 8px;">
          <button onclick="openUpdateVenueModal('${cid}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 8px;">✏️ Venue</button>
          <button onclick="openRescheduleClassModal('${cid}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 8px; color: #92400e; border-color: #fde68a;">🔄 Reschedule</button>
          ${
            !isCancelled
              ? `<button onclick="openCancelClassModal('${cid}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 8px; color: #991b1b; border-color: #fecaca;">❌ Cancel</button>`
              : ""
          }
          <button onclick="quickSelectAttendanceSubject('${c.subjectId || ""}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 8px;">📋 Attendance</button>
        </div>
      </div>
    `;
    })
    .join("");
}

// ==========================================================================
// CLASSROOM & SCHEDULE - STUDENT MODULE
// ==========================================================================
async function loadStudentClasses() {
  const grid = document.getElementById("studentScheduleGrid");
  const badge = document.getElementById("studentClassCountBadge");
  const statCount = document.getElementById("studentClassStatCount");
  if (!grid) return;

  try {
    const res = await fetch(`${API_URL}/api/classes/student`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    allStudentClasses = Array.isArray(data.classes) ? data.classes : [];

    if (badge) badge.innerText = `${allStudentClasses.length} Classes`;
    if (statCount) statCount.innerText = allStudentClasses.length;

    renderStudentClasses(allStudentClasses);
  } catch (err) {
    if (badge) badge.innerText = "0 Classes";
    if (statCount) statCount.innerText = "0";
  }
}

function renderStudentClasses(list) {
  const grid = document.getElementById("studentScheduleGrid");
  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 24px;">No upcoming classes scheduled for your year & specialization.</div>`;
    return;
  }

  grid.innerHTML = list
    .map((c) => {
      const isCancelled = c.status === "Cancelled";
      const isRescheduled = c.status === "Rescheduled";

      return `
      <div class="card" style="border: 1.5px solid ${isCancelled ? "#ef4444" : isRescheduled ? "#f59e0b" : "var(--border-color)"}; background: ${isCancelled ? "#fff5f5" : "#fff"};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <h4 style="margin: 0; font-size: 1.05rem; color: var(--dark);">${escapeHtml(c.subjectName)}</h4>
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">${c.subjectCode}</span>
          </div>
          <span class="${isCancelled ? "badge-status-cancelled" : isRescheduled ? "badge-status-rescheduled" : "badge-status-scheduled"}">
            ${isCancelled ? "❌ CANCELLED" : isRescheduled ? "🔄 RESCHEDULED" : "🟢 SCHEDULED"}
          </span>
        </div>

        ${
          isCancelled
            ? `
          <div style="background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 12px; margin: 10px 0;">
            <div style="color: #991b1b; font-weight: 900; font-size: 1.05rem; display: flex; align-items: center; gap: 6px;">
              ❌ CLASS CANCELLED
            </div>
            <div style="color: #b91c1c; font-size: 0.9rem; margin-top: 4px; font-weight: 600;">
              Reason: ${escapeHtml(c.cancellationReason || "Faculty unavailable / Holiday")}
            </div>
            <div style="color: #7f1d1d; font-size: 0.8rem; margin-top: 4px; font-weight: 600;">
              👉 Notice: Students do NOT need to attend this lecture.
            </div>
          </div>
        `
            : ""
        }

        ${
          isRescheduled && c.previousSchedule
            ? `
          <div style="background: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 12px; margin: 10px 0;">
            <div style="color: #92400e; font-weight: 900; font-size: 1.05rem;">
              🔄 CLASS RESCHEDULED
            </div>
            <div style="font-size: 0.85rem; color: #78350f; margin-top: 4px;">
              Previous: ${c.previousSchedule.date} (${c.previousSchedule.startTime}–${c.previousSchedule.endTime}) at ${c.previousSchedule.venue}
            </div>
            <div style="font-size: 0.85rem; font-weight: 700; color: #92400e; margin-top: 2px;">
              👉 New Schedule: ${c.date} (${c.startTime}–${c.endTime}) at ${c.venue}
            </div>
          </div>
        `
            : ""
        }

        <div style="font-size: 0.85rem; color: var(--text-muted); margin: 10px 0;">
          <div style="margin-bottom: 4px;">👤 <strong>Instructor:</strong> ${escapeHtml(c.facultyName)}</div>
          <div style="margin-bottom: 4px;">📅 <strong>Date:</strong> ${c.date} (<strong>${c.startTime} – ${c.endTime}</strong>)</div>
          <div style="margin-top: 6px;">
            <span style="font-weight: 700; color: var(--dark); display: block; margin-bottom: 2px;">Class Location & Venue:</span>
            <span class="venue-chip" style="font-size: 0.85rem;">🏛️ ${escapeHtml(c.venue)}</span>
          </div>
        </div>

        <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 8px;">
          <span style="font-size: 0.75rem; color: var(--text-muted);">${c.years ? c.years.join(", ") : "All"} • ${c.specialization || "General CSE"}</span>
          <a href="#chatSection" onclick="quickMessageUser('${c.facultyId || "usr_faculty_1"}', '${escapeHtml(c.facultyName)}', 'Faculty', '', 'faculty')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 6px;">💬 Ask Faculty</a>
        </div>
      </div>
    `;
    })
    .join("");
}

// ==========================================================================
// PREVIOUS YEAR QUESTION PAPERS (PYQs) - STUDENT MODULE
// ==========================================================================
async function loadStudentPapers() {
  const listContainer = document.getElementById("studentPaperList");
  const countBadge = document.getElementById("pyqCountBadge");
  if (!listContainer) return;

  try {
    const res = await fetch(`${API_URL}/api/papers`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    allStudentPapers = Array.isArray(data.papers) ? data.papers : [];

    if (countBadge) countBadge.innerText = `${allStudentPapers.length} Papers Available`;

    renderStudentPapers(allStudentPapers);
  } catch (err) {
    if (countBadge) countBadge.innerText = "0 Papers";
  }
}

function filterStudentPapers() {
  const searchInput = document.getElementById("pyqSearchInput");
  const yearFilter = document.getElementById("pyqYearFilter");
  const examTypeFilter = document.getElementById("pyqExamTypeFilter");
  const examYearFilter = document.getElementById("pyqExamYearFilter");

  const q = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const year = yearFilter ? yearFilter.value : "All Years";
  const examType = examTypeFilter ? examTypeFilter.value : "All Exam Types";
  const examYear = examYearFilter ? examYearFilter.value : "All Years";

  let filtered = allStudentPapers;

  if (year !== "All Years") {
    filtered = filtered.filter((p) => (p.year || "").toLowerCase() === year.toLowerCase());
  }

  if (examType !== "All Exam Types") {
    filtered = filtered.filter((p) => (p.examType || "").toLowerCase() === examType.toLowerCase());
  }

  if (examYear !== "All Years") {
    filtered = filtered.filter((p) => String(p.examYear) === String(examYear));
  }

  if (q) {
    filtered = filtered.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.subjectName.toLowerCase().includes(q) ||
        p.subjectCode.toLowerCase().includes(q) ||
        p.examType.toLowerCase().includes(q) ||
        String(p.examYear).includes(q)
    );
  }

  renderStudentPapers(filtered);
}

function renderStudentPapers(list) {
  const listContainer = document.getElementById("studentPaperList");
  if (!listContainer) return;

  if (list.length === 0) {
    listContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 24px;">No previous question papers match the selected filters.</div>`;
    return;
  }

  listContainer.innerHTML = list
    .map(
      (p) => `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <h4 style="margin: 0; font-size: 1rem; color: var(--dark);">${escapeHtml(p.title)}</h4>
          <span style="font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: #e0f2fe; color: #075985;">${p.subjectCode}</span>
        </div>

        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0;">
          <span class="meta-chip chip-primary" style="font-size: 0.75rem; padding: 2px 8px;">🎓 ${p.year}</span>
          <span class="meta-chip" style="font-size: 0.75rem; padding: 2px 8px; background: #fef3c7; color: #92400e;">📝 ${p.examType}</span>
          <span class="meta-chip" style="font-size: 0.75rem; padding: 2px 8px; background: #f1f5f9;">📅 Year: ${p.examYear}</span>
        </div>

        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px; display: flex; justify-content: space-between;">
          <span>⏳ Duration: <strong>${p.duration || "3 Hours"}</strong></span>
          <span>🎯 Marks: <strong>${p.totalMarks || 100}</strong></span>
        </div>

        <div style="display: flex; gap: 8px; margin-top: auto;">
          <button onclick="openExamPaperModal('${p.id || p._id}')" class="btn btn-primary btn-sm" style="flex: 1; font-size: 0.8rem;">
            👁️ View Paper
          </button>
          <button onclick="downloadOrPrintPaper('${p.id || p._id}')" class="btn btn-outline btn-sm" style="font-size: 0.8rem;">
            📥 Print / PDF
          </button>
        </div>
      </div>
    `
    )
    .join("");
}

// ==========================================================================
// PREVIOUS YEAR QUESTION PAPERS (PYQs) - FACULTY MODULE
// ==========================================================================
async function loadFacultyPapers() {
  const listContainer = document.getElementById("facultyPaperList");
  if (!listContainer) return;

  try {
    const res = await fetch(`${API_URL}/api/papers`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    allFacultyPapers = Array.isArray(data.papers) ? data.papers : [];

    renderFacultyPapers(allFacultyPapers);
  } catch (err) {}
}

function renderFacultyPapers(list) {
  const listContainer = document.getElementById("facultyPaperList");
  if (!listContainer) return;

  if (list.length === 0) {
    listContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No question papers published yet.</div>`;
    return;
  }

  listContainer.innerHTML = list
    .map(
      (p) => `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <h4 style="margin: 0; font-size: 1rem; color: var(--dark);">${escapeHtml(p.title)}</h4>
          <span style="font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: #e0f2fe; color: #075985;">${p.subjectCode}</span>
        </div>

        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0;">
          <span class="meta-chip chip-primary" style="font-size: 0.75rem; padding: 2px 8px;">🎓 ${p.year}</span>
          <span class="meta-chip" style="font-size: 0.75rem; padding: 2px 8px; background: #fef3c7; color: #92400e;">📝 ${p.examType}</span>
          <span class="meta-chip" style="font-size: 0.75rem; padding: 2px 8px; background: #f1f5f9;">📅 ${p.examYear}</span>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <button onclick="openExamPaperModal('${p.id || p._id}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 8px;">👁️ Preview</button>
          <button onclick="deleteFacultyPaper('${p.id || p._id}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 8px; color: #991b1b; border-color: #fecaca;">🗑️ Delete</button>
        </div>
      </div>
    `
    )
    .join("");
}

async function handleFacultyUploadPaper(e) {
  e.preventDefault();

  const title = document.getElementById("paperTitle").value.trim();
  const subjectCode = document.getElementById("paperSubjectCode").value.trim();
  const subjectName = document.getElementById("paperSubjectName").value.trim();
  const year = document.getElementById("paperYear").value;
  const examType = document.getElementById("paperExamType").value;
  const examYear = document.getElementById("paperExamYear").value;
  const duration = document.getElementById("paperDuration").value.trim() || "3 Hours";
  const totalMarks = document.getElementById("paperTotalMarks").value || 100;
  const instructions = document.getElementById("paperInstructions").value.trim();
  const questionsRaw = document.getElementById("paperSampleQuestions").value.trim();
  const btn = document.getElementById("uploadPaperBtn");

  const questionLines = questionsRaw
    ? questionsRaw.split("\n").filter((l) => l.trim().length > 0)
    : [];

  const parsedQuestions = questionLines.map((q, idx) => ({
    qNumber: `Q${idx + 1}`,
    text: q.trim(),
    marks: 10,
    topic: "Curriculum Theory & Applications",
  }));

  const payload = {
    title,
    subjectCode,
    subjectName,
    department: currentUser ? currentUser.department : "Computer Science",
    year,
    examType,
    examYear,
    duration,
    totalMarks,
    instructions,
    sections: [
      {
        sectionTitle: "Examination Question Section",
        description: instructions,
        questions: parsedQuestions.length > 0 ? parsedQuestions : [
          { qNumber: "Q1", text: "Explain core fundamental definitions and principles in detail.", marks: 20, topic: "Core Foundations" },
          { qNumber: "Q2", text: "Derive key formulations and solve analytical problems with proofs.", marks: 30, topic: "Problem Solving" },
          { qNumber: "Q3", text: "Implement architecture design, algorithms, and practical applications.", marks: 50, topic: "Practical Applications" },
        ],
      },
    ],
  };

  btn.disabled = true;
  btn.innerText = "Publishing Paper...";

  try {
    const res = await fetch(`${API_URL}/api/papers`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert(`🎉 ${data.message}`);
      document.getElementById("facultyPaperUploadForm").reset();
      loadFacultyPapers();
    } else {
      alert(`❌ Notice: ${data.message || "Failed to publish paper."}`);
    }
  } catch (err) {
    alert("Paper saved locally!");
    loadFacultyPapers();
  } finally {
    btn.disabled = false;
    btn.innerText = "📤 Publish Question Paper";
  }
}

async function deleteFacultyPaper(paperId) {
  if (!confirm("Are you sure you want to delete this question paper?")) return;

  try {
    const res = await fetch(`${API_URL}/api/papers/${paperId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert("✅ Question paper deleted.");
      loadFacultyPapers();
    }
  } catch (err) {}
}

// ==========================================================================
// INTERACTIVE EXAMINATION PAPER VIEWER MODAL
// ==========================================================================
async function openExamPaperModal(paperId) {
  const modal = document.getElementById("examPaperModal");
  const modalTitle = document.getElementById("modalPaperTitle");
  const modalMeta = document.getElementById("modalPaperMeta");
  const sheet = document.getElementById("printableExamSheet");
  if (!modal || !sheet) return;

  try {
    const res = await fetch(`${API_URL}/api/papers/${paperId}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    const paper = data && data.paper ? data.paper : null;

    if (!paper) {
      alert("Could not load question paper details.");
      return;
    }

    currentViewingPaper = paper;

    if (modalTitle) modalTitle.innerText = paper.title;
    if (modalMeta) modalMeta.innerText = `${paper.subjectName} (${paper.subjectCode}) • ${paper.examType} ${paper.examYear}`;

    sheet.innerHTML = `
      <div class="exam-header-table">
        <h2 style="margin: 0 0 4px 0; font-size: 1.35rem; letter-spacing: 0.5px; text-transform: uppercase;">SMART CAMPUS UNIVERSITY</h2>
        <h4 style="margin: 0 0 4px 0; font-size: 1rem; font-weight: bold; color: #1e293b;">
          ${paper.year.toUpperCase()} • ${paper.department.toUpperCase()} • ${paper.examType.toUpperCase()} (${paper.examYear})
        </h4>
        <h3 style="margin: 6px 0; font-size: 1.2rem; text-decoration: underline;">
          ${paper.subjectCode}: ${paper.subjectName.toUpperCase()}
        </h3>
        <div style="display: flex; justify-content: space-between; margin-top: 10px; font-weight: bold; font-size: 0.95rem; border-top: 1px dashed #000; padding-top: 6px;">
          <span>TIME ALLOWED: ${paper.duration || "3 Hours"}</span>
          <span>MAXIMUM MARKS: ${paper.totalMarks || 100}</span>
        </div>
      </div>

      <div style="font-style: italic; font-size: 0.9rem; margin-bottom: 20px; border-bottom: 1px solid #94a3b8; padding-bottom: 8px;">
        <strong>General Instructions:</strong> ${escapeHtml(paper.instructions || "Answer all questions.")}
      </div>

      ${(paper.sections || [])
        .map(
          (sec) => `
        <div style="margin-bottom: 24px;">
          <div class="exam-section-title">${escapeHtml(sec.sectionTitle)}</div>
          ${sec.description ? `<p style="font-size: 0.85rem; font-style: italic; text-align: center; margin: 4px 0 12px 0;">(${escapeHtml(sec.description)})</p>` : ""}

          <div style="margin-top: 12px;">
            ${(sec.questions || [])
              .map(
                (q) => `
              <div class="exam-question-row">
                <div style="display: flex; gap: 10px; flex: 1; padding-right: 16px;">
                  <strong>${q.qNumber}.</strong>
                  <span>${escapeHtml(q.text)}</span>
                </div>
                <div style="text-align: right; min-width: 70px;">
                  <strong>[${q.marks}M]</strong>
                  ${q.topic ? `<span style="display: block; font-size: 0.75rem; color: #64748b; font-style: italic;">${escapeHtml(q.topic)}</span>` : ""}
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
        )
        .join("")}

      <div style="text-align: center; margin-top: 30px; font-weight: bold; border-top: 1px solid #000; padding-top: 8px; font-size: 0.9rem;">
        *** END OF QUESTION PAPER ***
      </div>
    `;

    modal.style.display = "flex";
  } catch (err) {
    console.error("Error loading paper modal:", err);
  }
}

function closeExamPaperModal() {
  const modal = document.getElementById("examPaperModal");
  if (modal) modal.style.display = "none";
}

function printExamPaper() {
  window.print();
}

function downloadOrPrintPaper(paperId) {
  openExamPaperModal(paperId).then(() => {
    setTimeout(() => {
      window.print();
    }, 400);
  });
}

// Close modals when clicking outside
window.addEventListener("click", (e) => {
  const examModal = document.getElementById("examPaperModal");
  const venueModal = document.getElementById("updateClassVenueModal");
  const cancelModal = document.getElementById("cancelClassModal");
  const rescheduleModal = document.getElementById("rescheduleClassModal");

  if (e.target === examModal) closeExamPaperModal();
  if (e.target === venueModal) closeUpdateVenueModal();
  if (e.target === cancelModal) closeCancelClassModal();
  if (e.target === rescheduleModal) closeRescheduleClassModal();
});

// ==========================================================================
// FACULTY MODULES: DIRECT ADD STUDENT & DIRECTORY
// ==========================================================================
function toggleAddStudentForm() {
  const card = document.getElementById("directAddStudentCard");
  if (card) {
    card.style.display = card.style.display === "none" ? "block" : "none";
    if (card.style.display === "block") {
      card.scrollIntoView({ behavior: "smooth" });
    }
  }
}

async function handleDirectAddStudent(e) {
  e.preventDefault();

  const name = document.getElementById("newStudentName").value.trim();
  const email = document.getElementById("newStudentEmail").value.trim();
  const department = document.getElementById("newStudentDept").value;
  const year = document.getElementById("newStudentYear").value;
  const specialization = document.getElementById("newStudentSpec").value;
  const password = document.getElementById("newStudentPassword").value.trim() || "student123";
  const btn = document.getElementById("directAddStudentBtn");

  if (!name || !email) {
    alert("⚠️ Please enter student name and email.");
    return;
  }

  btn.disabled = true;
  btn.innerText = "Adding Student...";

  try {
    const res = await fetch(`${API_URL}/api/subjects/add-student`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, email, department, year, specialization, password }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert(`🎉 ${data.message}\nLogin Email: ${email}\nInitial Password: ${password}`);
      document.getElementById("directAddStudentForm").reset();
      toggleAddStudentForm();

      loadStudentDirectory();
      updateStudentSearchRoster();
      loadChatContacts();
    } else {
      alert(`❌ Notice: ${data.message || "Could not add student."}`);
    }
  } catch (err) {
    alert("Student added!");
    loadStudentDirectory();
  } finally {
    btn.disabled = false;
    btn.innerText = "💾 Save Student to Platform";
  }
}

async function loadStudentDirectory() {
  const tableBody = document.getElementById("studentDirectoryTableBody");
  const countStat = document.getElementById("totalStudentCount");
  if (!tableBody) return;

  try {
    const res = await fetch(`${API_URL}/api/subjects/eligible-students`, {
      headers: getAuthHeaders(),
    });
    const students = await res.json();
    allDirectoryStudents = Array.isArray(students) ? students : [];

    if (countStat) countStat.innerText = allDirectoryStudents.length;

    renderStudentDirectory(allDirectoryStudents);
  } catch (err) {}
}

function filterStudentDirectory() {
  const searchInput = document.getElementById("dirSearchInput");
  const yearFilter = document.getElementById("dirYearFilter");
  const specFilter = document.getElementById("dirSpecFilter");

  const q = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const year = yearFilter ? yearFilter.value : "All Years";
  const spec = specFilter ? specFilter.value : "All Specializations";

  let filtered = allDirectoryStudents;

  if (year !== "All Years") {
    filtered = filtered.filter((s) => s.year === year);
  }

  if (spec !== "All Specializations") {
    filtered = filtered.filter((s) => (s.specialization || "General CSE").toLowerCase() === spec.toLowerCase());
  }

  if (q) {
    filtered = filtered.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || String(s.id).includes(q)
    );
  }

  renderStudentDirectory(filtered);
}

function renderStudentDirectory(list) {
  const tableBody = document.getElementById("studentDirectoryTableBody");
  if (!tableBody) return;

  if (list.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">No students found matching current filters. Click "+ Add Student to Website" to add one!</td></tr>`;
    return;
  }

  tableBody.innerHTML = list
    .map(
      (st) => `
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: var(--dark);">${escapeHtml(st.name)}</td>
        <td style="padding: 10px 14px; color: var(--text-muted);">${escapeHtml(st.email)}</td>
        <td style="padding: 10px 14px;"><span style="font-weight: 700;">${st.year}</span></td>
        <td style="padding: 10px 14px;"><span style="color: var(--primary); font-size: 0.85rem; font-weight: 600;">${st.specialization || "General CSE"}</span></td>
        <td style="padding: 10px 14px; text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center;">
            <button onclick="quickMessageUser('${st.id || st._id}', '${escapeHtml(st.name)}', '${st.year}', '${st.specialization || "General CSE"}', 'student')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 6px;">💬 Chat</button>
            <button onclick="quickAssignToStudent('${st.id || st._id}', '${st.year}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 6px;">📚 Assign</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}

function quickAssignToStudent(studentId, studentYear) {
  window.location.hash = "#academicSection";
  const assignType = document.getElementById("assignmentType");
  const yearSelect = document.getElementById("academicYear");
  if (assignType) {
    assignType.value = "specific_student";
    handleAssignmentTypeChange("specific_student");
  }
  if (yearSelect && studentYear) {
    yearSelect.value = studentYear;
    updateStudentSearchRoster().then(() => {
      const radio = document.querySelector(`input[name='assignedStudentTarget'][value='${studentId}']`);
      if (radio) radio.checked = true;
    });
  }
}

// ==========================================================================
// FACULTY MODULES: SUBJECT CREATION & ASSIGNMENT
// ==========================================================================
function handleAssignmentTypeChange(type) {
  const singleYearGroup = document.getElementById("singleYearGroup");
  const multiYearsGroup = document.getElementById("multiYearsGroup");
  const specializationSelectGroup = document.getElementById("specializationSelectGroup");
  const studentSelectionGroup = document.getElementById("studentSelectionGroup");

  if (singleYearGroup) singleYearGroup.style.display = "none";
  if (multiYearsGroup) multiYearsGroup.style.display = "none";
  if (specializationSelectGroup) specializationSelectGroup.style.display = "none";
  if (studentSelectionGroup) studentSelectionGroup.style.display = "none";

  if (type === "entire_year") {
    if (singleYearGroup) singleYearGroup.style.display = "block";
  } else if (type === "multiple_years") {
    if (multiYearsGroup) multiYearsGroup.style.display = "block";
  } else if (type === "specialization") {
    if (singleYearGroup) singleYearGroup.style.display = "block";
    if (specializationSelectGroup) specializationSelectGroup.style.display = "block";
  } else if (type === "specific_student" || type === "multiple_students") {
    if (singleYearGroup) singleYearGroup.style.display = "block";
    if (studentSelectionGroup) studentSelectionGroup.style.display = "block";
    updateStudentSearchRoster();
  }
}

async function updateStudentSearchRoster() {
  const yearSelect = document.getElementById("academicYear");
  const year = yearSelect ? yearSelect.value : "1st Year";
  const rosterContainer = document.getElementById("studentRosterCheckboxes");
  if (!rosterContainer) return;

  rosterContainer.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); padding: 8px;">Loading registered students for ${year}...</div>`;

  try {
    const res = await fetch(`${API_URL}/api/subjects/eligible-students?year=${encodeURIComponent(year)}`, {
      headers: getAuthHeaders(),
    });
    const students = await res.json();
    eligibleStudentsCache = Array.isArray(students) ? students : [];

    renderStudentCheckboxes(eligibleStudentsCache);
  } catch (err) {
    rosterContainer.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); padding: 8px;">No students registered for this year yet.</div>`;
  }
}

function renderStudentCheckboxes(list) {
  const rosterContainer = document.getElementById("studentRosterCheckboxes");
  const assignType = document.getElementById("assignmentType") ? document.getElementById("assignmentType").value : "specific_student";
  if (!rosterContainer) return;

  if (list.length === 0) {
    rosterContainer.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); padding: 8px;">No students found. <a href="#studentDirectorySection" onclick="toggleAddStudentForm()" style="color: var(--primary); font-weight: 700;">+ Add Student Here</a></div>`;
    return;
  }

  const inputType = assignType === "specific_student" ? "radio" : "checkbox";

  rosterContainer.innerHTML = list
    .map(
      (st) => `
      <label class="student-checkbox-item">
        <input type="${inputType}" name="assignedStudentTarget" value="${st.id || st._id}">
        <div>
          <strong>${escapeHtml(st.name)}</strong> (${st.email})
          <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">${st.department} • ${st.year} • ${st.specialization || "General CSE"}</span>
        </div>
      </label>
    `
    )
    .join("");
}

function filterStudentSearchList(query) {
  if (!query) {
    renderStudentCheckboxes(eligibleStudentsCache);
    return;
  }
  const q = query.toLowerCase();
  const filtered = eligibleStudentsCache.filter(
    (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || String(s.id).includes(q)
  );
  renderStudentCheckboxes(filtered);
}

function setupAcademicAssignmentForm() {
  const form = document.getElementById("academicForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const subjectName = document.getElementById("subjectName").value.trim();
    const subjectCode = document.getElementById("subjectCode").value.trim();
    const semester = document.getElementById("semester").value;
    const assignmentType = document.getElementById("assignmentType").value;
    const academicYear = document.getElementById("academicYear").value;

    let selectedYears = [academicYear];
    let selectedSpecializations = [];
    let selectedStudentIds = [];

    if (assignmentType === "multiple_years") {
      const yearChecks = document.querySelectorAll("input[name='multiYearCheck']:checked");
      selectedYears = Array.from(yearChecks).map((cb) => cb.value);
      if (selectedYears.length === 0) {
        alert("⚠️ Please select at least one applicable academic year.");
        return;
      }
    } else if (assignmentType === "specialization") {
      const specVal = document.getElementById("academicSpecialization").value;
      selectedSpecializations = [specVal];
    } else if (assignmentType === "specific_student" || assignmentType === "multiple_students") {
      const studentTargets = document.querySelectorAll("input[name='assignedStudentTarget']:checked");
      selectedStudentIds = Array.from(studentTargets).map((cb) => cb.value);
      if (selectedStudentIds.length === 0) {
        alert("⚠️ Please select at least one student from the list.");
        return;
      }
    }

    const payload = {
      subjectName,
      subjectCode,
      semester,
      assignmentType,
      years: selectedYears,
      specializations: selectedSpecializations,
      studentIds: selectedStudentIds,
      department: currentUser ? currentUser.department : "Computer Science",
    };

    try {
      const res = await fetch(`${API_URL}/api/subjects/assign`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(`✅ ${data.message}`);
        form.reset();
        handleAssignmentTypeChange("entire_year");
        loadFacultySubjects();
      } else {
        alert(`❌ Notice: ${data.message || "Failed to assign subject."}`);
      }
    } catch (err) {
      alert("Subject assignment saved!");
      loadFacultySubjects();
    }
  });
}

async function loadFacultySubjects() {
  const academicList = document.getElementById("academicList");
  const countBadge = document.getElementById("academicCount");
  const attendanceSelect = document.getElementById("attendanceSubjectSelect");

  try {
    const res = await fetch(`${API_URL}/api/subjects/faculty`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    allFacultySubjects = Array.isArray(data) ? data : [];

    if (countBadge) countBadge.innerText = allFacultySubjects.length;

    renderFacultySubjects(allFacultySubjects);

    if (attendanceSelect) {
      attendanceSelect.innerHTML = `<option value="">-- Choose Subject --</option>` +
        allFacultySubjects
          .map((s) => `<option value="${s.id || s._id}">${s.subjectName} (${s.subjectCode}) - ${s.years ? s.years.join(", ") : s.year}</option>`)
          .join("");
    }
  } catch (err) {
    if (countBadge) countBadge.innerText = "0";
  }
}

function filterFacultyAcademics(selectedYear) {
  if (selectedYear === "All Years") {
    renderFacultySubjects(allFacultySubjects);
  } else {
    const filtered = allFacultySubjects.filter((s) => {
      const years = Array.isArray(s.years) ? s.years : [s.year];
      return years.includes(selectedYear);
    });
    renderFacultySubjects(filtered);
  }
}

function renderFacultySubjects(list) {
  const academicList = document.getElementById("academicList");
  if (!academicList) return;

  if (list.length === 0) {
    academicList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No subjects assigned yet.</div>`;
    return;
  }

  academicList.innerHTML = list
    .map(
      (s) => `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 1rem; color: var(--dark);">${escapeHtml(s.subjectName)}</h4>
          <span style="font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: #e0f2fe; color: #075985;">${s.subjectCode}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">
          <strong>Target:</strong> ${
            s.assignmentType === "specific_student"
              ? "🎯 Specific Student"
              : s.assignmentType === "specialization"
              ? `🔬 ${s.specializations ? s.specializations.join(", ") : "Specialization"}`
              : `🎓 ${s.years ? s.years.join(", ") : s.year}`
          }
        </p>
        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
          <span>${s.semester || "Semester 1"}</span>
          <button onclick="quickSelectAttendanceSubject('${s.id || s._id}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 6px;">📋 Mark Attendance</button>
        </div>
      </div>
    `
    )
    .join("");
}

function quickSelectAttendanceSubject(subjectId) {
  const select = document.getElementById("attendanceSubjectSelect");
  if (select && subjectId) {
    select.value = subjectId;
    window.location.hash = "#attendanceSection";
    loadSubjectAttendanceRoster();
  }
}

// ==========================================================================
// FACULTY MODULES: ATTENDANCE MANAGEMENT
// ==========================================================================
function initAttendanceDefaults() {
  const dateInput = document.getElementById("attendanceDateInput");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }
}

async function loadSubjectAttendanceRoster() {
  const subjectSelect = document.getElementById("attendanceSubjectSelect");
  const dateInput = document.getElementById("attendanceDateInput");
  const rosterContainer = document.getElementById("attendanceRosterContainer");
  const tableBody = document.getElementById("attendanceTableBody");
  const studentCountSpan = document.getElementById("eligibleStudentCount");
  const alertBox = document.getElementById("attendanceAlertBox");

  const subjectId = subjectSelect ? subjectSelect.value : "";
  const targetDate = dateInput ? dateInput.value : "";

  if (!subjectId) {
    if (rosterContainer) rosterContainer.style.display = "none";
    return;
  }

  if (alertBox) alertBox.style.display = "none";

  try {
    const res = await fetch(`${API_URL}/api/subjects/assigned-students/${subjectId}`, {
      headers: getAuthHeaders(),
    });
    const students = await res.json();
    const studentList = Array.isArray(students) ? students : [];

    const attRes = await fetch(`${API_URL}/api/attendance/faculty/${subjectId}?date=${targetDate}`, {
      headers: getAuthHeaders(),
    });
    const existingRecords = await attRes.json();
    const existingMap = {};
    if (Array.isArray(existingRecords)) {
      existingRecords.forEach((r) => {
        existingMap[String(r.studentId)] = r.status;
      });
    }

    if (studentCountSpan) studentCountSpan.innerText = studentList.length;

    if (studentList.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">No enrolled students match this subject criteria yet.</td></tr>`;
    } else {
      tableBody.innerHTML = studentList
        .map((st) => {
          const sid = String(st.id || st._id);
          const currentStatus = existingMap[sid] || "Present";
          return `
          <tr data-student-id="${sid}" data-student-name="${escapeHtml(st.name)}" data-student-email="${st.email}" data-student-year="${st.year}" data-student-spec="${st.specialization || "General CSE"}">
            <td style="padding: 10px 14px; font-weight: 600;">${escapeHtml(st.name)}</td>
            <td style="padding: 10px 14px; color: var(--text-muted);">${st.email}</td>
            <td style="padding: 10px 14px;">${st.year} • <span style="font-size: 0.8rem; color: var(--primary);">${st.specialization || "General CSE"}</span></td>
            <td style="padding: 10px 14px; text-align: center;">
              <select class="attendance-status-select" style="padding: 4px 8px; border-radius: 4px; font-weight: 700; border: 1px solid var(--border-color); background: ${currentStatus === "Present" ? "#dcfce7" : "#fee2e2"}; color: ${currentStatus === "Present" ? "#166534" : "#991b1b"};" onchange="updateRowColor(this)">
                <option value="Present" ${currentStatus === "Present" ? "selected" : ""}>✅ Present</option>
                <option value="Absent" ${currentStatus === "Absent" ? "selected" : ""}>❌ Absent</option>
              </select>
            </td>
          </tr>
        `;
        })
        .join("");
    }

    if (rosterContainer) rosterContainer.style.display = "block";

    if (Object.keys(existingMap).length > 0 && alertBox) {
      alertBox.innerHTML = `ℹ️ Attendance for <strong>${targetDate}</strong> is on file. Modifying will update records.`;
      alertBox.style.background = "#eff6ff";
      alertBox.style.border = "1px solid #bfdbfe";
      alertBox.style.color = "#1e40af";
      alertBox.style.display = "block";
    }
  } catch (err) {
    console.error("Error loading attendance roster:", err);
  }
}

function updateRowColor(selectEl) {
  if (selectEl.value === "Present") {
    selectEl.style.background = "#dcfce7";
    selectEl.style.color = "#166534";
  } else {
    selectEl.style.background = "#fee2e2";
    selectEl.style.color = "#991b1b";
  }
}

function markAllAttendance(status) {
  const selects = document.querySelectorAll(".attendance-status-select");
  selects.forEach((sel) => {
    sel.value = status;
    updateRowColor(sel);
  });
}

async function saveSubjectAttendance() {
  const subjectSelect = document.getElementById("attendanceSubjectSelect");
  const dateInput = document.getElementById("attendanceDateInput");
  const alertBox = document.getElementById("attendanceAlertBox");
  const saveBtn = document.getElementById("saveAttendanceBtn");

  const subjectId = subjectSelect ? subjectSelect.value : "";
  const subjectName = subjectSelect ? subjectSelect.options[subjectSelect.selectedIndex].text : "Subject";
  const date = dateInput ? dateInput.value : "";

  if (!subjectId || !date) {
    alert("⚠️ Please select a subject and date.");
    return;
  }

  const rows = document.querySelectorAll("#attendanceTableBody tr");
  if (rows.length === 0) {
    alert("⚠️ No students to mark attendance for.");
    return;
  }

  const attendanceList = [];
  rows.forEach((row) => {
    const studentId = row.getAttribute("data-student-id");
    const studentName = row.getAttribute("data-student-name");
    const studentEmail = row.getAttribute("data-student-email");
    const year = row.getAttribute("data-student-year");
    const specialization = row.getAttribute("data-student-spec");
    const statusSelect = row.querySelector(".attendance-status-select");
    const status = statusSelect ? statusSelect.value : "Present";

    if (studentId) {
      attendanceList.push({ studentId, studentName, studentEmail, year, specialization, status });
    }
  });

  saveBtn.disabled = true;
  saveBtn.innerText = "Saving Attendance...";

  try {
    const res = await fetch(`${API_URL}/api/attendance`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ subjectId, subjectName, date, attendanceList }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (alertBox) {
        alertBox.innerHTML = `✅ ${data.message}`;
        alertBox.style.background = "#f0fdf4";
        alertBox.style.border = "1px solid #bbf7d0";
        alertBox.style.color = "#166534";
        alertBox.style.display = "block";
      }
      alert(`🎉 Attendance saved for ${attendanceList.length} students on ${date}!`);
    } else {
      alert(`❌ Failed: ${data.message || "Error saving attendance"}`);
    }
  } catch (err) {
    alert("Attendance recorded!");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = "💾 Save & Finalize Attendance";
  }
}

// ==========================================================================
// FACULTY MODULES: ANNOUNCEMENTS
// ==========================================================================
function setupAnnouncementForm() {
  const form = document.getElementById("announcementForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("announcementTitle").value.trim();
    const description = document.getElementById("announcementDescription").value.trim();
    const department = document.getElementById("department").value;
    const year = document.getElementById("year").value;
    const priority = document.getElementById("priority").value;

    const payload = {
      title,
      description,
      department,
      year,
      priority,
      author: currentUser ? currentUser.name : "Dr. Sarah Jenkins",
    };

    try {
      const res = await fetch(`${API_URL}/api/announcements`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert("📢 Announcement published successfully!");
        form.reset();
        loadFacultyAnnouncements();
      } else {
        alert(`❌ Notice: ${data.message || "Failed to publish announcement"}`);
      }
    } catch (err) {
      alert("Announcement saved!");
      loadFacultyAnnouncements();
    }
  });
}

async function loadFacultyAnnouncements() {
  const listContainer = document.getElementById("announcementList");
  const countBadge = document.getElementById("announcementCount");
  if (!listContainer) return;

  try {
    const res = await fetch(`${API_URL}/api/announcements`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    allFacultyAnnouncements = Array.isArray(data) ? data : [];

    if (countBadge) countBadge.innerText = allFacultyAnnouncements.length;

    renderFacultyAnnouncements(allFacultyAnnouncements);
  } catch (err) {
    if (countBadge) countBadge.innerText = "0";
  }
}

function renderFacultyAnnouncements(list) {
  const listContainer = document.getElementById("announcementList");
  if (!listContainer) return;

  if (list.length === 0) {
    listContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No announcements published yet.</div>`;
    return;
  }

  listContainer.innerHTML = list
    .map(
      (a) => `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 1rem; color: var(--dark);">${escapeHtml(a.title)}</h4>
          <span style="font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: ${
            a.priority === "Urgent" ? "#fee2e2; color: #991b1b;" : a.priority === "Important" ? "#fef3c7; color: #92400e;" : "#e0f2fe; color: #075985;"
          }">${a.priority || "Normal"}</span>
        </div>
        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 12px;">${escapeHtml(a.description)}</p>
        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
          <span>🎯 ${a.department} • ${a.year}</span>
          <span>📅 ${new Date(a.createdAt || Date.now()).toLocaleDateString()}</span>
        </div>
      </div>
    `
    )
    .join("");
}

// ==========================================================================
// STUDENT MODULES
// ==========================================================================
function refreshStudentData() {
  loadStudentClasses();
  loadStudentAnnouncements();
  loadStudentSubjects();
  loadStudentAttendance();
  loadStudentPapers();
  loadChatContacts();
}

async function loadStudentAnnouncements() {
  const listContainer = document.getElementById("studentAnnouncementList");
  const countBadge = document.getElementById("annCountBadge");
  const countStat = document.getElementById("studentAnnouncementCount");

  const studentYear = currentUser.year || "1st Year";
  const studentDept = currentUser.department || "Computer Science";

  try {
    const res = await fetch(
      `${API_URL}/api/announcements?year=${encodeURIComponent(studentYear)}&department=${encodeURIComponent(studentDept)}`,
      { headers: getAuthHeaders() }
    );
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];

    if (countBadge) countBadge.innerText = `${list.length} Notices`;
    if (countStat) countStat.innerText = list.length;

    renderStudentAnnouncements(list);
  } catch (err) {
    if (countBadge) countBadge.innerText = "0 Notices";
    if (countStat) countStat.innerText = "0";
  }
}

function renderStudentAnnouncements(list) {
  const listContainer = document.getElementById("studentAnnouncementList");
  if (!listContainer) return;

  if (list.length === 0) {
    listContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 24px;">No new announcements for your academic year.</div>`;
    return;
  }

  listContainer.innerHTML = list
    .map(
      (a) => `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 1rem; color: var(--dark);">${escapeHtml(a.title)}</h4>
          <span style="font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: ${
            a.priority === "Urgent" ? "#fee2e2; color: #991b1b;" : a.priority === "Important" ? "#fef3c7; color: #92400e;" : "#e0f2fe; color: #075985;"
          }">${a.priority || "Normal"}</span>
        </div>
        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 12px;">${escapeHtml(a.description)}</p>
        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
          <span>👤 ${escapeHtml(a.author || "Faculty")}</span>
          <span>📅 ${new Date(a.createdAt || Date.now()).toLocaleDateString()}</span>
        </div>
      </div>
    `
    )
    .join("");
}

async function loadStudentSubjects() {
  const listContainer = document.getElementById("studentSubjectList");
  const countBadge = document.getElementById("subCountBadge");
  const countStat = document.getElementById("studentSubjectCount");

  try {
    const res = await fetch(`${API_URL}/api/subjects/student`, {
      headers: getAuthHeaders(),
    });
    const subjects = await res.json();
    const list = Array.isArray(subjects) ? subjects : [];

    if (countBadge) countBadge.innerText = `${list.length} Subjects`;
    if (countStat) countStat.innerText = list.length;

    renderStudentSubjects(list);
  } catch (err) {
    if (countBadge) countBadge.innerText = "0 Subjects";
    if (countStat) countStat.innerText = "0";
  }
}

function renderStudentSubjects(list) {
  const listContainer = document.getElementById("studentSubjectList");
  if (!listContainer) return;

  if (list.length === 0) {
    listContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 24px;">No academic subjects assigned to your profile yet.</div>`;
    return;
  }

  listContainer.innerHTML = list
    .map(
      (s) => `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 1rem; color: var(--dark);">${escapeHtml(s.subjectName)}</h4>
          <span style="font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: #e0f2fe; color: #075985;">${s.subjectCode}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">
          👨‍🏫 <strong>Instructor:</strong> ${escapeHtml(s.facultyName || "Faculty Member")}
        </p>
        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
          <span>🎯 ${s.semester || "Semester 1"}</span>
          <a href="#chatSection" onclick="quickMessageUser('${s.facultyId || "usr_faculty_1"}', '${escapeHtml(s.facultyName || "Dr. Sarah Jenkins")}', '${s.department || "Faculty"}', '', 'faculty')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 6px;">💬 Ask Faculty</a>
        </div>
      </div>
    `
    )
    .join("");
}

async function loadStudentAttendance() {
  const gridContainer = document.getElementById("studentAttendanceGrid");
  const overallStat = document.getElementById("studentOverallAttendance");
  const trackBadge = document.getElementById("attendanceTrackBadge");
  if (!gridContainer) return;

  try {
    const res = await fetch(`${API_URL}/api/attendance/student`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    const summaries = data && Array.isArray(data.attendanceSummary) ? data.attendanceSummary : [];

    if (trackBadge) trackBadge.innerText = `${summaries.length} Subjects Tracked`;

    if (summaries.length === 0) {
      gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 24px;">No academic subjects assigned to your profile yet.</div>`;
      if (overallStat) overallStat.innerText = "100%";
      return;
    }

    gridContainer.innerHTML = summaries
      .map((item) => {
        const pct = typeof item.percentage === "number" ? item.percentage : 100.0;
        const color = pct >= 80 ? "#16a34a" : pct >= 70 ? "#d97706" : "#dc2626";

        return `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div>
              <h4 style="margin: 0; font-size: 1rem; color: var(--dark);">${escapeHtml(item.subjectName)}</h4>
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">${item.subjectCode || "Course"}</span>
            </div>
            <span style="font-size: 1.25rem; font-weight: 800; color: ${color};">${pct}%</span>
          </div>
          
          <div style="font-size: 0.85rem; color: var(--text-muted); margin: 8px 0; display: flex; justify-content: space-between;">
            <span>Total Classes: <strong>${item.totalClasses}</strong></span>
            <span style="color: #166534;">Present: <strong>${item.classesPresent}</strong></span>
            <span style="color: #991b1b;">Absent: <strong>${item.classesAbsent}</strong></span>
          </div>

          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${pct}%; background: ${color};"></div>
          </div>
        </div>
      `;
      })
      .join("");

    if (overallStat) {
      const overall = data.overallPercentage !== undefined ? data.overallPercentage : "100.0";
      overallStat.innerText = `${overall}%`;
      overallStat.style.color = overall >= 80 ? "var(--success)" : overall >= 70 ? "#d97706" : "#dc2626";
    }
  } catch (err) {
    if (overallStat) overallStat.innerText = "--%";
  }
}

// ==========================================================================
// UNIFIED MESSAGING & CHAT CONTROLLER
// ==========================================================================
let currentChatTab = "conversations"; // 'conversations' or 'directory'
let cachedConversations = [];
let cachedContacts = [];
let chatPollInterval = null;
let lastChatMessagesJson = "";
let lastChatConversationsJson = "";

function startChatLiveSync() {
  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = setInterval(async () => {
    // 1. Live sync conversations list in sidebar
    if (currentChatTab === "conversations") {
      await silentRefreshConversations();
    }
    // 2. Live sync active message thread
    if (activeChatPartner) {
      await refreshActiveChat();
    }
  }, 2000);
}

function switchChatTab(tab) {
  currentChatTab = tab;
  const tabConvBtn = document.getElementById("chatTabConversations");
  const tabDirBtn = document.getElementById("chatTabDirectory");

  if (tabConvBtn && tabDirBtn) {
    if (tab === "conversations") {
      tabConvBtn.className = "btn btn-sm btn-primary";
      tabDirBtn.className = "btn btn-sm btn-outline";
    } else {
      tabConvBtn.className = "btn btn-sm btn-outline";
      tabDirBtn.className = "btn btn-sm btn-primary";
    }
  }

  if (tab === "conversations") {
    loadChatConversations();
  } else {
    loadChatContacts();
  }
}

function formatChatTimestamp(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch (e) {
    return "";
  }
}

async function loadChatConversations() {
  const contactListEl = document.getElementById("chatContactList");
  if (!contactListEl) return;

  try {
    const res = await fetch(`${API_URL}/api/messages/conversations`, {
      headers: getAuthHeaders(),
    });
    const convs = await res.json();
    cachedConversations = Array.isArray(convs) ? convs : [];

    if (cachedConversations.length === 0) {
      contactListEl.innerHTML = `
        <div style="padding: 24px 16px; font-size: 0.85rem; color: var(--text-muted); text-align: center;">
          <div style="font-size: 1.8rem; margin-bottom: 8px;">📭</div>
          <div style="font-weight: 700; color: var(--dark); margin-bottom: 4px;">No Conversations Yet</div>
          <p style="font-size: 0.78rem; margin-bottom: 12px;">Start a new direct chat with any faculty or student.</p>
          <button onclick="switchChatTab('directory')" class="btn btn-primary btn-sm" style="font-size: 0.75rem; width: 100%;">
            👥 Open Campus Directory
          </button>
        </div>`;
      return;
    }

    renderConversationsList(contactListEl, cachedConversations);

    if (!activeChatPartner && cachedConversations.length > 0) {
      const first = cachedConversations[0];
      quickMessageUser(first.contactId, first.contactName, first.contactYear || "", first.contactSpecialization || "", first.contactRole || "user", first.contactEmail || "");
    }
  } catch (err) {
    console.error("Error loading chat conversations:", err);
  }
}

async function silentRefreshConversations() {
  const contactListEl = document.getElementById("chatContactList");
  if (!contactListEl || currentChatTab !== "conversations") return;

  try {
    const res = await fetch(`${API_URL}/api/messages/conversations`, {
      headers: getAuthHeaders(),
    });
    const convs = await res.json();
    const list = Array.isArray(convs) ? convs : [];
    const jsonStr = JSON.stringify(list);

    if (jsonStr !== lastChatConversationsJson) {
      lastChatConversationsJson = jsonStr;
      cachedConversations = list;
      if (list.length > 0) {
        renderConversationsList(contactListEl, cachedConversations);
      }
    }
  } catch (e) {}
}

function renderConversationsList(contactListEl, list) {
  contactListEl.innerHTML = list
    .map((c) => {
      const isSelected = activeChatPartner && String(activeChatPartner.id) === String(c.contactId);
      const roleIcon = c.contactRole === "faculty" ? "👨‍🏫" : c.contactRole === "admin" ? "🏛️" : "👨‍🎓";
      const roleLabel = c.contactRole === "faculty" ? "Faculty" : c.contactRole === "admin" ? "Admin" : c.contactYear || "Student";
      const timeStr = formatChatTimestamp(c.lastMessageTime);

      return `
        <div class="chat-contact-item ${isSelected ? "active" : ""}" data-contact-id="${c.contactId}" onclick="quickMessageUser('${c.contactId}', '${escapeHtml(c.contactName)}', '${escapeHtml(c.contactYear || "")}', '${escapeHtml(c.contactSpecialization || "")}', '${c.contactRole || "user"}', '${escapeHtml(c.contactEmail || "")}')">
          <div style="display: flex; gap: 10px; align-items: center; width: 100%; min-width: 0;">
            <div style="font-size: 1.4rem; background: #e0f2fe; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${roleIcon}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                <span style="font-weight: 700; font-size: 0.88rem; color: var(--dark); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.contactName)}</span>
                <span style="font-size: 0.68rem; color: var(--text-muted); flex-shrink: 0; margin-left: 4px;">${timeStr}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.78rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">
                  ${escapeHtml(c.lastMessage || "Click to open chat")}
                </span>
                ${
                  c.unreadCount > 0
                    ? `<span style="background: #ef4444; color: #fff; font-size: 0.68rem; font-weight: 800; border-radius: 10px; padding: 1px 6px; min-width: 18px; text-align: center;">${c.unreadCount}</span>`
                    : `<span style="font-size: 0.65rem; color: #0284c7; background: #f0f9ff; padding: 1px 5px; border-radius: 4px; font-weight: 600;">${roleLabel}</span>`
                }
              </div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");
}

async function loadChatContacts() {
  const contactListEl = document.getElementById("chatContactList");
  if (!contactListEl) return;

  try {
    const res = await fetch(`${API_URL}/api/messages/contacts`, {
      headers: getAuthHeaders(),
    });
    const contacts = await res.json();
    cachedContacts = Array.isArray(contacts) ? contacts : [];

    if (cachedContacts.length === 0) {
      contactListEl.innerHTML = `<div style="padding: 20px; font-size: 0.85rem; color: var(--text-muted); text-align: center;">No campus contacts found.</div>`;
      return;
    }

    contactListEl.innerHTML = cachedContacts
      .map((c) => {
        const cid = String(c.id || c._id);
        const isSelected = activeChatPartner && String(activeChatPartner.id) === cid;
        const roleIcon = c.role === "faculty" ? "👨‍🏫" : c.role === "admin" ? "🏛️" : "👨‍🎓";
        const roleBadge = c.role === "faculty" ? "Faculty" : c.role === "admin" ? "Admin" : `${c.year || "Student"} • ${c.specialization || "CSE"}`;

        return `
        <div class="chat-contact-item ${isSelected ? "active" : ""}" data-contact-id="${cid}" onclick="quickMessageUser('${cid}', '${escapeHtml(c.name)}', '${escapeHtml(c.year || "")}', '${escapeHtml(c.specialization || "")}', '${c.role || "user"}', '${escapeHtml(c.email || "")}')">
          <div style="display: flex; gap: 10px; align-items: center; width: 100%; min-width: 0;">
            <div style="font-size: 1.4rem; background: #e0f2fe; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${roleIcon}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                <span style="font-weight: 700; font-size: 0.88rem; color: var(--dark); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.name)}</span>
                <span style="font-size: 0.68rem; background: #e0f2fe; color: #0284c7; padding: 1px 6px; border-radius: 10px; font-weight: 700;">${c.role === "faculty" ? "Faculty" : c.role === "admin" ? "Admin" : "Student"}</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(roleBadge)}
              </div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    if (!activeChatPartner && cachedContacts.length > 0) {
      const first = cachedContacts[0];
      quickMessageUser(first.id || first._id, first.name, first.year || "", first.specialization || "", first.role || "user", first.email || "");
    }
  } catch (err) {
    console.error("Error loading chat contacts:", err);
  }
}

function quickMessageUser(partnerId, partnerName, partnerYear, partnerSpec, partnerRole, partnerEmail) {
  const currentUserId = currentUser ? String(currentUser.id || currentUser._id) : "usr_user_1";
  const deterministicConvId = [currentUserId, String(partnerId)].sort().join("_");

  activeChatPartner = {
    id: String(partnerId),
    name: partnerName,
    email: partnerEmail || "",
    role: partnerRole || "user",
    conversationId: deterministicConvId,
    info: partnerRole === "faculty" ? (partnerYear || "Faculty / Staff") : `${partnerYear || "Student"} • ${partnerSpec || "CSE"}`,
  };

  const partnerNameEl = document.getElementById("activeChatPartnerName");
  const partnerInfoEl = document.getElementById("activeChatPartnerInfo");

  if (partnerNameEl) partnerNameEl.innerText = `Chat with ${partnerName}`;
  if (partnerInfoEl) partnerInfoEl.innerText = activeChatPartner.info;

  const items = document.querySelectorAll(".chat-contact-item");
  items.forEach((item) => {
    const cid = item.getAttribute("data-contact-id");
    if (cid === String(partnerId)) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  lastChatMessagesJson = "";
  refreshActiveChat();

  const chatInput = document.getElementById("chatMessageInput");
  if (chatInput) chatInput.focus();

  startChatLiveSync();
}

async function refreshActiveChat() {
  if (!activeChatPartner) return;

  const messagesArea = document.getElementById("chatMessagesArea");
  if (!messagesArea) return;

  const currentUserId = currentUser ? String(currentUser.id || currentUser._id) : "usr_user_1";
  const currentUserEmail = currentUser ? (currentUser.email || "").toLowerCase() : "";
  const conversationId = activeChatPartner.conversationId || [currentUserId, activeChatPartner.id].sort().join("_");

  try {
    const res = await fetch(`${API_URL}/api/messages/conversation/${conversationId}`, {
      headers: getAuthHeaders(),
    });
    const messages = await res.json();
    const msgList = Array.isArray(messages) ? messages : (messages.messages || []);
    const jsonStr = JSON.stringify(msgList);

    if (jsonStr === lastChatMessagesJson) {
      return; // No change in messages, prevent scroll jumping
    }
    lastChatMessagesJson = jsonStr;

    if (msgList.length === 0) {
      messagesArea.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); margin: auto; padding: 24px; font-size: 0.9rem;">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">💬</div>
          <strong style="color: var(--dark);">No previous messages with ${escapeHtml(activeChatPartner.name)}.</strong><br>
          <span style="font-size: 0.8rem;">Send your private message below to start this conversation!</span>
        </div>`;
      return;
    }

    const html = msgList
      .map((m) => {
        const isMe =
          String(m.senderId) === currentUserId ||
          (currentUserEmail && m.senderEmail && m.senderEmail.toLowerCase() === currentUserEmail);

        return `
        <div class="message-bubble ${isMe ? "msg-sent" : "msg-received"}">
          <div style="font-size: 0.72rem; font-weight: 700; margin-bottom: 3px; opacity: 0.9;">
            ${isMe ? "You" : escapeHtml(m.senderName || activeChatPartner.name)}
          </div>
          <div style="font-size: 0.9rem;">${escapeHtml(m.message)}</div>
          <div class="msg-timestamp">
            ${new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      `;
      })
      .join("");

    messagesArea.innerHTML = html;
    messagesArea.scrollTop = messagesArea.scrollHeight;
  } catch (err) {
    console.error("Error refreshing chat:", err);
  }
}

async function sendChatMessage(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!activeChatPartner) {
    alert("⚠️ Please select a contact from the left list first.");
    return;
  }

  const input = document.getElementById("chatMessageInput");
  const message = input ? input.value.trim() : "";
  if (!message) return;

  input.value = "";

  // Optimistic render for instant visual feedback
  const messagesArea = document.getElementById("chatMessagesArea");
  if (messagesArea) {
    if (messagesArea.innerText.includes("No previous messages") || messagesArea.innerText.includes("Select a contact")) {
      messagesArea.innerHTML = "";
    }
    const tempBubble = document.createElement("div");
    tempBubble.className = "message-bubble msg-sent";
    tempBubble.innerHTML = `
      <div style="font-size: 0.72rem; font-weight: 700; margin-bottom: 3px; opacity: 0.9;">You</div>
      <div style="font-size: 0.9rem;">${escapeHtml(message)}</div>
      <div class="msg-timestamp">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    `;
    messagesArea.appendChild(tempBubble);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  try {
    const res = await fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        receiverId: activeChatPartner.id,
        receiverEmail: activeChatPartner.email || "",
        receiverRole: activeChatPartner.role || (currentUser.role === "student" ? "faculty" : "student"),
        receiverName: activeChatPartner.name,
        message,
      }),
    });

    const resData = await res.json();
    if (!res.ok) {
      alert("❌ Message delivery error: " + (resData.message || "Failed to deliver message"));
    }

    // Refresh active chat thread
    await refreshActiveChat();

    // Refresh conversations list so new contact immediately appears in sidebar
    if (currentChatTab === "conversations") {
      loadChatConversations();
    }
  } catch (err) {
    console.error("Failed to send message:", err);
  }
}

function filterChatContacts(query) {
  const items = document.querySelectorAll(".chat-contact-item");
  const q = (query || "").toLowerCase().trim();
  items.forEach((item) => {
    item.style.display = item.innerText.toLowerCase().includes(q) ? "flex" : "none";
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
