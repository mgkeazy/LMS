// frontend/src/UploadVideo.js
import React, { useState } from "react";

const UploadVideo = ({ token }) => {
  const [videoFile, setVideoFile] = useState(null);
  const [title, setTitle] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");

  const handleFileChange = (e) => {
    setVideoFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!videoFile) {
      setUploadStatus("Please select a video file.");
      return;
    }

    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("title", title);

    try {
      const response = await fetch("http://localhost:3000/api/upload-video", {
        method: "POST",
        headers: {
          // Attach JWT token for authorization
          "Authorization": `Bearer ${token}`,
        },
        body: formData,
      });
      console.log(response);
      
      const data = await response.json();
      if (response.ok) {
        setUploadStatus(`Upload successful! Video ID: ${data.videoId}`);
      } else {
        setUploadStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("Upload failed. Please try again.");
    }
  };

  return (
    <div>
      <h2>Upload Video</h2>
      <form onSubmit={handleUpload}>
        <input
          type="text"
          placeholder="Video Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        /><br/>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          required
        /><br/>
        <button type="submit">Upload Video</button>
      </form>
      {uploadStatus && <p>{uploadStatus}</p>}
    </div>
  );
};

export default UploadVideo;
