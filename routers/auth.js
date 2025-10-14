const express = require("express");
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/User");

const router = express.Router();

router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const { name, email, password } = req.body;
    try {
      let user = await UserModel.findOne({ email });
      if (user) return res.status(400).json({ error: "Email already in use" });
      user = new UserModel({ name, email, password });
      await user.save();
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "7d" }
      );
      res.json({
        token,
        user: { id: user._id, name: user.name, email: user.email },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").exists().withMessage("Password required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    try {
      const user = await UserModel.findOne({ email });
      if (!user) return res.status(400).json({ error: "Invalid credentials" });
      const isMatch = await user.comparePassword(password);
      if (!isMatch)
        return res.status(400).json({ error: "Invalid credentials" });
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "7d" }
      );
      res.json({
        token,
        user: { id: user._id, name: user.name, email: user.email },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;
