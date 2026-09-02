const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const dataDir = path.join(__dirname, "../data");
const messagesFilePath = path.join(dataDir, "messages.json");
const conversationsFilePath = path.join(dataDir, "conversations.json");
const usersFilePath = path.join(dataDir, "users.json");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ---------------- Helper Functions ----------------
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

function loadServerConversations() {
  try {
    if (fs.existsSync(conversationsFilePath)) {
      const data = fs.readFileSync(conversationsFilePath, "utf8");
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}
  return [];
}

function saveServerConversations(list) {
  try {
    fs.writeFileSync(conversationsFilePath, JSON.stringify(list, null, 2), "utf8");
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

// Generate consistent deterministic conversation ID for any 2 users
function getDeterministicConversationId(userAId, userBId) {
  const idA = String(userAId || "").trim();
  const idB = String(userBId || "").trim();
  return [idA, idB].sort().join("_");
}

// Helper to find user info by id or email
function findUserDetails(userIdOrEmail) {
  const allUsers = loadServerUsers();
  const search = String(userIdOrEmail || "").toLowerCase().trim();
  return allUsers.find(
    (u) =>
      String(u._id || u.id || "").toLowerCase().trim() === search ||
      (u.email && u.email.toLowerCase().trim() === search)
  );
}

// ==========================================================================
// 1. GET AUTHORIZED CHAT CONTACTS (Searchable Directory)
// ==========================================================================
router.get("/contacts", protect, (req, res) => {
  try {
    const currentUserId = String(req.user._id || req.user.id);
    const currentUserRole = (req.user.role || "").toLowerCase();
    const allUsers = loadServerUsers();
    const allConversations = loadServerConversations();

    let eligibleUsers = [];

    if (currentUserRole === "student") {
      // Students can message faculty and administration
      eligibleUsers = allUsers.filter(
        (u) =>
          String(u._id || u.id) !== currentUserId &&
          (u.role === "faculty" || u.role === "admin" || u.role === "administration")
      );
    } else if (currentUserRole === "faculty") {
      // Faculty can message students, fellow faculty, and administration
      eligibleUsers = allUsers.filter(
        (u) => String(u._id || u.id) !== currentUserId
      );
    } else {
      // Administration can message everyone
      eligibleUsers = allUsers.filter(
        (u) => String(u._id || u.id) !== currentUserId
      );
    }

    const contacts = eligibleUsers.map((u) => {
      const contactId = String(u._id || u.id);
      const convId = getDeterministicConversationId(currentUserId, contactId);
      const existingConv = allConversations.find(
        (c) => c.conversationId === convId || (Array.isArray(c.participants) && c.participants.includes(contactId) && c.participants.includes(currentUserId))
      );

      return {
        id: contactId,
        _id: contactId,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department || (u.role === "faculty" ? "Faculty" : "Computer Science"),
        year: u.year || (u.role === "faculty" ? "Faculty" : "Student"),
        specialization: u.specialization || (u.role === "faculty" ? "Faculty" : "General CSE"),
        conversationId: convId,
        hasExistingConversation: !!existingConv,
        lastMessage: existingConv ? existingConv.lastMessage : "",
        lastMessageTime: existingConv ? existingConv.lastMessageTime : null,
      };
    });

    return res.json(contacts);
  } catch (error) {
    console.error("Get Contacts Error:", error);
    res.status(500).json({ success: false, message: "Failed to load contacts." });
  }
});

// ==========================================================================
// 2. GET CONVERSATION LIST (GET /api/messages/conversations)
// ==========================================================================
router.get("/conversations", protect, (req, res) => {
  try {
    const currentUserId = String(req.user._id || req.user.id);
    const inMemoryMessages = loadServerMessages();
    let inMemoryConversations = loadServerConversations();
    const allUsers = loadServerUsers();

    // Map of conversationId -> conversation
    const convMap = {};

    // 1. First index stored conversations
    inMemoryConversations.forEach((c) => {
      if (Array.isArray(c.participants) && c.participants.includes(currentUserId)) {
        convMap[c.conversationId] = c;
      }
    });

    // 2. Cross-reference all messages to ensure no conversation is missed
    inMemoryMessages.forEach((msg) => {
      const isSender = String(msg.senderId) === currentUserId;
      const isReceiver = String(msg.receiverId) === currentUserId;

      if (isSender || isReceiver) {
        const partnerId = isSender ? String(msg.receiverId) : String(msg.senderId);
        const convId = msg.conversationId || getDeterministicConversationId(currentUserId, partnerId);

        if (!convMap[convId]) {
          const partnerUser = findUserDetails(partnerId);
          convMap[convId] = {
            conversationId: convId,
            participants: [currentUserId, partnerId],
            participantDetails: [
              {
                userId: currentUserId,
                name: req.user.name,
                role: req.user.role,
                email: req.user.email,
              },
              {
                userId: partnerId,
                name: partnerUser ? partnerUser.name : isSender ? msg.receiverName : msg.senderName,
                role: partnerUser ? partnerUser.role : isSender ? msg.receiverRole : msg.senderRole,
                email: partnerUser ? partnerUser.email : "",
                department: partnerUser ? partnerUser.department : "",
                year: partnerUser ? partnerUser.year : "",
                specialization: partnerUser ? partnerUser.specialization : "",
              },
            ],
            lastMessage: msg.message,
            lastMessageTime: msg.timestamp,
            lastSenderId: String(msg.senderId),
            unreadCount: {},
            createdAt: msg.timestamp,
            updatedAt: msg.timestamp,
          };
        } else {
          // Update last message if more recent
          if (new Date(msg.timestamp) > new Date(convMap[convId].lastMessageTime || 0)) {
            convMap[convId].lastMessage = msg.message;
            convMap[convId].lastMessageTime = msg.timestamp;
            convMap[convId].lastSenderId = String(msg.senderId);
          }
        }
      }
    });

    // 3. Format output for frontend
    const conversationList = Object.values(convMap).map((conv) => {
      const partnerId = conv.participants.find((p) => String(p) !== currentUserId) || currentUserId;
      const partnerUser = findUserDetails(partnerId);

      let pDetails = Array.isArray(conv.participantDetails)
        ? conv.participantDetails.find((p) => String(p.userId) === String(partnerId))
        : null;

      const contactName = partnerUser ? partnerUser.name : pDetails ? pDetails.name : "Campus User";
      const contactRole = partnerUser ? partnerUser.role : pDetails ? pDetails.role : "user";
      const contactEmail = partnerUser ? partnerUser.email : pDetails ? pDetails.email : "";
      const contactDepartment = partnerUser ? partnerUser.department : pDetails ? pDetails.department : "";
      const contactYear = partnerUser ? partnerUser.year : pDetails ? pDetails.year : "";
      const contactSpecialization = partnerUser ? partnerUser.specialization : pDetails ? pDetails.specialization : "";

      // Count unread messages sent TO this user
      const unread = inMemoryMessages.filter(
        (m) =>
          String(m.receiverId) === currentUserId &&
          String(m.senderId) === String(partnerId) &&
          !m.readStatus
      ).length;

      return {
        conversationId: conv.conversationId,
        contactId: partnerId,
        contactName,
        contactRole,
        contactEmail,
        contactDepartment,
        contactYear,
        contactSpecialization,
        lastMessage: conv.lastMessage || "",
        lastMessageTime: conv.lastMessageTime || conv.updatedAt || conv.createdAt,
        lastSenderId: conv.lastSenderId || "",
        unreadCount: unread,
      };
    });

    // Sort descending by latest message time
    conversationList.sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));

    return res.json(conversationList);
  } catch (error) {
    console.error("Get Conversations Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch conversations." });
  }
});

