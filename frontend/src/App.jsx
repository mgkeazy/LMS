// frontend/src/App.js
import React, { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";

import VideoPlayer from "./VideoPlayer";
import RegistrationForm from "./RegistrationForm";
import UploadVideo from "./UploadVideo";

function App() {
  const [token, setToken] = useState("");
  const [mode, setMode] = useState("login"); // "login" or "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState("student"); // default to student

  const login = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        setToken(data.token);
        setLoggedIn(true);
        // Decode the JWT to get the user role
        const decoded = jwtDecode(data.token);
        setUserRole(decoded.role);
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Login error");
    }
  };

  if (!loggedIn) {
    return (
      <div style={{ padding: "20px" }}>
        {mode === "login" ? (
          <div>
            <h2>Login</h2>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <form onSubmit={login}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              /><br/>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              /><br/>
              <button type="submit">Login</button>
            </form>
            <button onClick={() => setMode("register")}>
              Register
            </button>
          </div>
        ) : (
          <div>
            <RegistrationForm onRegistered={() => setMode("login")} />
            <button onClick={() => setMode("login")}>Back to Login</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Welcome, {username}!</h2>
      {userRole === "admin" ? (
        // If admin, show the upload interface only
        <UploadVideo token={token} />
      ) : (
        // If not admin, show the video player
        <VideoPlayer token={token} />
      )}
    </div>
  );
}

export default App;
