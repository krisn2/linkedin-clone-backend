const express3 = require("express");
const { body, validationResult } = require("express-validator");
const uploadMiddleware = require("../middleware/upload");
const { authenticate: auth } = require("../middleware/auth");
const Post = require("../models/Post");
const router3 = express3.Router();
const path = require("path")
const fs = require("fs")

const cpUpload = uploadMiddleware.fields([
  { name: "images", maxCount: 6 },
  { name: "video", maxCount: 1 },
]);

router3.post(
  "/",
  auth,
  cpUpload,
  [body("text").optional().isLength({ max: 5000 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    try {
      const media = [];
      if (req.files) {
        if (req.files["images"]) {
          for (const f of req.files["images"])
            media.push({ type: "image", url: `/uploads/${f.filename}` });
        }
        if (req.files["video"] && req.files["video"][0]) {
          media.push({
            type: "video",
            url: `/uploads/${req.files["video"][0].filename}`,
          });
        }
      }
      const post = new Post({
        author: req.user._id,
        text: req.body.text || "",
        media,
      });
      await post.save();
      res.json(post);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

router3.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("author", "name avatar headline");
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router3.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate(
      "author",
      "name avatar headline"
    );
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router3.put(
  "/:id",
  auth,
  [body("text").optional().isLength({ max: 5000 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ error: "Post not found" });
      if (post.author.toString() !== req.user._id.toString())
        return res.status(403).json({ error: "Forbidden" });
      if (req.body.text !== undefined) post.text = req.body.text;
      await post.save();
      res.json(post);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);
router3.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.author.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Forbidden" });

    // Handle different media formats safely
    const mediaFiles = Array.isArray(post.media) ? post.media : [post.media];

    mediaFiles.forEach(file => {
      if (!file) return;

      // Extract actual filename whether media is a string or object
      const fileName = typeof file === "string" ? file : file.url || file.path || null;

      if (fileName) {
        const filePath = path.join(__dirname, "..", "uploads", fileName);
        fs.unlink(filePath, err => {
          if (err) console.warn("Failed to delete media:", err.message);
        });
      }
    });

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router3.post("/:id/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    const idx = post.likes.findIndex(
      (l) => l.toString() === req.user._id.toString()
    );
    if (idx === -1) post.likes.push(req.user._id);
    else post.likes.splice(idx, 1);
    await post.save();
    res.json({ likes: post.likes.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router3.post(
  "/:id/comment",
  auth,
  [body("text").notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ error: "Post not found" });
      post.comments.push({ user: req.user._id, text: req.body.text });
      await post.save();
      res.json(post.comments);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router3;
