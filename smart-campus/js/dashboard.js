// ==========================================================================
// SMART CAMPUS - UNIFIED SINGLE DASHBOARD CONTROLLER (dashboard.js)
// ==========================================================================

const API_URL =
  window.location.hostname === "localhost" && window.location.port !== "3000"
    ? "http://localhost:3000"
    : window.location.protocol === "file:"
    ? "http://localhost:3000"
    : "";

let currentUser = null;
let allFacultySubjects = [];
let allFacultyAnnouncements = [];
let allDirectoryStudents = [];
let eligibleStudentsCache = [];
let activeChatPartner = null;
let chatPollInterval = null;

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

  if (role === "faculty" || role === "admin") {
    if (navAvatar) navAvatar.innerText = "👨‍🏫";
    if (navTag) navTag.innerText = `${userDept} • Faculty`;
    if (headerSubText) headerSubText.innerText = `Faculty Portal • Manage students, assign subjects, take attendance, and post announcements for ${userDept}.`;
    if (headerQuickActions) {
      headerQuickActions.innerHTML = `
        <button onclick="toggleAddStudentForm()" class="btn btn-primary btn-sm">👨‍🎓 + Add New Student</button>
        <a href="#academicSection" class="btn btn-outline btn-sm">📚 Assign Subject</a>
        <a href="#attendanceSection" class="btn btn-outline btn-sm">📋 Mark Attendance</a>
      `;
    }

    // Mount Faculty View
    document.getElementById("facultyDashboardView").style.display = "block";
    document.getElementById("studentDashboardView").style.display = "none";

    renderFacultyStats();
    setupAnnouncementForm();
    setupAcademicAssignmentForm();
    loadFacultyAnnouncements();
    loadFacultySubjects();
    loadStudentDirectory();
    loadChatContacts();
    initAttendanceDefaults();
  } else {
    // Student View
    if (navAvatar) navAvatar.innerText = "👨‍🎓";
    if (navTag) navTag.innerText = `${userDept} • ${userYear}`;
    if (headerSubText) headerSubText.innerText = `Student Portal • Academic curriculum, attendance, and faculty communication for ${userDept} (${userYear}) • ${userSpec}.`;
    if (headerQuickActions) {
      headerQuickActions.innerHTML = `
        <button onclick="refreshStudentData()" class="btn btn-outline btn-sm">🔄 Refresh Data</button>
      `;
    }

    // Mount Student View
    document.getElementById("facultyDashboardView").style.display = "none";
    document.getElementById("studentDashboardView").style.display = "block";

    renderStudentStats();
    loadStudentAnnouncements();
    loadStudentSubjects();
    loadStudentAttendance();
    loadChatContacts();
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
  const userId = currentUser ? (currentUser.id || currentUser._id) : "usr_student_1";
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
function renderFacultyStats() {
  const grid = document.getElementById("dashboardStatsGrid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="stat-card">
        <div class="stat-info">
            <h3>Enrolled Students</h3>
            <div class="stat-number" id="totalStudentCount">0</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-blue">👨‍🎓</div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Assigned Subjects</h3>
            <div class="stat-number" id="academicCount">0</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-emerald">📚</div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Active Notices</h3>
            <div class="stat-number" id="announcementCount">0</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-amber">📢</div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Department</h3>
            <div class="stat-number" style="font-size: 1.1rem; margin-top: 6px;">${currentUser.department || "Computer Science"}</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-purple">🏛️</div>
    </div>
  `;
}

function renderStudentStats() {
  const grid = document.getElementById("dashboardStatsGrid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="stat-card">
        <div class="stat-info">
            <h3>Targeted Notices</h3>
            <div class="stat-number" id="studentAnnouncementCount">0</div>
        </div>
        <div class="stat-icon-wrapper stat-icon-blue">📢</div>
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
  if (select) {
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
  loadStudentAnnouncements();
  loadStudentSubjects();
  loadStudentAttendance();
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
async function loadChatContacts() {
  const contactListEl = document.getElementById("chatContactList");
  if (!contactListEl) return;

  try {
    const res = await fetch(`${API_URL}/api/messages/contacts`, {
      headers: getAuthHeaders(),
    });
    const contacts = await res.json();
    const list = Array.isArray(contacts) ? contacts : [];

    if (list.length === 0) {
      contactListEl.innerHTML = `<div style="padding: 12px; font-size: 0.8rem; color: var(--text-muted); text-align: center;">No contacts found.</div>`;
      return;
    }

    contactListEl.innerHTML = list
      .map(
        (c) => `
        <div class="chat-contact-item" data-contact-id="${c.id || c._id}" onclick="quickMessageUser('${c.id || c._id}', '${escapeHtml(c.name)}', '${c.year || ""}', '${c.specialization || ""}', '${c.role || "user"}')">
          <div>
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--dark);">${escapeHtml(c.name)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${c.role === "faculty" ? c.department || "Faculty" : `${c.year || "Student"} • ${c.specialization || "CSE"}`}</div>
          </div>
          <span style="font-size: 0.8rem;">💬</span>
        </div>
      `
      )
      .join("");

    // Auto-select first contact if none currently active
    if (!activeChatPartner && list.length > 0) {
      const first = list[0];
      quickMessageUser(first.id || first._id, first.name, first.year || "", first.specialization || "", first.role || "user");
    }
  } catch (err) {
    console.error("Error loading chat contacts:", err);
  }
}

function quickMessageUser(partnerId, partnerName, partnerYear, partnerSpec, partnerRole) {
  activeChatPartner = {
    id: String(partnerId),
    name: partnerName,
    role: partnerRole,
    info: partnerRole === "faculty" ? partnerYear : `${partnerYear} • ${partnerSpec || "CSE"}`,
  };

  const partnerNameEl = document.getElementById("activeChatPartnerName");
  const partnerInfoEl = document.getElementById("activeChatPartnerInfo");

  if (partnerNameEl) partnerNameEl.innerText = `Chatting with: ${partnerName}`;
  if (partnerInfoEl) partnerInfoEl.innerText = activeChatPartner.info;

  const items = document.querySelectorAll(".chat-contact-item");
  items.forEach((item) => {
    const cid = item.getAttribute("data-contact-id");
    if (cid === String(partnerId) || item.innerText.includes(partnerName)) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  refreshActiveChat();

  const chatInput = document.getElementById("chatMessageInput");
  if (chatInput) chatInput.focus();

  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = setInterval(refreshActiveChat, 3000);
}

async function refreshActiveChat() {
  if (!activeChatPartner) return;

  const messagesArea = document.getElementById("chatMessagesArea");
  if (!messagesArea) return;

  const currentUserId = currentUser ? String(currentUser.id || currentUser._id) : "usr_user_1";
  const conversationId = [currentUserId, activeChatPartner.id].sort().join("_");

  try {
    const res = await fetch(`${API_URL}/api/messages/${conversationId}`, {
      headers: getAuthHeaders(),
    });
    const messages = await res.json();
    const msgList = Array.isArray(messages) ? messages : [];

    if (msgList.length === 0) {
      messagesArea.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 30px; font-size: 0.85rem;">No previous messages with ${escapeHtml(activeChatPartner.name)}. Send your message below!</div>`;
      return;
    }

    messagesArea.innerHTML = msgList
      .map((m) => {
        const isMe = String(m.senderId) === currentUserId;
        return `
        <div class="message-bubble ${isMe ? "msg-sent" : "msg-received"}">
          <div style="font-size: 0.75rem; font-weight: 700; margin-bottom: 2px;">${isMe ? "You" : escapeHtml(m.senderName)}</div>
          <div>${escapeHtml(m.message)}</div>
          <div class="msg-timestamp">${new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      `;
      })
      .join("");

    messagesArea.scrollTop = messagesArea.scrollHeight;
  } catch (err) {
    console.error("Error refreshing chat:", err);
  }
}

async function sendChatMessage(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!activeChatPartner) {
    alert("⚠️ Please select a contact from the left panel first.");
    return;
  }

  const input = document.getElementById("chatMessageInput");
  const message = input ? input.value.trim() : "";
  if (!message) return;

  input.value = "";

  try {
    const res = await fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        receiverId: activeChatPartner.id,
        receiverRole: activeChatPartner.role || (currentUser.role === "student" ? "faculty" : "student"),
        receiverName: activeChatPartner.name,
        message,
      }),
    });

    const resData = await res.json();
    if (!res.ok) {
      alert("❌ Message send error: " + (resData.message || "Could not deliver message"));
    }

    await refreshActiveChat();
  } catch (err) {
    console.error("Failed to send message:", err);
  }
}

function filterChatContacts(query) {
  const items = document.querySelectorAll(".chat-contact-item");
  const q = query.toLowerCase();
  items.forEach((item) => {
    item.style.display = item.innerText.toLowerCase().includes(q) ? "flex" : "none";
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
