const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["student", "faculty", "admin"],
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    receiverId: {
      type: String,
      required: true,
    },
    receiverRole: {
      type: String,
      enum: ["student", "faculty", "admin"],
      required: true,
    },
    receiverName: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    readStatus: {
      type: Boolean,
      default: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Message", MessageSchema);
