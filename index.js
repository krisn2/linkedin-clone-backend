const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const server = http.createServer(app);

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error(' MongoDB error:', err));

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(helmet());
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json());
app.use(morgan('dev'));

app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routers/auth'));
app.use('/api/users', require('./routers/users'));
app.use('/api/posts', require('./routers/posts'));
app.use('/api/messages', require('./routers/messages'));

app.get('/', (req, res) => res.send('API is running...'));

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
    if (!token) return next(new Error('Auth token required'));
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    socket.userId = payload.id;
    next();
  } catch (err) {
    console.error('Socket auth error', err.message);
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  console.log('⚡ Socket connected:', socket.id, 'user:', userId);

  onlineUsers.set(userId.toString(), socket.id);
  socket.emit("onlineUsers", Array.from(onlineUsers.keys()));
  socket.broadcast.emit('userOnline', { userId });

  socket.on('typing', ({ to, typing }) => {
    const receiverSocketId = onlineUsers.get(String(to));
    if (receiverSocketId)
      io.to(receiverSocketId).emit('typing', { from: userId, typing });
  });

  socket.on('sendMessage', async ({ senderId, receiverId, text }) => {
    try {
      const Message = require('./models/Message');
      const Conversation = require('./models/Conversation');
      let convo = await Conversation.findOne({ participants: { $all: [senderId, receiverId] } });
      if (!convo) convo = await Conversation.create({ participants: [senderId, receiverId] });

      const newMsg = await Message.create({ conversationId: convo._id, sender: senderId, text });
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (receiverSocketId) io.to(receiverSocketId).emit('receiveMessage', newMsg);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('manualDisconnect', () => {
    for (const [key, value] of onlineUsers.entries()) {
      if (value === socket.id) {
        onlineUsers.delete(key);
        socket.broadcast.emit('userOffline', { userId: key });
        break;
      }
    }
    socket.disconnect(true);
    console.log(`User ${userId} manually disconnected`);
  });

  socket.on('disconnect', (reason) => {
    if (reason === "io server disconnect") return;
    console.log('Socket lost temporarily:', reason);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
