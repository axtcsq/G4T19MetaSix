import { Router } from "express";

import {
  createMood,
  getMoods,
  getMood,
  updateMood,
  deleteMood,
} from "../controller/moodController.js";

const router = Router();

router.post("/", createMood);
router.get("/", getMoods);
router.get("/:id", getMood);
router.patch("/:id", updateMood);
router.delete("/:id", deleteMood);

export default router;
