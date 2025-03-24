// backend/server.js
require('dotenv').config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { exec } = require("child_process");
const multer = require("multer");

const User = require("./models/User");
const Video = require("./models/Video");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

const UserRoute= require('./routes/User');

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

app.use(cors());
app.use(express.json()); // Parse JSON bodies

// ----- Multer Setup for File Uploads -----
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save raw uploads to "uploads" folder
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    // Create a unique file name using the current timestamp
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// Admin role middleware
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ----- Function to generate adaptive HLS with watermark -----
const generateHLS = (inputFile, outputFolder) => {
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  
  const keyInfoPath = path.resolve(__dirname, '../key_info.txt');
  const filename = path.basename(inputFile, path.extname(inputFile));
  const watermarkPath = path.join(__dirname, 'assets', 'watermark.png');

  // Build the ffmpeg command for 4 renditions with watermark overlay (top-right) and encryption.
  const ffmpegCmd = `ffmpeg -i ${inputFile} -i "${watermarkPath}" -filter_complex "\
[0:v]split=4[v1][v2][v3][v4]; \
[v1][1:v]overlay=main_w-overlay_w-10:10,scale=640:360[v1out]; \
[v2][1:v]overlay=main_w-overlay_w-10:10,scale=854:480[v2out]; \
[v3][1:v]overlay=main_w-overlay_w-10:10,scale=1280:720[v3out]; \
[v4][1:v]overlay=main_w-overlay_w-10:10,scale=1920:1080[v4out]" \
-map "[v1out]" -map 0:a? -c:v libx264 -b:v 800k -c:a aac -f hls -hls_time 10 -hls_list_size 0 \
-hls_key_info_file "${keyInfoPath}" -hls_segment_filename ${outputFolder}/${filename}_360p_%03d.ts \
${outputFolder}/360p.m3u8 \
-map "[v2out]" -map 0:a? -c:v libx264 -b:v 1400k -c:a aac -f hls -hls_time 10 -hls_list_size 0 \
-hls_key_info_file "${keyInfoPath}" -hls_segment_filename ${outputFolder}/${filename}_480p_%03d.ts \
${outputFolder}/480p.m3u8 \
-map "[v3out]" -map 0:a? -c:v libx264 -b:v 2800k -c:a aac -f hls -hls_time 10 -hls_list_size 0 \
-hls_key_info_file "${keyInfoPath}" -hls_segment_filename ${outputFolder}/${filename}_720p_%03d.ts \
${outputFolder}/720p.m3u8 \
-map "[v4out]" -map 0:a? -c:v libx264 -b:v 5000k -c:a aac -f hls -hls_time 10 -hls_list_size 0 \
-hls_key_info_file "${keyInfoPath}" -hls_segment_filename ${outputFolder}/${filename}_1080p_%03d.ts \
${outputFolder}/1080p.m3u8`;

  // Run the ffmpeg command and create a master playlist once finished.
  return new Promise((resolve, reject) => {
    exec(ffmpegCmd, (error) => {
      if (error) {
        reject(error);
      } else {
        // Create master playlist to combine all renditions for adaptive streaming.
        const masterPlaylist = `#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=640x360
360p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480
480p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720
720p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p.m3u8
`;
        fs.writeFile(path.join(outputFolder, 'master.m3u8'), masterPlaylist, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(`${outputFolder}/master.m3u8`);
          }
        });
      }
    });
  });
};

// ----- Video Upload & Conversion Endpoint -----
// Admin uploads a video, and the backend automatically converts it to HLS.
app.post("/api/upload-video", verifyJWT, requireAdmin, upload.single("video"), async (req, res) => {
  try {
    const inputFile = req.file.path;
    const timestamp = req.file.filename.split('-')[0];
    const { title } = req.body;
    const fileName = path.parse(req.file.originalname).name;
    const outputFolder = path.join(__dirname, "../videos", `${fileName}_${timestamp}`);

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    // Save video details in MongoDB
    const NewVideo = new Video({
      title,
      originalFile: inputFile,
      hlsFolder: outputFolder,
      // Note: hlsPath now points to the master playlist
      hlsPath: `videos/${fileName}_${timestamp}/master.m3u8`,
      status: "processing"
    });
    await NewVideo.save();

    generateHLS(inputFile, outputFolder)
      .then(async (m3u8Path) => {
        await Video.findByIdAndUpdate(NewVideo._id, { status: "ready" });
        res.json({ 
          success: true, 
          message: "HLS renditions and master playlist generated", 
          m3u8: `http://localhost:${PORT}/${m3u8Path}` 
        });
      })
      .catch(async (error) => {
        await Video.findByIdAndUpdate(NewVideo._id, { status: "failed" });
        res.status(500).json({ success: false, message: "HLS conversion failed", error: error.message });
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



app.use("/api",UserRoute);
// ----- Registration Endpoint -----
// app.post("/api/register", async (req, res) => {
//   const { username, password } = req.body;
//   try {
//     // Check if user already exists
//     let user = await User.findOne({ username });
//     if (user) {
//       return res.status(400).json({ error: "User already exists" });
//     }
//     // Hash the password
//     const hashedPassword = await bcrypt.hash(password, 10);
//     user = new User({ username, password: hashedPassword });
//     await user.save();
//     res.json({ message: "Registration successful" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// ----- Login Endpoint -----
app.post("/api/login", async (req, res) => {
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
});

// ----- JWT Verification Middleware -----
function verifyJWT(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Missing token" });
  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
}

// ----- Secure Endpoint for the Encryption Key -----
app.get("/key", verifyJWT, (req, res) => {
  const keyPath = path.join(__dirname, "..", "enc.key");
  fs.readFile(keyPath, (err, data) => {
    if (err) return res.status(500).send("Key not found");
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(data);
  });
});

// ----- List Videos Endpoint -----
app.get("/api/videos", verifyJWT, async (req, res) => {
  try {
    const videos = await Video.find({ status: "ready" }, "title");
    res.json({ success: true, videos });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch videos",
      error: error.message
    });
  }
});

// ----- Fetch Video URL from Title -----
app.get("/api/video-url", verifyJWT, async (req, res) => {
  try {
    const { title } = req.query;
    const video = await Video.findOne({ title, status: "ready" });
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    const videoUrl = `http://localhost:${PORT}/${video.hlsPath}`;
    res.json({ success: true, url: videoUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch video URL", error: error.message });
  }
});

// ----- Serve HLS Files (Playlist & Segments) Securely -----
app.use("/videos", verifyJWT, express.static(path.join(__dirname, "..", "videos")));

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
