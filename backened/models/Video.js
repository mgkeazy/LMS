// backend/models/Video.js
const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  originalFile: { type: String, required: true }, // Path to uploaded file
  hlsFolder: { type: String, required: true },   // Folder name where HLS output is stored
  hlsPath: { type: String }, // Full path to .m3u8 file (optional, can be generated dynamically)
  status: { type: String, enum: ["processing", "ready", "failed"], default: "processing" }, // Track conversion status
  createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model("Video", videoSchema);
