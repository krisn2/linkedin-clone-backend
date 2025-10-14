const { Schema, model: createModel } = require("mongoose");

const MediaSchema = new Schema({
  type: { type: String, enum: ["image", "video"], required: true },
  url: { type: String, required: true },
});

const PostSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, trim: true, maxLength: 5000 },
    media: [MediaSchema],
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        text: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = createModel("Post", PostSchema);
