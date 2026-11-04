import { Router } from "express";

import { getListens, getMoodInsights, getOverallMood } from "../controller/listenController.js";

const router = Router();

router.get("/", getListens);
router.get("/insights", getMoodInsights);
router.get("/overall-mood", getOverallMood);

export default router;
