require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");

const app = express();
app.use(express.json());

// CORS para REST
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true,
  })
);

const server = http.createServer(app);

// CORS para Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Memoria (para demo). En producción lo ideal: Redis / DB.
const sessions = new Map();
/**
 sessions.get(sessionId) = {
   state: { currentSlide, quizActive, showResults, updatedAt },
   participants: Map(participantId => { id, name, socketId, lastSeen }),
   answers: Map(participantId => { name, answers, updatedAt })
 }
*/

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      state: { currentSlide: 0, quizActive: false, showResults: false, updatedAt: Date.now() },
      participants: new Map(),
      answers: new Map(),
    });
  }
  return sessions.get(sessionId);
}

function publicSessionSnapshot(sessionId) {
  const s = getOrCreateSession(sessionId);
  return {
    state: s.state,
    participants: Array.from(s.participants.values()).map((p) => ({ id: p.id, name: p.name, lastSeen: p.lastSeen })),
    answers: Object.fromEntries(Array.from(s.answers.entries()).map(([pid, val]) => [pid, val])),
  };
}

// Health
app.get("/", (req, res) => res.json({ ok: true }));

// Crear sesión opcional (si quieres)
app.post("/api/sessions", (req, res) => {
  const id = nanoid(8).toLowerCase();
  getOrCreateSession(id);
  res.json({ sessionId: id });
});

// Estado de sesión (REST, por si quieres debug)
app.get("/api/sessions/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const snap = publicSessionSnapshot(sessionId);
  res.json(snap);
});

// Reset sesión (REST)
app.delete("/api/sessions/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  sessions.delete(sessionId);
  io.to(sessionId).emit("session:reset");
  res.json({ ok: true });
});

// WebSocket
io.on("connection", (socket) => {
  socket.on("session:join", ({ sessionId, role, name }, ack) => {
    try {
      if (!sessionId) throw new Error("sessionId requerido");
      const s = getOrCreateSession(sessionId);

      socket.join(sessionId);
      socket.data.sessionId = sessionId;
      socket.data.role = role;

      let participantId = socket.data.participantId;

      if (role === "participant") {
        participantId = participantId || nanoid(10);
        socket.data.participantId = participantId;

        s.participants.set(participantId, {
          id: participantId,
          name: name || "Participante",
          socketId: socket.id,
          lastSeen: Date.now(),
        });

        // Enviar snapshot al que entra
        socket.emit("state:update", s.state);
        socket.emit("participants:update", Array.from(s.participants.values()));
        socket.emit("answers:update", Object.fromEntries(s.answers));

        // Avisar a todos
        io.to(sessionId).emit("participants:update", Array.from(s.participants.values()));
      }

      if (role === "presenter") {
        socket.emit("state:update", s.state);
        socket.emit("participants:update", Array.from(s.participants.values()));
        socket.emit("answers:update", Object.fromEntries(s.answers));
      }

      ack?.({ ok: true, participantId: participantId || null, state: s.state });
    } catch (e) {
      ack?.({ ok: false, error: e.message });
    }
  });

  socket.on("state:set", ({ sessionId, patch }) => {
    if (!sessionId || !patch) return;
    const s = getOrCreateSession(sessionId);

    // Solo presentador debería enviar (pero igual lo validas en prod con auth)
    s.state = { ...s.state, ...patch, updatedAt: Date.now() };

    io.to(sessionId).emit("state:update", s.state);
  });

  socket.on("quiz:start", ({ sessionId }) => {
    if (!sessionId) return;
    const s = getOrCreateSession(sessionId);

    s.answers.clear();
    s.state = { ...s.state, quizActive: true, showResults: false, updatedAt: Date.now() };

    io.to(sessionId).emit("answers:update", Object.fromEntries(s.answers));
    io.to(sessionId).emit("state:update", s.state);
  });

  socket.on("quiz:showResults", ({ sessionId }) => {
    if (!sessionId) return;
    const s = getOrCreateSession(sessionId);
    s.state = { ...s.state, showResults: true, updatedAt: Date.now() };
    io.to(sessionId).emit("state:update", s.state);
  });

  socket.on("quiz:backToSlides", ({ sessionId }) => {
    if (!sessionId) return;
    const s = getOrCreateSession(sessionId);
    s.state = { ...s.state, quizActive: false, showResults: false, updatedAt: Date.now() };
    io.to(sessionId).emit("state:update", s.state);
  });

  socket.on("answers:set", ({ sessionId, participantId, name, answers }) => {
    if (!sessionId || !participantId) return;
    const s = getOrCreateSession(sessionId);

    // actualizar lastSeen
    const p = s.participants.get(participantId);
    if (p) {
      p.lastSeen = Date.now();
      p.name = name || p.name;
      p.socketId = socket.id;
      s.participants.set(participantId, p);
      io.to(sessionId).emit("participants:update", Array.from(s.participants.values()));
    }

    s.answers.set(participantId, { name: name || "Participante", answers: answers || {}, updatedAt: Date.now() });
    io.to(sessionId).emit("answers:update", Object.fromEntries(s.answers));
  });

  socket.on("session:reset", ({ sessionId }) => {
    if (!sessionId) return;
    sessions.delete(sessionId);
    io.to(sessionId).emit("session:reset");
    io.to(sessionId).emit("state:update", { currentSlide: 0, quizActive: false, showResults: false, updatedAt: Date.now() });
    io.to(sessionId).emit("answers:update", {});
    io.to(sessionId).emit("participants:update", []);
  });

  socket.on("disconnect", () => {
    const sessionId = socket.data.sessionId;
    const participantId = socket.data.participantId;
    if (!sessionId || !participantId) return;

    const s = sessions.get(sessionId);
    if (!s) return;

    // puedes remover, o dejarlo como offline (yo lo remuevo para simple)
    s.participants.delete(participantId);
    io.to(sessionId).emit("participants:update", Array.from(s.participants.values()));
  });
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
