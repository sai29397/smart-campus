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
  } catch (e) { }
  return [];
}

function saveServerMessages(list) {
  try {
    fs.writeFileSync(messagesFilePath, JSON.stringify(list, null, 2), "utf8");
  } catch (e) { }
}

function loadServerConversations() {
  try {
    if (fs.existsSync(conversationsFilePath)) {
      const data = fs.readFileSync(conversationsFilePath, "utf8");
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (e) { }
  return [];
}

function saveServerConversations(list) {
  try {
    fs.writeFileSync(conversationsFilePath, JSON.stringify(list, null, 2), "utf8");
  } catch (e) { }
}

function loadServerUsers() {
  try {
    if (fs.existsSync(usersFilePath)) {
      return JSON.parse(fs.readFileSync(usersFilePath, "utf8")) || [];
    }
  } catch (e) { }
  return [];
}

// Generate consistent deterministic conversation ID for any 2 users
function getDeterministicConversationId(userAId, userBId) {
  const idA = String(userAId || "").trim();
  const idB = String(userBId || "").trim();
  return [idA, idB].sort().join("_");
}

// Helper to find user info by id or email
async function findUserDetails(userIdOrEmail) {
  if (!userIdOrEmail) return null;
  const search = String(userIdOrEmail).toLowerCase().trim();

  // 1. Try MongoDB User
  if (mongoose.connection.readyState === 1) {
    try {
      let dbUser = null;
      if (mongoose.Types.ObjectId.isValid(userIdOrEmail)) {
        dbUser = await User.findById(userIdOrEmail).lean();
      }
      if (!dbUser) {
        dbUser = await User.findOne({
          $or: [
            { email: { $regex: new RegExp(`^${search}$`, "i") } },
            { id: userIdOrEmail },
          ],
        }).lean();
      }
      if (dbUser) {
        return {
          id: String(dbUser._id || dbUser.id),
          _id: String(dbUser._id || dbUser.id),
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          department: dbUser.department || "",
          year: dbUser.year || "",
          specialization: dbUser.specialization || "",
        };
      }
    } catch (e) { }
  }

  // 2. Fallback to users.json
  const allUsers = loadServerUsers();
  const user = allUsers.find(
    (u) =>
      String(u._id || u.id || "").toLowerCase().trim() === search ||
      (u.email && u.email.toLowerCase().trim() === search)
  );

  return user || null;
}

// ==========================================================================
// 1. GET AUTHORIZED CHAT CONTACTS (Searchable Directory)
// ==========================================================================
router.get("/contacts", protect, async (req, res) => {
  try {
    const currentUserId = String(req.user._id || req.user.id);
    const currentUserEmail = (req.user.email || "").toLowerCase();
    let allUsers = [];

    if (mongoose.connection.readyState === 1) {
      try {
        const dbUsers = await User.find({}).lean();
        if (Array.isArray(dbUsers) && dbUsers.length > 0) {
          allUsers = dbUsers.map((u) => ({
            id: String(u._id || u.id),
            _id: String(u._id || u.id),
            name: u.name,
            email: u.email,
            role: u.role,
            department: u.department || (u.role === "faculty" ? "Faculty" : "Computer Science"),
            year: u.year || (u.role === "faculty" ? "Faculty" : "1st Year"),
            specialization: u.specialization || (u.role === "faculty" ? "Faculty" : "General CSE"),
          }));
        }
      } catch (e) { }
    }

    if (allUsers.length === 0) {
      allUsers = loadServerUsers();
    }

    const allConversations = loadServerConversations();

    // Allow all registered campus users (Students, Faculty, Staff) to message each other
    const eligibleUsers = allUsers.filter(
      (u) =>
        String(u._id || u.id) !== currentUserId &&
        (u.email || "").toLowerCase() !== currentUserEmail
    );

    const contacts = eligibleUsers.map((u) => {
      const contactId = String(u._id || u.id);
      const convId = getDeterministicConversationId(currentUserId, contactId);
      const existingConv = allConversations.find(
        (c) =>
          c.conversationId === convId ||
          (Array.isArray(c.participants) &&
            c.participants.includes(contactId) &&
            c.participants.includes(currentUserId))
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
router.get("/conversations", protect, async (req, res) => {
  try {
    const currentUserId = String(req.user._id || req.user.id);
    const currentUserEmail = (req.user.email || "").toLowerCase();
    let inMemoryMessages = loadServerMessages();
    let inMemoryConversations = loadServerConversations();

    // Merge from MongoDB if available
    if (mongoose.connection.readyState === 1) {
      try {
        const dbMsgs = await Message.find({
          $or: [
            { senderId: currentUserId },
            { receiverId: currentUserId },
            { senderEmail: currentUserEmail },
            { receiverEmail: currentUserEmail },
          ],
        }).lean();

        if (Array.isArray(dbMsgs) && dbMsgs.length > 0) {
          const existingIds = new Set(inMemoryMessages.map((m) => String(m._id || m.id)));
          dbMsgs.forEach((m) => {
            if (!existingIds.has(String(m._id || m.id))) {
              inMemoryMessages.push(m);
            }
          });
        }
      } catch (e) { }
    }

    // Map of conversationId -> conversation
    const convMap = {};

    // 1. Index stored conversations
    inMemoryConversations.forEach((c) => {
      const isParticipant =
        (Array.isArray(c.participants) && c.participants.map(String).includes(currentUserId)) ||
        (Array.isArray(c.participantDetails) &&
          c.participantDetails.some(
            (p) =>
              String(p.userId) === currentUserId ||
              (p.email && p.email.toLowerCase() === currentUserEmail)
          ));

      if (isParticipant) {
        convMap[c.conversationId] = c;
      }
    });

    // 2. Cross-reference all messages in memory
    for (const msg of inMemoryMessages) {
      const isSender =
        String(msg.senderId) === currentUserId ||
        (msg.senderEmail && msg.senderEmail.toLowerCase() === currentUserEmail);
      const isReceiver =
        String(msg.receiverId) === currentUserId ||
        (msg.receiverEmail && msg.receiverEmail.toLowerCase() === currentUserEmail);

      if (isSender || isReceiver) {
        const partnerId = isSender ? String(msg.receiverId) : String(msg.senderId);
        const convId = msg.conversationId || getDeterministicConversationId(currentUserId, partnerId);

        if (!convMap[convId]) {
          const partnerUser =
            (await findUserDetails(partnerId)) ||
            (msg.receiverEmail && (await findUserDetails(msg.receiverEmail))) ||
            (msg.senderEmail && (await findUserDetails(msg.senderEmail)));

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
                email: partnerUser ? partnerUser.email : isSender ? msg.receiverEmail : msg.senderEmail,
                department: partnerUser ? partnerUser.department : "",
                year: partnerUser ? partnerUser.year : "",
                specialization: partnerUser ? partnerUser.specialization : "",
              },
            ],
            lastMessage: msg.message || msg.content || msg.text || "",
            lastMessageTime: msg.timestamp,
            lastSenderId: String(msg.senderId),
            unreadCount: {},
            createdAt: msg.timestamp,
            updatedAt: msg.timestamp,
          };
        } else {
          // Update last message if more recent
          if (new Date(msg.timestamp) > new Date(convMap[convId].lastMessageTime || 0)) {
            convMap[convId].lastMessage = msg.message || msg.content || msg.text || "";
            convMap[convId].lastMessageTime = msg.timestamp;
            convMap[convId].lastSenderId = String(msg.senderId);
          }
        }
      }
    }

    // 3. Format output for frontend
    const conversationList = [];
    for (const conv of Object.values(convMap)) {
      const partnerId =
        conv.participants.find((p) => String(p) !== currentUserId) ||
        (Array.isArray(conv.participantDetails)
          ? (conv.participantDetails.find((p) => String(p.userId) !== currentUserId) || {}).userId
          : "") ||
        currentUserId;

      const partnerUser = await findUserDetails(partnerId);
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
          (String(m.receiverId) === currentUserId ||
            (m.receiverEmail && m.receiverEmail.toLowerCase() === currentUserEmail)) &&
          (String(m.senderId) === String(partnerId) ||
            (m.senderEmail && m.senderEmail.toLowerCase() === String(contactEmail).toLowerCase())) &&
          !m.readStatus
      ).length;

      conversationList.push({
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
      });
    }

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
async function handleGetConversationMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const currentUserId = String(req.user._id || req.user.id);
    const currentUserEmail = (req.user.email || "").toLowerCase();

    // Determine partnerId if single ID was passed
    let partnerId = conversationId;
    if (conversationId.includes("_")) {
      const parts = conversationId.split("_");
      partnerId = parts.find((p) => p !== currentUserId) || conversationId;
    }

    let allFoundMessages = [];

    // 1. Check MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const dbMsgs = await Message.find({
          $or: [
            { conversationId },
            { senderId: currentUserId, receiverId: partnerId },
            { senderId: partnerId, receiverId: currentUserId },
            { senderEmail: currentUserEmail, receiverId: partnerId },
            { senderId: partnerId, receiverEmail: currentUserEmail },
          ],
        }).lean();

        if (Array.isArray(dbMsgs)) {
          allFoundMessages = dbMsgs;
        }
      } catch (e) { }
    }

    // 2. Merge with disk JSON messages
    const inMemoryMessages = loadServerMessages();
    const diskMatches = inMemoryMessages.filter((m) => {
      // Direct conversationId match
      if (m.conversationId === conversationId) return true;

      // Deterministic match
      const mConvId = m.conversationId || getDeterministicConversationId(m.senderId, m.receiverId);
      if (mConvId === conversationId) return true;

      const isSenderMe =
        String(m.senderId) === currentUserId ||
        (m.senderEmail && m.senderEmail.toLowerCase() === currentUserEmail);
      const isReceiverMe =
        String(m.receiverId) === currentUserId ||
        (m.receiverEmail && m.receiverEmail.toLowerCase() === currentUserEmail);

      const isSenderPartner =
        String(m.senderId) === String(partnerId) ||
        (m.senderEmail && m.senderEmail.toLowerCase() === String(partnerId).toLowerCase());
      const isReceiverPartner =
        String(m.receiverId) === String(partnerId) ||
        (m.receiverEmail && m.receiverEmail.toLowerCase() === String(partnerId).toLowerCase());

      if ((isSenderMe && isReceiverPartner) || (isReceiverMe && isSenderPartner)) {
        return true;
      }

      if (conversationId.includes(String(m.senderId)) && conversationId.includes(String(m.receiverId))) {
        return true;
      }

      return false;
    });

    const msgMap = new Map();
    allFoundMessages.forEach((m) => msgMap.set(String(m._id || m.id), m));
    diskMatches.forEach((m) => msgMap.set(String(m._id || m.id), m));

    const finalMessages = Array.from(msgMap.values());

    // Mark messages sent to this user as read
    let updated = false;
    finalMessages.forEach((m) => {
      const isReceiverMe =
        String(m.receiverId) === currentUserId ||
        (m.receiverEmail && m.receiverEmail.toLowerCase() === currentUserEmail);

      if (isReceiverMe && !m.readStatus) {
        m.readStatus = true;
        updated = true;
      }
    });

    if (updated) {
      // Update memory & disk
      inMemoryMessages.forEach((m) => {
        if (msgMap.has(String(m._id || m.id))) {
          m.readStatus = true;
        }
      });
      saveServerMessages(inMemoryMessages);

      if (mongoose.connection.readyState === 1) {
        try {
          await Message.updateMany(
            {
              $or: [{ conversationId }, { receiverId: currentUserId }],
              readStatus: false,
            },
            { readStatus: true }
          );
        } catch (e) { }
      }
    }

    const sortedMessages = finalMessages.sort(
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
    const rawMessage = req.body.message || req.body.content || req.body.text || req.body.body || "";
    const rawReceiverId = req.body.receiverId || req.body.recipientId || req.body.to || req.body.receiver || req.body.userId || "";
    const rawReceiverRole = req.body.receiverRole || req.body.role;
    const rawReceiverName = req.body.receiverName || req.body.name;
    const rawReceiverEmail = req.body.receiverEmail || req.body.email;

    if (!rawMessage || !rawMessage.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message content cannot be empty.",
      });
    }

    if (!rawReceiverId && !rawReceiverEmail) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID or email is required.",
      });
    }

    const senderId = String(req.user._id || req.user.id);
    const senderRole = req.user.role || "student";
    const senderName = req.user.name || "Campus User";
    const senderEmail = req.user.email || "";
    const cleanReceiverId = String(rawReceiverId || "").trim();

    // Prevent sending message to oneself
    if (
      senderId === cleanReceiverId ||
      (senderEmail && rawReceiverEmail && senderEmail.toLowerCase() === rawReceiverEmail.toLowerCase())
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot send message to yourself.",
      });
    }

    // Lookup receiver details
    const receiverUser =
      (await findUserDetails(cleanReceiverId)) ||
      (rawReceiverEmail && (await findUserDetails(rawReceiverEmail)));

    const effectiveReceiverId = cleanReceiverId || (receiverUser ? String(receiverUser._id || receiverUser.id) : "usr_partner");
    const effectiveReceiverName = receiverUser ? receiverUser.name : rawReceiverName || "Recipient";
    const effectiveReceiverRole = receiverUser ? receiverUser.role : rawReceiverRole || (senderRole === "student" ? "faculty" : "student");
    const effectiveReceiverEmail = receiverUser ? receiverUser.email : rawReceiverEmail || "";

    // Deterministic Conversation ID
    const conversationId = getDeterministicConversationId(senderId, effectiveReceiverId);
    const nowIso = new Date().toISOString();

    const newMessage = {
      _id: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
      id: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
      conversationId,
      senderId,
      senderRole,
      senderName,
      senderEmail,
      receiverId: effectiveReceiverId,
      receiverRole: effectiveReceiverRole,
      receiverName: effectiveReceiverName,
      receiverEmail: effectiveReceiverEmail,
      message: rawMessage.trim(),
      readStatus: false,
      timestamp: nowIso,
    };

    // 1. Save Message to MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const dbMsg = await Message.create(newMessage);
        if (dbMsg && dbMsg._id) newMessage._id = dbMsg._id.toString();
      } catch (dbErr) {
        console.error("MongoDB message create error:", dbErr);
      }
    }

    // 2. Save Message to disk
    const inMemoryMessages = loadServerMessages();
    inMemoryMessages.push(newMessage);
    saveServerMessages(inMemoryMessages);

    // 3. Create or Update Conversation
    let inMemoryConversations = loadServerConversations();
    let existingConvIndex = inMemoryConversations.findIndex(
      (c) => c.conversationId === conversationId
    );

    const participantDetails = [
      {
        userId: senderId,
        name: senderName,
        role: senderRole,
        email: senderEmail,
        department: req.user.department || "",
        year: req.user.year || "",
        specialization: req.user.specialization || "",
      },
      {
        userId: effectiveReceiverId,
        name: effectiveReceiverName,
        role: effectiveReceiverRole,
        email: effectiveReceiverEmail,
        department: receiverUser ? receiverUser.department : "",
        year: receiverUser ? receiverUser.year : "",
        specialization: receiverUser ? receiverUser.specialization : "",
      },
    ];

    let convObj;

    if (existingConvIndex >= 0) {
      convObj = inMemoryConversations[existingConvIndex];
      convObj.lastMessage = newMessage.message;
      convObj.lastMessageTime = nowIso;
      convObj.lastSenderId = senderId;
      convObj.updatedAt = nowIso;
      convObj.participantDetails = participantDetails;

      if (!convObj.unreadCount) convObj.unreadCount = {};
      convObj.unreadCount[effectiveReceiverId] = (convObj.unreadCount[effectiveReceiverId] || 0) + 1;
      convObj.unreadCount[senderId] = 0;

      inMemoryConversations[existingConvIndex] = convObj;
    } else {
      convObj = {
        _id: "conv_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        id: "conv_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        conversationId,
        participants: [senderId, effectiveReceiverId],
        participantDetails,
        lastMessage: newMessage.message,
        lastMessageTime: nowIso,
        lastSenderId: senderId,
        unreadCount: {
          [effectiveReceiverId]: 1,
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
            participants: [senderId, effectiveReceiverId],
            participantDetails,
            lastMessage: newMessage.message,
            lastMessageTime: new Date(nowIso),
            lastSenderId: senderId,
            $inc: { [`unreadCount.${effectiveReceiverId}`]: 1 },
            $set: { [`unreadCount.${senderId}`]: 0 },
          },
          { upsert: true, new: true }
        );
      } catch (e) { }
    }

    return res.status(201).json({
      success: true,
      message: "Message delivered and permanently saved.",
      data: newMessage,
      messageData: newMessage,
      conversation: {
        conversationId,
        contactId: effectiveReceiverId,
        contactName: effectiveReceiverName,
        contactRole: effectiveReceiverRole,
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
// ==========================================================================
async function handleMarkConversationRead(req, res) {
  try {
    const { conversationId } = req.params;
    const currentUserId = String(req.user._id || req.user.id);

    const inMemoryMessages = loadServerMessages();
    let updated = false;

    inMemoryMessages.forEach((m) => {
      const matchConv = m.conversationId === conversationId || m.conversationId === [currentUserId, conversationId].sort().join("_");
      if (matchConv && String(m.receiverId) === currentUserId && !m.readStatus) {
        m.readStatus = true;
        updated = true;
      }
    });

    if (updated) {
      saveServerMessages(inMemoryMessages);
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await Message.updateMany(
          { conversationId, receiverId: currentUserId, readStatus: false },
          { readStatus: true }
        );
        await Conversation.findOneAndUpdate(
          { conversationId },
          { $set: { [`unreadCount.${currentUserId}`]: 0 } }
        );
      } catch (e) { }
    }

    return res.json({ success: true, message: "Conversation marked as read." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to mark read." });
  }
}

router.put("/conversation/:conversationId/read", protect, handleMarkConversationRead);
router.put("/:conversationId/read", protect, handleMarkConversationRead);

module.exports = router;
