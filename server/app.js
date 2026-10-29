import express from "express";
import session from "express-session";
import cors from "cors";
import { connectDB } from "./config/db.js";
import MongoStore from "connect-mongo";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import listenRoutes from "./routes/listenRoutes.js";
import meRoutes from "./routes/meRoutes.js";
import { requireUser } from "./middleware/requireUser.js";
import moodRoutes from "./routes/moodRoutes.js";
import journalRoutes from "./routes/journalRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import songRoutes from "./routes/songRoutes.js";
import spotifyRoutes from "./routes/spotifyRoutes.js";
import syncRoutes from "./routes/syncRoutes.js";
import trackRoutes from "./routes/trackRoutes.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const app = express();

// Vercel sits in front of the server, so trust its proxy for secure cookies.
app.set("trust proxy", 1);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(",") || "http://localhost:5173",
  }),
);

// Journal drawings are stored as vector data, so allow a larger JSON body.
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", async (req, res) => {
  try {
    await connectDB();
    res.json({
      status: "ok",
      message: "MetaFor API is running",
      database: "connected",
    });
  } catch (error) {
    console.error(
      "[API] Health check failed because MongoDB is unavailable:",
      error.message,
    );
    res.status(503).json({
      status: "degraded",
      message: "MetaFor API is running, but MongoDB is unavailable",
      database: "disconnected",
    });
  }
});

// Every other /api route needs MongoDB, including the session store below.
app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error(
      "[API] Request unavailable because MongoDB is not connected:",
      error.message,
    );
    res.status(503).json({ error: "Database unavailable" });
  }
});

// The session store shares Mongoose's connection once it opens.
function sessionClient() {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection.getClient());
  }
  return new Promise((resolve) => {
    mongoose.connection.once("connected", () =>
      resolve(mongoose.connection.getClient()),
    );
  });
}

// Login sessions, kept in the sessions collection for 30 days.
app.use(
  "/api",
  session({
    name: "metafor.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      clientPromise: sessionClient(),
      collectionName: "sessions",
      ttl: THIRTY_DAYS_MS / 1000,
      touchAfter: 24 * 60 * 60,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: THIRTY_DAYS_MS,
    },
  }),
);

// Connect to MongoDB before database requests
app.use("/api/moods", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error(
      "[API] Mood request unavailable because MongoDB is not connected:",
      error.message,
    );
    res.status(503).json({ error: "Database unavailable" });
  }
});

// Login and account routes
app.use("/api/auth", authRoutes);
app.use("/api/me", meRoutes);
app.use("/api/spotify", requireUser, spotifyRoutes);

// Listening history, from the listens collection
app.use("/api/listens", requireUser, listenRoutes);
app.use("/api/sync", requireUser, syncRoutes);
// Stored song moods, for the mood tags
app.use("/api/tracks", requireUser, trackRoutes);

// Song search and analysis. Public, so the landing page can use it.
app.use("/api/songs", songRoutes);

// Mood routes
app.use("/api/moods", requireUser, moodRoutes);
app.use("/api/journal", requireUser, journalRoutes);

// Connect to MongoDB before quiz requests
app.use("/api/quiz", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error(
      "[API] Quiz request unavailable because MongoDB is not connected:",
      error.message,
    );
    res.status(503).json({ error: "Database unavailable" });
  }
});

// Personality quiz routes
app.use("/api/quiz", requireUser, quizRoutes);

// Unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Centralized error handler
app.use((error, req, res, next) => {
  console.error(error);

  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation failed",
    });
  }

  res.status(500).json({
    error: "Internal server error",
  });
});

export default app;
