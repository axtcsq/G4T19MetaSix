import mongoose from "mongoose";

let connectionPromise;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from environment variables");
  }

  connectionPromise = mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      // Indexes are created by scripts/db-init.js, not on every startup.
      autoIndex: false,
    })
    .then(() => {
      console.log(`[MongoDB] Connected to ${mongoose.connection.name} on ${mongoose.connection.host}`);
      return mongoose.connection;
    })
    .catch((error) => {
      console.error("[MongoDB] Connection failed:", error.message);
      throw error;
    })
    .finally(() => {
      connectionPromise = undefined;
    });

  return connectionPromise;
}
