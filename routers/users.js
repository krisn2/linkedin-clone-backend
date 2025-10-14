const express2 = require("express");
const { body, validationResult } = require("express-validator");
const upload = require("../middleware/upload");
const { authenticate } = require("../middleware/auth");
const User = require("../models/User");
const path2 = require('path');
const fs2 = require('fs');

const router2 = express2.Router();

router2.get("/me", authenticate, async (req, res) => {
  res.json(req.user);
});

router2.put(
  "/me",
  authenticate,
  upload.single("avatar"),
  [
    body("name").optional().notEmpty(),
    body("headline").optional(),
    body("bio").optional(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    try {
      const updates = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.headline) updates.headline = req.body.headline;
      if (req.body.bio) updates.bio = req.body.bio;
      if (req.file) updates.avatar = `/uploads/${req.file.filename}`;

      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (req.file && user.avatar) {
        const oldPath = path2.join(__dirname, "..", user.avatar);
        fs2.unlink(oldPath, (err) => {
          if (err) console.warn("Old avatar not deleted:", err.message);
        });
      }

      Object.assign(user, updates);
      await user.save();

      res.json({ message: "Profile updated", user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

router2.delete("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.avatar) {
      const avatarPath = path2.join(__dirname, "..", user.avatar);
      fs2.unlink(avatarPath, (err) => {
        if (err) console.warn("Failed to delete avatar:", err.message);
      });
    }

    await User.findByIdAndDelete(req.user._id);
    res.json({ message: "Account deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
module.exports = router2;
