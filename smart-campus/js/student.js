// ==========================================================================
// SMART CAMPUS - STUDENT DASHBOARD CONTROLLER (student.js)
// ==========================================================================

// Base API URL: connects to http://localhost:3000 in local dev, or relative path on deployed Vercel
const API_URL =
  window.location.hostname === "localhost" && window.location.port !== "3000"
    ? "http://localhost:3000"
    : window.location.protocol === "file:"
    ? "http://localhost:3000"
    : "";

const masterAnnouncements = [
  {
    title: "1st Year Orientation & Bridge Course Schedule",
    description: "Welcome to campus! Orientation sessions and campus map tours are scheduled in Hall A.",
    department: "Computer Science",
    year: "1st Year",
    priority: "Important",
    date: "Today",
  },
  {
    title: "Freshman Lab Induction & Safety Workshop",
    description: "All newly admitted students must attend the introductory laboratory induction session.",
    department: "All Departments",
    year: "1st Year",
    priority: "Normal",
    date: "Today",
  },
  {
    title: "Mid-Term Examination Schedule Released",
    description: "The schedule for Mid-Term Exams has been uploaded. Check your assigned exam rooms.",
    department: "Computer Science",
    year: "3rd Year",
    priority: "Urgent",
    date: "Yesterday",
  },
  {
    title: "Hackathon 2026 Registration Open",
    description: "Registration for the annual university hackathon is now open. Teams of up to 4 can register.",
    department: "All Departments",
    year: "All Years",
    priority: "Important",
    date: "Yesterday",
  },
  {
    title: "Library Extended Hours for Examinations",
    description: "The main campus library will remain open 24/7 during exam revision weeks.",
    department: "All Departments",
    year: "All Years",
    priority: "Normal",
    date: "2 days ago",
  },
];

// ==========================================================================
// 1. ROLE-BASED ACCESS & SESSION BOOTSTRAP
// ==========================================================================
function ensureStudentSession() {
  let userStr = localStorage.getItem("smart_campus_user");

  if (!userStr) {
    const defaultStudent = {
      id: "usr_student_1",
      name: "Alex Johnson",
      email: "student@campus.edu",
      role: "student",
      department: "Computer Science",
      year: "1st Year",
    };
    localStorage.setItem("smart_campus_user", JSON.stringify(defaultStudent));
    userStr = JSON.stringify(defaultStudent);
  }

  try {
    const user = JSON.parse(userStr);

    if (user.role === "faculty") {
      alert("Notice: You are currently signed in as a Faculty member. Redirecting to Faculty Dashboard.");
      window.location.href = "faculty-dashboard.html";
      return false;
    }

    return true;
  } catch (err) {
    return true;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const isAllowed = ensureStudentSession();
  if (!isAllowed) return;

  initializeStudentProfile();
  renderStudentAnnouncements();
  loadStudentAcademics();
});

