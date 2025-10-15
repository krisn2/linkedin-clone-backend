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
.then(() => console.log('✅ MongoDB connected'))
.catch((err) => console.error('❌ MongoDB error:', err));

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ✅ middlewares
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

const authRoutes = require('./routers/auth');
const userRoutes = require('./routers/users');
const postRoutes = require('./routers/posts');
const messageRoutes = require('./routers/messages');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization"],
  },
});

// Track connected users
const onlineUsers = new Map();

// Socket authentication
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Auth token required'));
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    socket.userId = payload.id;
    return next();
  } catch (err) {
    console.error('Socket auth error', err.message);
    return next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  console.log('⚡ Socket connected:', socket.id, 'user:', userId);

  const currentlyOnline = Array.from(onlineUsers.keys());
  socket.emit("onlineUsers", currentlyOnline);
  onlineUsers.set(userId.toString(), socket.id);
  socket.broadcast.emit('userOnline', { userId });

  socket.on('typing', ({ to, typing }) => {
    const receiverSocketId = onlineUsers.get(String(to));
    if (receiverSocketId) io.to(receiverSocketId).emit('typing', { from: userId, typing });
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
      console.error('Error saving message in sendMessage:', err);
    }
  });

  socket.on('disconnect', () => {
    for (const [key, value] of onlineUsers.entries()) {
      if (value === socket.id) {
        onlineUsers.delete(key);
        socket.broadcast.emit('userOffline', { userId: key });
        break;
      }
    }
    console.log('Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
