const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();


const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin:"*",
    methods: ["GET", "POST","PUT", "DELETE"],
  },
});

const onlineUsers = new Map();


// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));


app.use('/uploads', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, 'uploads')));


const MONGO = process.env.MONGO_URL
mongoose.connect(MONGO) 
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
const authRoutes = require('./routers/auth');
const userRoutes = require('./routers/users');
const postRoutes = require('./routers/posts');
const messageRoutes = require("./routers/messages");



app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use("/api/messages", messageRoutes);


// Error handler
app.use((err, req, res, next) => {
console.error(err);
res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});


const PORT = process.env.PORT || 4000;



// Listen for socket connections
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("register", (userId) => {
    onlineUsers.set(userId, socket.id);
  });

  socket.on("sendMessage", async ({ senderId, receiverId, text }) => {
    const Message = require("./models/Message");
    const Conversation = require("./models/Conversation");

    // find or create conversation
    let convo = await Conversation.findOne({ participants: { $all: [senderId, receiverId] } });
    if (!convo) {
      convo = await Conversation.create({ participants: [senderId, receiverId] });
    }

    const newMsg = await Message.create({
      conversationId: convo._id,
      sender: senderId,
      text,
    });

    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receiveMessage", newMsg);
    }
  });

  socket.on("disconnect", () => {
    for (const [key, value] of onlineUsers.entries()) {
      if (value === socket.id) {
        onlineUsers.delete(key);
        break;
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
