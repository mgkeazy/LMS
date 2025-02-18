// backend/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },  // Store hashed passwords
  role: { type: String, default: "student" }     // Default role is "student"
});

module.exports = mongoose.model("User", userSchema);