function initializeStudentProfile() {
  const userStr = localStorage.getItem("smart_campus_user");
  if (!userStr) return;

  try {
    const user = JSON.parse(userStr);
    const nameElem = document.getElementById("studentName");
    const welcomeName = document.getElementById("welcomeStudentName");
    const studentTag = document.getElementById("studentTag");
    const headerDept = document.getElementById("studentHeaderDept");
    const headerYear = document.getElementById("studentHeaderYear");
    const studentSemesterStat = document.getElementById("studentSemesterStat");

    const dept = user.department || "Computer Science";
    const year = user.year || "1st Year";
    const fullName = user.name || "Student";

    if (nameElem) nameElem.innerText = fullName;
    if (welcomeName) welcomeName.innerText = fullName.split(" ")[0];
    if (studentTag) studentTag.innerText = `${dept} • ${year}`;
    if (headerDept) headerDept.innerText = dept;
    if (headerYear) headerYear.innerText = year;

    if (studentSemesterStat) {
      if (year === "1st Year") studentSemesterStat.innerText = "Semester 1";
      else if (year === "2nd Year") studentSemesterStat.innerText = "Semester 3";
      else if (year === "3rd Year") studentSemesterStat.innerText = "Semester 5";
      else if (year === "4th Year") studentSemesterStat.innerText = "Semester 7";
      else studentSemesterStat.innerText = "Active";
    }
  } catch (e) {
    console.warn("Could not parse student profile", e);
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

function refreshStudentData() {
  initializeStudentProfile();
  renderStudentAnnouncements();
  loadStudentAcademics();
}

async function renderStudentAnnouncements() {
  const container = document.getElementById("studentAnnouncementList");
  const countBadge = document.getElementById("studentAnnouncementCount");
  const annCountBadge = document.getElementById("annCountBadge");

  const userStr = localStorage.getItem("smart_campus_user");
  let studentDept = "Computer Science";
  let studentYear = "1st Year";

  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u.department) studentDept = u.department;
      if (u.year) studentYear = u.year;
    } catch (e) {}
  }

  let announcements = masterAnnouncements;

  // Fetch live from Backend API
  try {
    const res = await fetch(`${API_URL}/api/announcements?year=${encodeURIComponent(studentYear)}&department=${encodeURIComponent(studentDept)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        announcements = data;
      }
    }
  } catch (err) {
    console.warn("Using local master announcements fallback");
  }

  // Strict targeted filtering: ONLY this student's year + "All Years"
  const targetedAnnouncements = announcements.filter((item) => {
    const itemYear = (item.year || "All Years").trim().toLowerCase();
    const targetYear = studentYear.trim().toLowerCase();
    const itemDept = (item.department || "All Departments").trim().toLowerCase();
    const targetDept = studentDept.trim().toLowerCase();

    const yearMatches = itemYear === "all years" || itemYear === targetYear;
    const deptMatches = itemDept === "all departments" || itemDept === "campus wide" || itemDept === targetDept;

    return yearMatches && deptMatches;
  });

  if (countBadge) countBadge.innerText = targetedAnnouncements.length;
  if (annCountBadge) annCountBadge.innerText = `${targetedAnnouncements.length} Updates (${studentYear})`;

  if (!container) return;

  if (targetedAnnouncements.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📢</div>
        <h4>No Announcements for ${escapeHTML(studentYear)}</h4>
        <p>There are no active notices published for ${escapeHTML(studentDept)} (${escapeHTML(studentYear)}) currently.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = targetedAnnouncements
    .map((item) => {
      let chipClass = "chip-low";
      if (item.priority === "Urgent") chipClass = "chip-high";
      else if (item.priority === "Important") chipClass = "chip-medium";

      const createdDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : (item.date || "Today");

      return `
        <div class="item-card">
          <div class="item-header">
            <h4 class="item-title">${escapeHTML(item.title)}</h4>
            <span class="meta-chip ${chipClass}">${escapeHTML(item.priority)}</span>
          </div>
          <p class="item-desc">${escapeHTML(item.description)}</p>
          <div class="item-meta">
            <span class="meta-chip chip-primary">🏛️ ${escapeHTML(item.department)}</span>
            <span class="meta-chip">📅 ${escapeHTML(item.year)}</span>
          </div>
          <div class="item-footer">
            <span>🕒 ${escapeHTML(createdDate)}</span>
            <span>📢 ${escapeHTML(item.authorName || "SmartCampus Feed")}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

async function loadStudentAcademics() {
  const container = document.getElementById("studentAcademicList");
  const countBadge = document.getElementById("studentSubjectCount");

  if (!container) return;

  container.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
      <p>⏳ Loading curriculum subjects from Server...</p>
    </div>
  `;

  // Get current student profile
  const userStr = localStorage.getItem("smart_campus_user");
  let userDept = "Computer Science";
  let userYear = "1st Year";
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u.department) userDept = u.department;
      if (u.year) userYear = u.year;
    } catch (e) {}
  }

  try {
    const response = await fetch(`${API_URL}/api/academic?year=${encodeURIComponent(userYear)}&department=${encodeURIComponent(userDept)}`);
    if (!response.ok) throw new Error("Could not fetch academic subjects");
    
    const records = await response.json();
    const list = Array.isArray(records) ? records : (records.data || []);

    // Strict year-wise isolation: only include subjects matching this student's year
    const targetNormYear = (userYear || "1st Year").trim().toLowerCase();
    const matchingSubjects = list.filter((item) => {
      const itemYear = (item.academicYear || item.year || "").trim().toLowerCase();
      if (!itemYear) return false;
      return itemYear === targetNormYear || 
             (targetNormYear.includes("1") && itemYear.includes("1")) ||
             (targetNormYear.includes("2") && itemYear.includes("2")) ||
             (targetNormYear.includes("3") && itemYear.includes("3")) ||
             (targetNormYear.includes("4") && itemYear.includes("4"));
    });

    if (countBadge) countBadge.innerText = matchingSubjects.length;

    if (matchingSubjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">📚</div>
          <h4>No Subjects Allocated for ${escapeHTML(userYear)}</h4>
          <p>Curriculum subjects for ${escapeHTML(userDept)} (${escapeHTML(userYear)}) will be assigned by faculty soon.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = matchingSubjects
      .map((item) => {
        const name = item.subjectName || "Subject";
        const code = item.subjectCode || "N/A";
        const sem = item.semester || "Semester 1";
        const dept = item.academicDepartment || item.department || "Computer Science";
        const yr = item.academicYear || item.year || "1st Year";
        const faculty = item.facultyName || "Faculty Member";

        return `
          <div class="item-card">
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
              <span>👨‍🏫 Instructor: ${escapeHTML(faculty)}</span>
              <span style="color: var(--success); font-weight: 700;">Enrolled</span>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    console.warn("Could not connect to live API in student dashboard:", error);
    container.innerHTML = `
      <div style="grid-column: 1 / -1; background: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 1.5rem; text-align: center;">
        <h4 style="color: #c53030;">⚠️ Backend Offline</h4>
        <p style="color: #742a2a; font-size: 0.9rem;">Start the backend server using <code>node server.js</code></p>
      </div>
    `;
  }
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
