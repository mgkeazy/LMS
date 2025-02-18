import React, { useRef, useEffect, useState } from "react";
import Hls from "hls.js";

const VideoPlayer = ({ token }) => {
  const videoRef = useRef(null);
  const [videos, setVideos] = useState([]);  // List of video titles
  const [selectedTitle, setSelectedTitle] = useState(""); // Selected video title
  const [videoUrl, setVideoUrl] = useState(""); // Video URL for playback

  useEffect(() => {
    // Fetch list of available videos
    const fetchVideos = async () => {
      try {
        const response = await fetch("http://localhost:3000/api/videos", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) {
          setVideos(data.videos);
          setSelectedTitle(data.videos[0]?.title || ""); // Select first video by default
        }
      } catch (error) {
        console.error("Failed to fetch videos:", error);
      }
    };
    fetchVideos();
  }, [token]);

  // Fetch video URL when a title is selected
  useEffect(() => {
    if (!selectedTitle) return;
    
    const fetchVideoUrl = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/video-url?title=${encodeURIComponent(selectedTitle)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) {
          setVideoUrl(data.url);
        }
      } catch (error) {
        console.error("Failed to fetch video URL:", error);
      }
    };
    fetchVideoUrl();
  }, [selectedTitle, token]);

  // Load and play video when videoUrl is available
  useEffect(() => {
    if (!videoUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        },
      });
      hls.loadSource(videoUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current.play();
      });
      return () => hls.destroy();
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      videoRef.current.src = videoUrl;
      videoRef.current.addEventListener("loadedmetadata", () => {
        videoRef.current.play();
      });
    }
  }, [videoUrl, token]);

  return (
    <div>
      {/* Video Selection Dropdown */}
      <select
        value={selectedTitle}
        onChange={(e) => setSelectedTitle(e.target.value)}
        style={{ marginBottom: "10px", padding: "5px" }}
      >
        {videos.map((video, index) => (
          <option key={`${video.title}-${index}`} value={video.title}>
            {video.title}
          </option>
        ))}
      </select>


      {/* Video Player */}
      <video ref={videoRef} controls style={{ width: "100%", maxWidth: "800px" }} />
    </div>
  );
};

export default VideoPlayer;
