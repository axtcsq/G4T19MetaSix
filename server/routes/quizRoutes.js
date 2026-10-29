import { Router } from "express";

import {
  getLatestResult,
  getMoodMusic,
  getGenreMix,
  getPersonality,
  getQuiz,
  getQuizzes,
  submitQuiz,
} from "../controller/quizController.js";

const router = Router();

router.get("/", getQuizzes);
router.get("/personality", getPersonality);
router.get("/mood-music", getMoodMusic);
router.get("/genre-mix", getGenreMix);
router.get("/:quizId", getQuiz);
router.get("/:quizId/result", getLatestResult);
router.post("/:quizId/result", submitQuiz);

export default router;
