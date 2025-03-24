import React, { useRef, useEffect, useState } from "react";
import Hls from "hls.js";

const VideoPlayer = ({ token }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null); // store hls instance here
  const [videos, setVideos] = useState([]);  // List of video titles
  const [selectedTitle, setSelectedTitle] = useState(""); // Selected video title
  const [videoUrl, setVideoUrl] = useState(""); // Video URL for playback
  const [qualityLevels, setQualityLevels] = useState([]); // Available quality levels from HLS manifest
  const [selectedQuality, setSelectedQuality] = useState("auto"); // "auto" or index of quality level

  // Fetch list of available videos
  useEffect(() => {
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

  // Load and play video when videoUrl is available; also update quality levels.
  useEffect(() => {
    if (!videoUrl) return;

    // Clean up any existing hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        },
      });
      hlsRef.current = hls; // store hls instance in the ref

      hls.loadSource(videoUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Extract available quality levels
        const levels = hls.levels.map((level) => ({
          height: level.height,
          bitrate: level.bitrate,
        }));
        setQualityLevels(levels);
        setSelectedQuality("auto"); // default to auto quality selection
        videoRef.current.play();
      });
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      videoRef.current.src = videoUrl;
      videoRef.current.addEventListener("loadedmetadata", () => {
        videoRef.current.play();
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [videoUrl, token]);

  // Update quality level when user selects one.
  const handleQualityChange = (event) => {
    const quality = event.target.value;
    setSelectedQuality(quality);

    // Update hls.currentLevel if hls instance exists.
    if (hlsRef.current) {
      if (quality === "auto") {
        hlsRef.current.currentLevel = -1; // Auto level selection
      } else {
        hlsRef.current.currentLevel = parseInt(quality, 10);
      }
      console.log("Switched to quality level:", hlsRef.current.currentLevel);
    }
  };

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

      {/* Quality Selection Dropdown */}
      {qualityLevels.length > 0 && (
        <select
          value={selectedQuality}
          onChange={handleQualityChange}
          style={{ marginBottom: "10px", padding: "5px" }}
        >
          <option value="auto">Auto</option>
          {qualityLevels.map((level, index) => (
            <option key={index} value={index}>
              {level.height}p (≈{Math.round(level.bitrate / 1000)} kbps)
            </option>
          ))}
        </select>
      )}

      {/* Video Player */}
      <video ref={videoRef} controls style={{ width: "100%", maxWidth: "800px" }} />
    </div>
  );
};

export default VideoPlayer;
