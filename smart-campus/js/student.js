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

const studentAnnouncements = [
  {
    title: "Mid-Term Examination Schedule Released",
    description: "The schedule for Mid-Term Exams has been uploaded. Check your assigned exam rooms.",
    department: "Computer Science",
    year: "3rd Year",
    priority: "Urgent",
    date: "Today",
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
    title: "Library Extended Hours for Final Exams",
    description: "The main campus library will remain open 24/7 starting next Monday.",
    department: "Campus Wide",
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
      year: "3rd Year",
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

    if (nameElem && user.name) nameElem.innerText = user.name;
    if (welcomeName && user.name) welcomeName.innerText = user.name.split(" ")[0];
  } catch (e) {
    console.warn("Could not parse student profile");
  }
}

function refreshStudentData() {
  renderStudentAnnouncements();
  loadStudentAcademics();
}

function renderStudentAnnouncements() {
  const container = document.getElementById("studentAnnouncementList");
  const countBadge = document.getElementById("studentAnnouncementCount");
  const annCountBadge = document.getElementById("annCountBadge");

  if (countBadge) countBadge.innerText = studentAnnouncements.length;
  if (annCountBadge) annCountBadge.innerText = `${studentAnnouncements.length} Updates`;

  if (!container) return;

  container.innerHTML = studentAnnouncements
    .map((item) => {
      let chipClass = "chip-low";
      if (item.priority === "Urgent") chipClass = "chip-high";
      else if (item.priority === "Important") chipClass = "chip-medium";

      return `
        <div class="item-card">
          <div class="item-header">
            <h4 class="item-title">${item.title}</h4>
            <span class="meta-chip ${chipClass}">${item.priority}</span>
          </div>
          <p class="item-desc">${item.description}</p>
          <div class="item-meta">
            <span class="meta-chip chip-primary">🏛️ ${item.department}</span>
            <span class="meta-chip">📅 ${item.year}</span>
          </div>
          <div class="item-footer">
            <span>🕒 ${item.date}</span>
            <span>SmartCampus Feed</span>
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
      <p>⏳ Loading subjects from Backend API...</p>
    </div>
  `;

  try {
    const response = await fetch(`${API_URL}/api/academic`);
    if (!response.ok) throw new Error("Could not fetch academic subjects");
    
    const records = await response.json();
    const list = Array.isArray(records) ? records : (records.data || []);

    if (countBadge) countBadge.innerText = list.length;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">📚</div>
          <h4>No Subjects Found</h4>
          <p>Faculty has not added curriculum subjects yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list
      .map((item) => {
        const name = item.subjectName || "Subject";
        const code = item.subjectCode || "N/A";
        const sem = item.semester || "Semester 5";
        const dept = item.academicDepartment || item.department || "Computer Science";
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
            </div>
            <div class="item-footer">
              <span>👨‍🏫 Instructor: ${faculty}</span>
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
