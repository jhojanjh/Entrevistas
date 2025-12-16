// src/socket.js
import { io } from "socket.io-client";

// ✅ En Netlify debes crear esta variable de entorno:
// REACT_APP_BACKEND_URL = https://TU-BACKEND.onrender.com  (o railway, fly, etc.)
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:4000";

export const socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  withCredentials: true,
});
