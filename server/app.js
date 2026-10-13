import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import moodRoutes from "./routes/moodRoutes.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(",") || "http://localhost:5173",
  }),
);

app.use(express.json({ limit: "20kb" }));

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
    console.error("[API] Health check failed because MongoDB is unavailable:", error.message);
    res.status(503).json({
      status: "degraded",
      message: "MetaFor API is running, but MongoDB is unavailable",
      database: "disconnected",
    });
  }
});

// Connect to MongoDB before database requests
app.use("/api/moods", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("[API] Mood request unavailable because MongoDB is not connected:", error.message);
    res.status(503).json({ error: "Database unavailable" });
  }
});

// Mood routes
app.use("/api/moods", moodRoutes);

// Unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Centralized error handler
app.use((error, req, res, next) => {
  console.error(error);

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
