const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

exports.register= async(req,res) =>  {
  const { username, password } = req.body;
  try {
    // Check if user already exists
    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ error: "User already exists" });
    }
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ username, password: hashedPassword });
    await user.save();
    res.json({ message: "Registration successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// ----- Login Endpoint -----
exports.login= async(req,res) => {
      const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ username, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};