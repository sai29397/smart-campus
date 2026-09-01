// ==========================================================================
// SMART CAMPUS - STUDENT DASHBOARD CONTROLLER (student.js)
// ==========================================================================

const API_URL =
  window.location.hostname === "localhost" && window.location.port !== "3000"
    ? "http://localhost:3000"
    : window.location.protocol === "file:"
    ? "http://localhost:3000"
    : "";

let currentUser = null;
let activeFacultyChat = null;
let studentChatPollInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  initStudentSession();
  loadStudentAnnouncements();
  loadStudentSubjects();
  loadStudentAttendance();
  loadStudentFacultyContacts();
});

/**
 * Initialize student session & dynamic UI header tags
 */
function initStudentSession() {
  const userJson = localStorage.getItem("smart_campus_user");

  if (userJson) {
    try {
      currentUser = JSON.parse(userJson);
    } catch (e) {}
  }

  if (!currentUser) {
    currentUser = {
      id: "usr_student_1",
      name: "Alex Johnson",
      email: "student@campus.edu",
      role: "student",
      department: "Computer Science",
      year: "1st Year",
      specialization: "General CSE",
    };
  }

  const studentName = currentUser.name || "Alex Johnson";
  const studentDept = currentUser.department || "Computer Science";
  const studentYear = currentUser.year || "1st Year";
  const studentSpec = currentUser.specialization || "General CSE";

  const studentNameEl = document.getElementById("studentName");
  const welcomeNameEl = document.getElementById("welcomeStudentName");
  const studentTagEl = document.getElementById("studentTag");
  const headerDeptEl = document.getElementById("studentHeaderDept");
  const headerYearEl = document.getElementById("studentHeaderYear");
  const headerSpecEl = document.getElementById("studentHeaderSpec");
  const specStatEl = document.getElementById("studentSpecStat");

  if (studentNameEl) studentNameEl.innerText = studentName;
  if (welcomeNameEl) welcomeNameEl.innerText = studentName;
  if (studentTagEl) studentTagEl.innerText = `${studentDept} • ${studentYear}`;
  if (headerDeptEl) headerDeptEl.innerText = studentDept;
  if (headerYearEl) headerYearEl.innerText = studentYear;
  if (headerSpecEl) headerSpecEl.innerText = studentSpec;
  if (specStatEl) specStatEl.innerText = studentSpec;

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
    "x-user-email": currentUser ? currentUser.email : "student@campus.edu",
  };
}

function refreshStudentData() {
  loadStudentAnnouncements();
  loadStudentSubjects();
  loadStudentAttendance();
  loadStudentFacultyContacts();
}

// ==========================================================================
// 1. TARGETED ANNOUNCEMENTS
// ==========================================================================
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

