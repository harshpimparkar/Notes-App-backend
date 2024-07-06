import express, { query } from "express";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import User from "./models/user.models.js";
import Note from "./models/note.models.js";
import authenticateToken from "./utilities.js";

dotenv.config();
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);
//port
const port = process.env.port;
//mongo connection
try {
  mongoose.connect(process.env.MONGO_URL);
  console.log("Connected to database");
} catch (e) {
  console.log(e.message);
}

//Trial
app.get("/", (req, res) => {
  res.json({ data: "Hello" });
});

//Create Account
app.post("/create-account", async (req, res) => {
  const { fullname, email, username, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: true, message: "email required." });
  }
  if (!username) {
    return res.status(400).json({ error: true, message: "username required." });
  }
  if (!password) {
    return res.status(400).json({ error: true, message: "password required." });
  }

  const isUser = await User.findOne({ email: email });
  if (isUser) {
    return res.json({
      error: true,
      message: "User already exists.",
    });
  }
  const salt = bcryptjs.genSalt(10);
  const hashedPassword = bcryptjs.hash({password}, salt);

  const user = new User({
    fullname,
    email,
    username,
    hashedPassword,
  });

  await user.save();

  const accessToken = jwt.sign({ user }, process.env.JWT_TOKEN, {
    expiresIn: "36000m",
  });

  return res.json({
    error: false,
    user,
    accessToken,
    message: "Registration Successful",
  });
});
//Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ error: true, message: "username required." });
  }
  if (!password) {
    return res.status(400).json({ error: true, message: "password required." });
  }
  const userInfo = await User.findOne({ username: username });
  if (!userInfo) {
    return res.status(400).json({
      message: "User does not exists.",
    });
  }
  const checkPassword = bcryptjs.compare(password, userInfo.password);
  if (userInfo.username == username && checkPassword) {
    const user = { user: userInfo };
    const accessToken = jwt.sign(user, process.env.JWT_TOKEN, {
      expiresIn: "36000m",
    });

    return res.json({
      error: false,
      message: "Login Successful",
      username,
      accessToken,
    });
  } else {
    return res.status(400).json({
      error: true,
      message: "Invalid credentials",
    });
  }
});
//Logout
app.delete("/logout/:userId", authenticateToken, async (req, res) => {
  const userId = req.params.userId;

  try {
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({
        error: true,
        message: "User does not exist.",
      });
    }

    await user.deleteOne({ _id: userId });
    return res.json({
      error: false,
      message: "Logged out successfully.",
    });
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error.",
    });
  }
});
//Get User
app.get("/get-user", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const isUser = await User.findOne({ _id: user._id });
  if (!isUser) {
    return res
      .sendStatus(401)
      .json({ error: true, message: "User does not exist." });
  }

  return res.json({
    user: {
      fullname: isUser.fullname,
      username: isUser.username,
      email: isUser.email,
      password: isUser.password,
      _id: isUser._id,
      createdOn: isUser.createdOn,
    },
    message: "User found.",
  });
});
//Add Note
app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;
  const { user } = req.user;
  if (!title) {
    return res.status(400).json({ error: true, message: "Title is required." });
  }
  if (!content) {
    return res
      .status(400)
      .json({ error: true, message: "Content is required" });
  }

  try {
    const note = new Note({
      title,
      content,
      tags: tags || [],
      userId: user._id,
    });
    await note.save();
    return res.json({
      error: false,
      note,
      message: "Note added successfully",
    });
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: "Internal server error.",
    });
  }
});
//Edit Note
app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { title, content, tags, isPinned } = req.body;
  const { user } = req.user;
  if (!title && !content && !tags) {
    return res.status(400).json({
      error: true,
      message: "No changes provided.",
    });
  }

  try {
    const note = await Note.findOne({ _id: noteId, userId: user._id });
    if (!note) {
      return res.status(404).json({
        error: true,
        message: "Note does not exist.",
      });
    }
    if (title) note.title = title;
    if (content) note.content = content;
    if (tags) note.tags = tags;
    if (isPinned) note.isPinned = isPinned;

    await note.save();
    return res.json({
      error: false,
      note,
      message: "Note updated successfully.",
    });
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error.",
    });
  }
});
//Get All Notes
app.get("/get-all-notes/", authenticateToken, async (req, res) => {
  const { user } = req.user;
  try {
    const notes = await Note.find({ userId: user._id }).sort({ isPinned: -1 });

    return res.json({
      error: false,
      notes,
      message: "All notes retrieved successfully.",
    });
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error.",
    });
  }
});
//Delete a Note
app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { user } = req.user;

  try {
    const note = await Note.findOne({ _id: noteId, userId: user._id });
    if (!note) {
      return res.status(404).json({
        error: true,
        message: "Note does not exist.",
      });
    }

    await note.deleteOne({ _id: noteId, userId: user._id });
    return res.json({
      error: false,
      message: "Note deleted successfully.",
    });
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error.",
    });
  }
});
//Pin a Note
app.put("/pin-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { isPinned } = req.body;
  const { user } = req.user;

  try {
    const note = await Note.findOne({ _id: noteId, userId: user._id });
    if (!note) {
      return res.send(404).json({
        error: true,
        message: "Note does not exist.",
      });
    }
    note.isPinned = isPinned;

    await note.save();
    return res.json({
      error: false,
      note,
      message: "Note is Pinned.",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error.",
    });
  }
});
//Search a Note
app.get("/search-notes/", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({
      error: true,
      message: "Search query is required.",
    });
  }
  try {
    const matchingNotes = await Note.find({
      userId: user._id,
      $or: [
        { title: { $regex: new RegExp(query, "i") } },
        { content: { $regex: new RegExp(query, "i") } },
      ],
    });

    return res.json({
      error: false,
      notes: matchingNotes,
      message: "Notes matching the search query retrieved successfully.",
    });
  } catch (error) {
    return res.send(500).json({
      error: true,
      message: "Internal server error.",
    });
  }
});
app.listen(port, console.log(`Listening on port: ${port}`));

export default app;
