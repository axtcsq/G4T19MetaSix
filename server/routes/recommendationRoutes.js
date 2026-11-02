import { Router } from "express";

import { getRecommendations } from "../controller/recommendationController.js";

const router = Router();

router.post("/", getRecommendations);

export default router;
