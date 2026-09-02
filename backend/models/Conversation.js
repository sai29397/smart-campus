const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    participants: {
      type: [String],
      required: true,
      index: true,
    },
    participantDetails: [
      {
        userId: { type: String, required: true },
        name: { type: String, required: true },
        role: { type: String, required: true },
        email: { type: String },
        department: { type: String },
        year: { type: String },
        specialization: { type: String },
      },
    ],
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageTime: {
      type: Date,
      default: Date.now,
    },
    lastSenderId: {
      type: String,
      default: "",
    },
    unreadCount: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Conversation", ConversationSchema);