// ==========================================================================
// 3. GET MESSAGES FOR A CONVERSATION
//    Supports GET /api/messages/conversation/:conversationId
//    and GET /api/messages/:conversationId
// ==========================================================================
function handleGetConversationMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const currentUserId = String(req.user._id || req.user.id);
    const inMemoryMessages = loadServerMessages();

    // Query messages strictly between this authenticated user and the conversation partner
    const messages = inMemoryMessages.filter((m) => {
      const isParticipant =
        String(m.senderId) === currentUserId || String(m.receiverId) === currentUserId;
      if (!isParticipant) return false;

      // 1. Direct conversationId match
      if (m.conversationId === conversationId) return true;

      // 2. Direct partner ID match
      if (
        (String(m.senderId) === currentUserId && String(m.receiverId) === conversationId) ||
        (String(m.receiverId) === currentUserId && String(m.senderId) === conversationId)
      ) {
        return true;
      }

      // 3. Normalized pair match
      const partnerId = String(m.senderId) === currentUserId ? String(m.receiverId) : String(m.senderId);
      const expectedConvId = getDeterministicConversationId(currentUserId, partnerId);
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

    if (updated) {
      saveServerMessages(inMemoryMessages);
      if (mongoose.connection.readyState === 1) {
        try {
          Message.updateMany(
            { conversationId, receiverId: currentUserId, readStatus: false },
            { readStatus: true }
          ).exec();
        } catch (e) {}
      }
    }

    const sortedMessages = messages.sort(
      (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
    );

    return res.json(sortedMessages);
  } catch (error) {
    console.error("Get Conversation Messages Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch conversation messages." });
  }
}

