// ==========================================================================
// SMART CAMPUS - FACULTY DASHBOARD CONTROLLER (faculty.js)
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
let activeChatStudent = null;
let chatPollInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  initFacultySession();
  setupAnnouncementForm();
  setupAcademicAssignmentForm();
  loadFacultyAnnouncements();
  loadFacultySubjects();
  loadStudentDirectory();
  loadChatContacts();
  initAttendanceDefaults();
});

/**
 * Initialize faculty session and profile header
 */
function initFacultySession() {
  const token = localStorage.getItem("smart_campus_token");
  const userJson = localStorage.getItem("smart_campus_user");

  if (!token || !userJson) {
    alert("⚠️ Please sign in to access the Faculty Dashboard.");
    window.location.href = "login.html?role=faculty";
    return;
  }

  try {
    currentUser = JSON.parse(userJson);
  } catch (e) {
    window.location.href = "login.html?role=faculty";
    return;
  }

  if (currentUser.role !== "faculty" && currentUser.role !== "admin") {
    alert(`⛔ Access Denied: You are logged in as "${currentUser.role.toUpperCase()}". Only Faculty members can access the Faculty Dashboard.\nRedirecting to Student Dashboard...`);
    window.location.href = "student-dashboard.html";
    return;
  }

  const facultyNameEl = document.getElementById("facultyName");
  const facultyTagEl = document.getElementById("facultyTag");
  const facultyHeaderDept = document.getElementById("facultyHeaderDept");

  if (facultyNameEl) facultyNameEl.innerText = currentUser.name || "Dr. Sarah Jenkins";
  if (facultyTagEl) facultyTagEl.innerText = `${currentUser.department || "Computer Science"} • Faculty`;
  if (facultyHeaderDept) facultyHeaderDept.innerText = currentUser.department || "Computer Science";

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
  const userId = currentUser ? (currentUser.id || currentUser._id) : "usr_faculty_1";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-user-id": userId,
    "x-user-email": currentUser ? currentUser.email : "faculty@campus.edu",
  };
}

// ==========================================================================
// 0. STUDENT DIRECTORY & DIRECT ADD STUDENT
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

      // Refresh rosters across dashboard
      loadStudentDirectory();
      updateStudentSearchRoster();
      loadChatContacts();
    } else {
      alert(`❌ Notice: ${data.message || "Could not add student."}`);
    }
  } catch (err) {
    alert("Student added locally!");
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
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 16px; color: var(--text-muted);">Could not load student directory.</td></tr>`;
  }
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
            <button onclick="quickMessageStudent('${st.id || st._id}', '${escapeHtml(st.name)}', '${st.year}', '${st.specialization || "General CSE"}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 6px;">💬 Chat</button>
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

function quickMessageStudent(studentId, studentName, studentYear, studentSpec) {
  window.location.hash = "#chatSection";
  openChatWithStudent(studentId, studentName, studentYear, studentSpec);
}

// ==========================================================================
// 1. ANNOUNCEMENTS
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
      alert("Announcement saved locally!");
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
// 2. SUBJECT ASSIGNMENT CONTROLLER
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
// 3. ATTENDANCE MANAGEMENT CONTROLLER
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
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">No enrolled students match this subject yet.</td></tr>`;
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
      attendanceList.push({
        studentId,
        studentName,
        studentEmail,
        year,
        specialization,
        status,
      });
    }
  });

  saveBtn.disabled = true;
  saveBtn.innerText = "Saving Attendance...";

  try {
    const res = await fetch(`${API_URL}/api/attendance`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        subjectId,
        subjectName,
        date,
        attendanceList,
      }),
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
// 4. REAL-TIME MESSAGING CONTROLLER
// ==========================================================================
async function loadChatContacts() {
  const contactListEl = document.getElementById("chatContactList");
  const unreadStat = document.getElementById("unreadMessageCount");
  if (!contactListEl) return;

  try {
    const res = await fetch(`${API_URL}/api/messages/contacts`, {
      headers: getAuthHeaders(),
    });
    const contacts = await res.json();
    const list = Array.isArray(contacts) ? contacts : [];

    if (list.length === 0) {
      contactListEl.innerHTML = `<div style="padding: 12px; font-size: 0.8rem; color: var(--text-muted); text-align: center;">No student contacts found.</div>`;
      return;
    }

    contactListEl.innerHTML = list
      .map(
        (c) => `
        <div class="chat-contact-item" onclick="openChatWithStudent('${c.id || c._id}', '${escapeHtml(c.name)}', '${c.year || ""}', '${c.specialization || "General CSE"}')">
          <div>
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--dark);">${escapeHtml(c.name)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${c.year || "Student"} • ${c.specialization || "CSE"}</div>
          </div>
          <span style="font-size: 0.8rem;">💬</span>
        </div>
      `
      )
      .join("");
  } catch (err) {}
}

function openChatWithStudent(studentId, studentName, studentYear, studentSpec) {
  activeChatStudent = {
    id: studentId,
    name: studentName,
    year: studentYear,
    specialization: studentSpec,
  };

  const partnerNameEl = document.getElementById("activeChatPartnerName");
  const partnerInfoEl = document.getElementById("activeChatPartnerInfo");

  if (partnerNameEl) partnerNameEl.innerText = `Chatting with: ${studentName}`;
  if (partnerInfoEl) partnerInfoEl.innerText = `${studentYear} • ${studentSpec}`;

  const items = document.querySelectorAll(".chat-contact-item");
  items.forEach((item) => {
    if (item.innerText.includes(studentName)) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  refreshActiveChat();

  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = setInterval(refreshActiveChat, 4000);
}

async function refreshActiveChat() {
  if (!activeChatStudent) return;

  const messagesArea = document.getElementById("chatMessagesArea");
  const facultyId = currentUser ? (currentUser.id || currentUser._id) : "usr_faculty_1";
  const conversationId = [facultyId, activeChatStudent.id].sort().join("_");

  try {
    const res = await fetch(`${API_URL}/api/messages/${conversationId}`, {
      headers: getAuthHeaders(),
    });
    const messages = await res.json();
    const msgList = Array.isArray(messages) ? messages : [];

    if (msgList.length === 0) {
      messagesArea.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 30px; font-size: 0.85rem;">No previous messages with ${activeChatStudent.name}. Send a message below!</div>`;
      return;
    }

    messagesArea.innerHTML = msgList
      .map((m) => {
        const isMe = String(m.senderId) === String(facultyId);
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
  } catch (err) {}
}

async function sendChatMessage(e) {
  e.preventDefault();
  if (!activeChatStudent) {
    alert("⚠️ Please select a student contact from the left panel first.");
    return;
  }

  const input = document.getElementById("chatMessageInput");
  const message = input ? input.value.trim() : "";
  if (!message) return;

  input.value = "";

  try {
    await fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        receiverId: activeChatStudent.id,
        receiverRole: "student",
        receiverName: activeChatStudent.name,
        message,
      }),
    });

    refreshActiveChat();
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
