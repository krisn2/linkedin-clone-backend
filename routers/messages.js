const express = require("express");
const { authenticate } = require("../middleware/auth");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const router = express.Router();

// Get user's conversations
router.get("/conversations", authenticate, async (req, res) => {
  try {
    const convos = await Conversation.find({
      participants: req.user._id,
    }).populate("participants", "name avatar email");
    res.json(convos);
  } catch (err) {
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

// Get all messages between two users
router.get("/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    let convo = await Conversation.findOne({
      participants: { $all: [req.user._id, userId] },
    });
    if (!convo) return res.json([]);

    const messages = await Message.find({ conversationId: convo._id })
      .populate("sender", "name _id")
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

module.exports = router;
