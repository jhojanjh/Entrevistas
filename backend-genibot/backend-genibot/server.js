const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(express.json());

// ✅ Pon aquí tu URL real de Netlify (sin / al final)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "https://labotario5.netlify.app";

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

app.get("/", (req, res) => res.send("OK - Genibot realtime backend"));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    credentials: true,
  },
});

// ---- estado en memoria (simple) ----
const sessions = new Map();
/*
sessions.get(sessionId) => {
  state: { currentSlide, quizActive, showResults },
  answers: { [name]: { [questionId]: optionIndex } },
  participants: Set(socketId)
}
*/

function ensureSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      state: { currentSlide: 0, quizActive: false, showResults: false },
      answers: {},
      participants: new Set(),
    });
  }
  return sessions.get(sessionId);
}

io.on("connection", (socket) => {
  // 1) join
  socket.on("session:join", ({ sessionId, name, role }) => {
    if (!sessionId) return;
    socket.data.sessionId = sessionId;
    socket.data.name = name || "";
    socket.data.role = role || "participant";

    socket.join(sessionId);

    const session = ensureSession(sessionId);
    session.participants.add(socket.id);

    // manda estado actual al que entra
    socket.emit("state:update", session.state);
    socket.emit("answers:update", session.answers);

    // avisa conteo
    io.to(sessionId).emit("participants:update", {
      count: session.participants.size,
    });
  });

  // 2) presentador actualiza estado
  socket.on("state:set", ({ sessionId, state }) => {
    if (!sessionId || !state) return;
    const session = ensureSession(sessionId);
    session.state = { ...session.state, ...state };
    io.to(sessionId).emit("state:update", session.state);
  });

  // 3) participante manda respuestas
  socket.on("answers:set", ({ sessionId, name, answers }) => {
    if (!sessionId || !name) return;
    const session = ensureSession(sessionId);
    session.answers[name] = answers || {};
    io.to(sessionId).emit("answers:update", session.answers);
  });

  // 4) reset (opcional)
  socket.on("session:reset", ({ sessionId }) => {
    if (!sessionId) return;
    const session = ensureSession(sessionId);
    session.state = { currentSlide: 0, quizActive: false, showResults: false };
    session.answers = {};
    io.to(sessionId).emit("state:update", session.state);
    io.to(sessionId).emit("answers:update", session.answers);
  });

  socket.on("disconnect", () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    const session = sessions.get(sessionId);
    if (!session) return;

    session.participants.delete(socket.id);

    io.to(sessionId).emit("participants:update", {
      count: session.participants.size,
    });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log("Server running on port", PORT));
    