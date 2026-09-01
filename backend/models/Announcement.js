const mongoose = require("mongoose");

const AnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Announcement title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Announcement description is required"],
      trim: true,
    },
    department: {
      type: String,
      required: true,
      default: "All Departments",
    },
    year: {
      type: String,
      required: true,
      default: "All Years",
    },
    priority: {
      type: String,
      enum: ["Normal", "Important", "Urgent"],
      default: "Normal",
    },
    authorName: {
      type: String,
      default: "Faculty Member",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Announcement", AnnouncementSchema);
