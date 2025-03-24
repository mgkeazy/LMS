import React, { useState } from 'react';

function RegistrationForm({ onRegistered }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      const response = await fetch("http://localhost:3000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (response.ok) {
        onRegistered(); // Switch back to login mode after successful registration
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      setError("Registration error");
    }
  };

  return (
    <form onSubmit={handleRegister} className="p-4">
      <h2 className="text-xl font-semibold mb-2">Register</h2>
      {error && <p className="text-red-500">{error}</p>}
      <input 
        type="text" 
        placeholder="Username" 
        value={username} 
        onChange={(e) => setUsername(e.target.value)} 
        required 
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
      />
      <input 
        type="password" 
        placeholder="Password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
        required 
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
      />
      <input 
        type="password" 
        placeholder="Confirm Password" 
        value={confirmPassword} 
        onChange={(e) => setConfirmPassword(e.target.value)} 
        required 
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
      />
      <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600">Register</button>
    </form>
  );
}

export default RegistrationForm;