router.get("/conversation/:conversationId", protect, handleGetConversationMessages);
router.get("/:conversationId", protect, handleGetConversationMessages);

// ==========================================================================
// 4. SEND MESSAGE (POST /api/messages)
// ==========================================================================
router.post("/", protect, async (req, res) => {
  try {
    const { receiverId, receiverRole, receiverName, message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message content cannot be empty.",
      });
    }

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID is required.",
      });
    }

    const senderId = String(req.user._id || req.user.id);
    const senderRole = req.user.role || "student";
    const senderName = req.user.name || "Campus User";
    const cleanReceiverId = String(receiverId).trim();

    // Prevent sending message to oneself
    if (senderId === cleanReceiverId) {
      return res.status(400).json({
        success: false,
        message: "Cannot send message to yourself.",
      });
    }

    // Lookup receiver details
    const receiverUser = findUserDetails(cleanReceiverId);
    const cleanReceiverName = receiverUser ? receiverUser.name : receiverName || "Recipient";
    const cleanReceiverRole = receiverUser ? receiverUser.role : receiverRole || (senderRole === "student" ? "faculty" : "student");
    const cleanReceiverEmail = receiverUser ? receiverUser.email : "";

    // Deterministic Conversation ID
    const conversationId = getDeterministicConversationId(senderId, cleanReceiverId);
    const nowIso = new Date().toISOString();

    const newMessage = {
      _id: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
      id: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
      conversationId,
      senderId,
      senderRole,
      senderName,
      receiverId: cleanReceiverId,
      receiverRole: cleanReceiverRole,
      receiverName: cleanReceiverName,
      message: message.trim(),
      readStatus: false,
      timestamp: nowIso,
    };

    // 1. Save Message to Database (if MongoDB connected)
    if (mongoose.connection.readyState === 1) {
      try {
        const dbMsg = await Message.create(newMessage);
        if (dbMsg && dbMsg._id) newMessage._id = dbMsg._id.toString();
      } catch (dbErr) {}
    }

    const inMemoryMessages = loadServerMessages();
    inMemoryMessages.push(newMessage);
    saveServerMessages(inMemoryMessages);

    // 2. Create or Update Conversation
    let inMemoryConversations = loadServerConversations();
    let existingConvIndex = inMemoryConversations.findIndex(
      (c) => c.conversationId === conversationId
    );

    const participantDetails = [
      {
        userId: senderId,
        name: senderName,
        role: senderRole,
        email: req.user.email || "",
        department: req.user.department || "",
        year: req.user.year || "",
        specialization: req.user.specialization || "",
      },
      {
        userId: cleanReceiverId,
        name: cleanReceiverName,
        role: cleanReceiverRole,
        email: cleanReceiverEmail,
        department: receiverUser ? receiverUser.department : "",
        year: receiverUser ? receiverUser.year : "",
        specialization: receiverUser ? receiverUser.specialization : "",
      },
    ];

    let convObj;

    if (existingConvIndex >= 0) {
      // Update existing conversation
      convObj = inMemoryConversations[existingConvIndex];
      convObj.lastMessage = newMessage.message;
      convObj.lastMessageTime = nowIso;
      convObj.lastSenderId = senderId;
      convObj.updatedAt = nowIso;
      convObj.participantDetails = participantDetails;

      if (!convObj.unreadCount) convObj.unreadCount = {};
      convObj.unreadCount[cleanReceiverId] = (convObj.unreadCount[cleanReceiverId] || 0) + 1;
      convObj.unreadCount[senderId] = 0;

      inMemoryConversations[existingConvIndex] = convObj;
    } else {
      // Create new conversation
      convObj = {
        _id: "conv_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        id: "conv_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        conversationId,
        participants: [senderId, cleanReceiverId],
        participantDetails,
        lastMessage: newMessage.message,
        lastMessageTime: nowIso,
        lastSenderId: senderId,
        unreadCount: {
          [cleanReceiverId]: 1,
          [senderId]: 0,
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      inMemoryConversations.unshift(convObj);
    }

    saveServerConversations(inMemoryConversations);

    if (mongoose.connection.readyState === 1) {
      try {
        await Conversation.findOneAndUpdate(
          { conversationId },
          {
            conversationId,
            participants: [senderId, cleanReceiverId],
            participantDetails,
            lastMessage: newMessage.message,
            lastMessageTime: new Date(nowIso),
            lastSenderId: senderId,
            $inc: { [`unreadCount.${cleanReceiverId}`]: 1 },
            $set: { [`unreadCount.${senderId}`]: 0 },
          },
          { upsert: true, new: true }
        );
      } catch (e) {}
    }

    return res.status(201).json({
      success: true,
      message: "Message delivered and permanently saved.",
      data: newMessage,
      conversation: {
        conversationId,
        contactId: cleanReceiverId,
        contactName: cleanReceiverName,
        contactRole: cleanReceiverRole,
        lastMessage: newMessage.message,
        lastMessageTime: nowIso,
      },
    });
  } catch (error) {
    console.error("Send Message Error:", error);
    res.status(500).json({ success: false, message: "Server error while saving message." });
  }
});