// ==========================================================================
// 2. ENROLLED SUBJECTS (Strict Backend Authorization)
// ==========================================================================
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
          <a href="#chatSection" onclick="quickChatFaculty('${s.facultyId || "usr_faculty_1"}', '${escapeHtml(s.facultyName || "Dr. Sarah Jenkins")}')" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 6px;">💬 Ask Faculty</a>
        </div>
      </div>
    `
    )
    .join("");
}

// ==========================================================================
// 3. ATTENDANCE ANALYTICS
// ==========================================================================
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

    if (trackBadge) trackBadge.innerText = `${summaries.length} Subjects`;

    if (summaries.length === 0) {
      gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 24px;">No attendance records published yet.</div>`;
      if (overallStat) overallStat.innerText = "100%";
      return;
    }

    let totalClassesAll = 0;
    let totalPresentAll = 0;

    gridContainer.innerHTML = summaries
      .map((item) => {
        totalClassesAll += item.totalClasses;
        totalPresentAll += item.classesPresent;
        const pct = item.percentage;
        const color = pct >= 85 ? "#16a34a" : pct >= 75 ? "#d97706" : "#dc2626";

        return `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <h4 style="margin: 0; font-size: 1rem; color: var(--dark);">${escapeHtml(item.subjectName)}</h4>
            <span style="font-size: 1.1rem; font-weight: 800; color: ${color};">${pct}%</span>
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
      const overallPct = totalClassesAll > 0 ? ((totalPresentAll / totalClassesAll) * 100).toFixed(1) : "100.0";
      overallStat.innerText = `${overallPct}%`;
    }
  } catch (err) {
    if (overallStat) overallStat.innerText = "--%";
  }
}

// ==========================================================================
// 4. STUDENT-FACULTY CHAT
// ==========================================================================
async function loadStudentFacultyContacts() {
  const contactListEl = document.getElementById("studentFacultyChatList");
  if (!contactListEl) return;

  try {
    const res = await fetch(`${API_URL}/api/messages/contacts`, {
      headers: getAuthHeaders(),
    });
    const contacts = await res.json();
    const list = Array.isArray(contacts) ? contacts : [];

    if (list.length === 0) {
      contactListEl.innerHTML = `<div style="padding: 12px; font-size: 0.8rem; color: var(--text-muted); text-align: center;">No faculty contacts available.</div>`;
      return;
    }

    contactListEl.innerHTML = list
      .map(
        (f) => `
        <div class="chat-contact-item" onclick="openStudentChatWithFaculty('${f.id || f._id}', '${escapeHtml(f.name)}', '${f.department}')">
          <div>
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--dark);">${escapeHtml(f.name)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${f.department || "Faculty"}</div>
          </div>
          <span style="font-size: 0.8rem;">💬</span>
        </div>
      `
      )
      .join("");
  } catch (err) {}
}

function quickChatFaculty(facultyId, facultyName) {
  openStudentChatWithFaculty(facultyId, facultyName, "Faculty Member");
}

function openStudentChatWithFaculty(facultyId, facultyName, facultyDept) {
  activeFacultyChat = {
    id: facultyId,
    name: facultyName,
    department: facultyDept,
  };

  const nameEl = document.getElementById("activeFacultyName");
  const infoEl = document.getElementById("activeFacultyInfo");

  if (nameEl) nameEl.innerText = `Chatting with: ${facultyName}`;
  if (infoEl) infoEl.innerText = `${facultyDept}`;

  const items = document.querySelectorAll(".chat-contact-item");
  items.forEach((item) => {
    if (item.innerText.includes(facultyName)) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  refreshStudentChat();

  if (studentChatPollInterval) clearInterval(studentChatPollInterval);
  studentChatPollInterval = setInterval(refreshStudentChat, 4000);
}

async function refreshStudentChat() {
  if (!activeFacultyChat) return;

  const messagesArea = document.getElementById("studentChatMessagesArea");
  const studentId = currentUser ? (currentUser.id || currentUser._id) : "usr_student_1";
  const conversationId = [studentId, activeFacultyChat.id].sort().join("_");

  try {
    const res = await fetch(`${API_URL}/api/messages/${conversationId}`, {
      headers: getAuthHeaders(),
    });
    const messages = await res.json();
    const msgList = Array.isArray(messages) ? messages : [];

    if (msgList.length === 0) {
      messagesArea.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 30px; font-size: 0.85rem;">No previous messages with ${activeFacultyChat.name}. Send your question below!</div>`;
      return;
    }

    messagesArea.innerHTML = msgList
      .map((m) => {
        const isMe = String(m.senderId) === String(studentId);
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

async function sendStudentChatMessage(e) {
  e.preventDefault();
  if (!activeFacultyChat) {
    alert("⚠️ Please select a faculty member from the left contact list first.");
    return;
  }

  const input = document.getElementById("studentChatMessageInput");
  const message = input ? input.value.trim() : "";
  if (!message) return;

  input.value = "";

  try {
    await fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        receiverId: activeFacultyChat.id,
        receiverRole: "faculty",
        receiverName: activeFacultyChat.name,
        message,
      }),
    });

    refreshStudentChat();
  } catch (err) {
    console.error("Failed to send message:", err);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
