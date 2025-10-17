const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

dotenv.config();
const app = express();
const server = http.createServer(app);

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const allowedOrigins = [
  "http://localhost:5173",
  "https://linkedin-clone-frontend-one.vercel.app",
];

app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else {
        console.warn("Blocked CORS origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(morgan("dev"));
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "uploads"))
);

app.use("/api/auth", require("./routers/auth"));
app.use("/api/users", require("./routers/users"));
app.use("/api/posts", require("./routers/posts"));
app.use("/api/messages", require("./routers/messages"));
app.get("/", (req, res) => res.send("API is running..."));

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization"],
  },
});

const onlineUsers = new Map();

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("Auth token required"));
    const payload = jwt.verify(token, process.env.JWT_SECRET || "secret");
    socket.userId = payload.id;
    next();
  } catch (err) {
    console.error("Socket auth error", err.message);
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  console.log("⚡ Socket connected:", socket.id, "user:", userId);

  onlineUsers.set(userId.toString(), socket.id);
  io.emit("onlineUsers", Array.from(onlineUsers.keys()));
  socket.broadcast.emit("userOnline", { userId });

  socket.on("typing", ({ to, typing }) => {
    const receiverSocketId = onlineUsers.get(String(to));
    if (receiverSocketId)
      io.to(receiverSocketId).emit("typing", { from: userId, typing });
  });

  socket.on("sendMessage", async ({ senderId, receiverId, text }) => {
    try {
      const Message = require("./models/Message");
      const Conversation = require("./models/Conversation");
      let convo = await Conversation.findOne({
        participants: { $all: [senderId, receiverId] },
      });
      if (!convo)
        convo = await Conversation.create({
          participants: [senderId, receiverId],
        });

      const newMsg = await Message.create({
        conversationId: convo._id,
        sender: senderId,
        text,
      });
      const populatedMsg = await newMsg.populate(
        "sender",
        "name _id email avatar"
      );

      const receiverSocketId = onlineUsers.get(String(receiverId));
    const senderSocketId = onlineUsers.get(String(senderId));

    if (receiverSocketId)
      io.to(receiverSocketId).emit('receiveMessage', populatedMsg);

    if (senderSocketId)
      io.to(senderSocketId).emit('messageSentAck', populatedMsg);
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on("manualDisconnect", () => {
    if (onlineUsers.has(userId.toString())) {
      onlineUsers.delete(userId.toString());
      socket.broadcast.emit("userOffline", { userId });
    }
    socket.disconnect(true);
    console.log(`User ${userId} manually disconnected`);
  });

  socket.on("disconnect", (reason) => {
    if (onlineUsers.has(userId.toString())) {
      onlineUsers.delete(userId.toString());
      socket.broadcast.emit("userOffline", { userId });
    }
    console.log(`🔌 User ${userId} disconnected (${reason})`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(` Server running on port ${PORT}`));
