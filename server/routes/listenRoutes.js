import { Router } from "express";

import { getListens, getMoodInsights } from "../controller/listenController.js";

const router = Router();

router.get("/", getListens);
router.get("/insights", getMoodInsights);

export default router;
