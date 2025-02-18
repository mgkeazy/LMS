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


function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// function to generate hls
const generateHLS = (inputFile, outputFolder) => {
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  
  const keyInfoPath=path.resolve(__dirname,'../key_info.txt');
  const filename = path.basename(inputFile, path.extname(inputFile));

  const ffmpegCmd = `ffmpeg -i ${inputFile} \
  -profile:v baseline -level 3.0 -start_number 0 -hls_time 10 -hls_list_size 0 \
  -hls_key_info_file "${keyInfoPath}" \
  -hls_segment_filename ${outputFolder}/${filename}_%03d.ts \
  -f hls ${outputFolder}/${filename}.m3u8`;


  return new Promise((resolve, reject) => {
    exec(ffmpegCmd, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(`${outputFolder}/${filename}.m3u8`);
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
    const { title } = req.body;  // ✅ Fixed Typo

    const fileName=path.parse(req.file.originalname).name;
    // console.log(timestamp)
    const outputFolder = path.join(__dirname, "../videos",`${fileName}_${timestamp}`);


    if(!fs.existsSync(outputFolder)){
      fs.mkdirSync(outputFolder,{recursive:true});
    }
    

    //Save video details in MongoDB
    const NewVideo = new Video({
      title,
      originalFile:inputFile,
      hlsFolder:outputFolder,
      hlsPath: `videos/${fileName}_${timestamp}/${timestamp}-${fileName}.m3u8`,
      status:"processing"
    });
    await NewVideo.save();

    generateHLS(inputFile, outputFolder)
      .then(async (m3u8Path) => {
        await Video.findByIdAndUpdate(NewVideo._id, { status: "ready" });
        res.json({ success: true, message: "HLS generated", m3u8: `http://localhost:3000/${m3u8Path}` });
      })
      .catch(async (error) => {
        await Video.findByIdAndUpdate(NewVideo._id, { status: "failed" });
        res.status(500).json({ success: false, message: "HLS conversion failed", error: error.message });
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



// ----- Registration Endpoint -----
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    // Check if user already exists
    let user = await User.findOne({ username });
    if(user) {
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
});

// ----- Login Endpoint -----
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if(!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch) {
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

//to get all listed videos
app.get("/api/videos",verifyJWT,async(req,res)=>{
  try{
    const videos=await Video.find({status:"ready"},"title");
    res.json({success:true,videos});
  }catch(error){
    res.status(500).json({
      success:false,
      message:"Failed to fetch videos",
      error:error.message
    })
  }
})

// FETCH VIDEO URL FROM TITLE
app.get("/api/video-url",verifyJWT,async(req,res)=>{
  try{
    const {title}=req.query;
    const video = await Video.findOne({title,status:"ready"});

    if(!video)  return res.status(404).json({success:false,message:"Video not found"});

    const videoUrl = `http://localhost:3000/${video.hlsPath}`;
    res.json({success:true,url:videoUrl});
  } catch(error){
    res.status(500).json({success:false, message: "Failed to fetch video URL",error:error.message})
  }


})


// ----- Serve HLS Files (Playlist & Segments) Securely -----
app.use("/videos", verifyJWT, express.static(path.join(__dirname, "..", "videos")));


app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
