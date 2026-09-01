const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const Message = require("../models/Message");
const { protect } = require("../middleware/authMiddleware");

const dataDir = path.join(__dirname, "../data");
const messagesFilePath = path.join(dataDir, "messages.json");
const usersFilePath = path.join(dataDir, "users.json");

// Helper to load server messages
function loadServerMessages() {
  try {
    if (fs.existsSync(messagesFilePath)) {
      const data = fs.readFileSync(messagesFilePath, "utf8");
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}

  return [];
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

let inMemoryMessages = loadServerMessages();

// ==========================================================================
// 1. GET AUTHORIZED CHAT CONTACTS
// ==========================================================================
router.get("/contacts", protect, (req, res) => {
  try {
    const role = req.user.role;
    const allUsers = loadServerUsers();

    let contacts = [];

    if (role === "student") {
      // Students can message faculty members
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
      // Faculty: return students
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
// 2. GET CONVERSATION THREADS (Strictly for authenticated user only)
// ==========================================================================
router.get("/conversations", protect, (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    inMemoryMessages = loadServerMessages();

    // STRICT: Only messages where user is either the sender OR the receiver
    const userMessages = inMemoryMessages.filter(
      (m) => String(m.senderId) === userId || String(m.receiverId) === userId
    );

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
// 3. GET MESSAGES FOR A STRICT 1-ON-1 CONVERSATION
// ==========================================================================
router.get("/:conversationId", protect, (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = String(req.user._id || req.user.id);
    inMemoryMessages = loadServerMessages();

    // Query messages strictly between this authenticated user and the specific recipient
    const messages = inMemoryMessages.filter((m) => {
      // User must be one of the two participants
      const isParticipant = String(m.senderId) === currentUserId || String(m.receiverId) === currentUserId;
      if (!isParticipant) return false;

      // Exact conversation ID match
      if (m.conversationId === conversationId) return true;

      // Or exact sender/receiver pair match
      const partnerId = String(m.senderId) === currentUserId ? String(m.receiverId) : String(m.senderId);
      const expectedConvId = [currentUserId, partnerId].sort().join("_");
      return expectedConvId === conversationId;
    });

    // Mark messages sent to this user as read
    let updated = false;
    messages.forEach((m) => {
      if (String(m.receiverId) === currentUserId && !m.readStatus) {
        m.readStatus = true;
        updated = true;
      }
    });
    if (updated) saveServerMessages(inMemoryMessages);

    return res.json(messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch messages." });
  }
});

// ==========================================================================
// 4. SEND PRIVATE 1-ON-1 MESSAGE (POST /api/messages)
// ==========================================================================
router.post("/", protect, async (req, res) => {
  try {
    const { receiverId, receiverRole, receiverName, message } = req.body;

    if (!receiverId || !message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID and message content are required.",
      });
    }

    const senderId = String(req.user._id || req.user.id);
    const senderRole = req.user.role;
    const senderName = req.user.name || "User";
    const cleanReceiverId = String(receiverId);

    // Strict 1-on-1 conversation ID
    const conversationId = [senderId, cleanReceiverId].sort().join("_");

    const newMessage = {
      _id: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      id: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      conversationId,
      senderId,
      senderRole,
      senderName,
      receiverId: cleanReceiverId,
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
      message: "Message delivered privately to recipient!",
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
