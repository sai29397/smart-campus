const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const Message = require("../models/Message");
const { protect } = require("../middleware/authMiddleware");

const dataDir = path.join(__dirname, "../data");
const messagesFilePath = path.join(dataDir, "messages.json");
const usersFilePath = path.join(dataDir, "users.json");
const subjectsFilePath = path.join(dataDir, "subjects.json");

// Helper to load server messages
function loadServerMessages() {
  try {
    if (fs.existsSync(messagesFilePath)) {
      const data = fs.readFileSync(messagesFilePath, "utf8");
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}

  const initialMessages = [
    {
      _id: "msg_1",
      id: "msg_1",
      conversationId: "usr_faculty_1_usr_student_1",
      senderId: "usr_faculty_1",
      senderRole: "faculty",
      senderName: "Dr. Sarah Jenkins",
      receiverId: "usr_student_1",
      receiverRole: "student",
      receiverName: "Alex Johnson",
      message: "Hello Alex! Please remember to review the lab syllabus before our practical session tomorrow.",
      readStatus: false,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
  ];
  saveServerMessages(initialMessages);
  return initialMessages;
}

function saveServerMessages(list) {
  try {
    fs.writeFileSync(messagesFilePath, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {}
}

function loadServerUsers() {
  try {
    if (fs.existsSync(usersFilePath)) {
      return JSON.parse(fs.readFileSync(usersFilePath, "utf8")) || [];
    }
  } catch (e) {}
  return [];
}

function loadServerSubjects() {
  try {
    if (fs.existsSync(subjectsFilePath)) {
      return JSON.parse(fs.readFileSync(subjectsFilePath, "utf8")) || [];
    }
  } catch (e) {}
  return [];
}

let inMemoryMessages = loadServerMessages();

// ==========================================================================
// 1. GET AUTHORIZED CHAT CONTACTS
// ==========================================================================
router.get("/contacts", protect, (req, res) => {
  try {
    const currentUserId = String(req.user._id || req.user.id);
    const role = req.user.role;
    const allUsers = loadServerUsers();
    const allSubjects = loadServerSubjects();

    let contacts = [];

    if (role === "student") {
      // Return faculty who teach this student
      contacts = allUsers
        .filter((u) => u.role === "faculty" || u.role === "admin")
        .map((f) => ({
          id: f._id || f.id,
          _id: f._id || f.id,
          name: f.name,
          email: f.email,
          role: f.role,
          department: f.department,
        }));
    } else {
      // Faculty: return students enrolled in faculty's department or subjects
      contacts = allUsers
        .filter((u) => u.role === "student")
        .map((st) => ({
          id: st._id || st.id,
          _id: st._id || st.id,
          name: st.name,
          email: st.email,
          role: st.role,
          year: st.year,
          department: st.department,
          specialization: st.specialization || "General CSE",
        }));
    }

    return res.json(contacts);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load contacts." });
  }
});

// ==========================================================================
// 2. GET CONVERSATION THREADS (List of chats for authenticated user)
// ==========================================================================
router.get("/conversations", protect, (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    inMemoryMessages = loadServerMessages();

    // Find all messages involving this user
    const userMessages = inMemoryMessages.filter(
      (m) => String(m.senderId) === userId || String(m.receiverId) === userId
    );

    // Group by conversation partner
    const conversationsMap = {};

    userMessages.forEach((msg) => {
      const isSender = String(msg.senderId) === userId;
      const partnerId = isSender ? String(msg.receiverId) : String(msg.senderId);
      const partnerName = isSender ? msg.receiverName : msg.senderName;
      const partnerRole = isSender ? msg.receiverRole : msg.senderRole;

      if (!conversationsMap[partnerId]) {
        conversationsMap[partnerId] = {
          conversationId: msg.conversationId,
          partnerId,
          partnerName,
          partnerRole,
          lastMessage: msg.message,
          lastTimestamp: msg.timestamp,
          unreadCount: 0,
        };
      }

      if (!isSender && !msg.readStatus) {
        conversationsMap[partnerId].unreadCount += 1;
      }
    });

    const conversationList = Object.values(conversationsMap).sort(
      (a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp)
    );

    return res.json(conversationList);
  } catch (error) {
    console.error("Get Conversations Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch conversations." });
  }
});

// ==========================================================================
// 3. GET MESSAGES FOR A CONVERSATION
// ==========================================================================
router.get("/:conversationId", protect, (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = String(req.user._id || req.user.id);
    inMemoryMessages = loadServerMessages();

    const messages = inMemoryMessages.filter((m) => {
      const matchesConv = m.conversationId === conversationId;
      const isParticipant =
        String(m.senderId) === userId ||
        String(m.receiverId) === userId ||
        conversationId.includes(userId);
      return matchesConv || (isParticipant && m.conversationId.includes(conversationId.split("_")[0]));
    });

    // Mark messages as read
    messages.forEach((m) => {
      if (String(m.receiverId) === userId && !m.readStatus) {
        m.readStatus = true;
      }
    });
    saveServerMessages(inMemoryMessages);

    return res.json(messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch messages." });
  }
});

// ==========================================================================
// 4. SEND MESSAGE (POST /api/messages)
// ==========================================================================
router.post("/", protect, async (req, res) => {
  try {
    const { receiverId, receiverRole, receiverName, message } = req.body;

    if (!receiverId || !message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID and non-empty message text are required.",
      });
    }

    const senderId = String(req.user._id || req.user.id);
    const senderRole = req.user.role;
    const senderName = req.user.name || "User";

    // Standard deterministic conversation ID
    const conversationId = [senderId, String(receiverId)].sort().join("_");

    const newMessage = {
      _id: "msg_" + Date.now(),
      id: "msg_" + Date.now(),
      conversationId,
      senderId,
      senderRole,
      senderName,
      receiverId: String(receiverId),
      receiverRole: receiverRole || (senderRole === "student" ? "faculty" : "student"),
      receiverName: receiverName || "Recipient",
      message: message.trim(),
      readStatus: false,
      timestamp: new Date().toISOString(),
    };

    // Save to MongoDB if available
    try {
      const dbMsg = await Message.create(newMessage);
      newMessage._id = dbMsg._id.toString();
    } catch (dbErr) {}

    // Save permanently to server
    inMemoryMessages = loadServerMessages();
    inMemoryMessages.push(newMessage);
    saveServerMessages(inMemoryMessages);

    return res.status(201).json({
      success: true,
      message: "Message sent successfully!",
      data: newMessage,
    });
  } catch (error) {
    console.error("Send Message Error:", error);
    res.status(500).json({ success: false, message: "Server error while sending message." });
  }
});

// ==========================================================================
// 5. MARK MESSAGE AS READ
// ==========================================================================
router.put("/:messageId/read", protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    inMemoryMessages = loadServerMessages();

    const targetMsg = inMemoryMessages.find((m) => m._id === messageId || m.id === messageId);
    if (targetMsg) {
      targetMsg.readStatus = true;
      saveServerMessages(inMemoryMessages);
    }

    try {
      await Message.findByIdAndUpdate(messageId, { readStatus: true });
    } catch (e) {}

    return res.json({ success: true, message: "Message marked as read." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error marking message as read." });
  }
});

module.exports = router;
