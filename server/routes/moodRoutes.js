import { Router } from "express";

import {
  createMood,
  getMoods,
  getMood,
  getMoodPhoto,
  getStreak,
  updateMood,
  deleteMood,
} from "../controller/moodController.js";

const router = Router();

router.post("/", createMood);
router.get("/", getMoods);
// Before /:id, so "streak" isn't read as an entry's id.
router.get("/streak", getStreak);
router.get("/:id", getMood);
router.get("/:id/photo", getMoodPhoto);
router.patch("/:id", updateMood);
router.delete("/:id", deleteMood);

export default router;
