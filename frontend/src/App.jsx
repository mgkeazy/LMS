import React, { useState } from "react";
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
  const [userRole, setUserRole] = useState("student");

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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-purple-500 to-blue-500">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-96 text-center">
          {mode === "login" ? (
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6">Login</h2>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <form onSubmit={login} className="flex flex-col gap-4">
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="border rounded-md p-3 w-full focus:ring-2 focus:ring-blue-400 outline-none"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border rounded-md p-3 w-full focus:ring-2 focus:ring-blue-400 outline-none"
                />
                <button type="submit" className="bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 rounded-lg hover:opacity-90 transition duration-300">
                  Login
                </button>
              </form>
              <button onClick={() => setMode("register")} className="mt-4 text-blue-500 text-sm underline">
                Register
              </button>
            </div>
          ) : (
            <div>
              <RegistrationForm onRegistered={() => setMode("login")} />
              <button onClick={() => setMode("login")} className="mt-4 text-blue-500 text-sm underline">
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-purple-500 to-blue-500 p-6 text-white">
      <h2 className="text-4xl font-bold">Welcome, {username}!</h2>
      <div className="mt-6 w-full max-w-lg bg-white p-6 rounded-2xl shadow-xl text-gray-800">
        {userRole === "admin" ? <UploadVideo token={token} /> : <VideoPlayer token={token} />}
      </div>
    </div>
  );
}

export default App;