// ==========================================================================
// 5. MARK CONVERSATION AS READ
//    Supports PUT /api/messages/conversation/:conversationId/read
//    and PUT /api/messages/:conversationId/read
// ==========================================================================
function handleMarkConversationRead(req, res) {
  try {
    const { conversationId } = req.params;
    const currentUserId = String(req.user._id || req.user.id);
    const inMemoryMessages = loadServerMessages();
    let inMemoryConversations = loadServerConversations();

    let updatedMessages = false;
    inMemoryMessages.forEach((m) => {
      const match =
        (m.conversationId === conversationId ||
          m.senderId === conversationId ||
          m.receiverId === conversationId) &&
        String(m.receiverId) === currentUserId;

      if (match && !m.readStatus) {
        m.readStatus = true;
        updatedMessages = true;
      }
    });

    if (updatedMessages) {
      saveServerMessages(inMemoryMessages);
      if (mongoose.connection.readyState === 1) {
        try {
          Message.updateMany(
            { receiverId: currentUserId, readStatus: false },
            { readStatus: true }
          ).exec();
        } catch (e) {}
      }
    }

    // Reset unread count in conversations
    const conv = inMemoryConversations.find(
      (c) =>
        c.conversationId === conversationId ||
        (Array.isArray(c.participants) && c.participants.includes(conversationId))
    );

    if (conv && conv.unreadCount) {
      conv.unreadCount[currentUserId] = 0;
      saveServerConversations(inMemoryConversations);
    }

    return res.json({ success: true, message: "Conversation marked as read." });
  } catch (error) {
    console.error("Mark Read Error:", error);
    res.status(500).json({ success: false, message: "Failed to mark conversation as read." });
  }
}

router.put("/conversation/:conversationId/read", protect, handleMarkConversationRead);
router.put("/:conversationId/read", protect, handleMarkConversationRead);

module.exports = router;
