import { Router } from "express";

import { getTrackMoods } from "../controller/trackController.js";

const router = Router();

router.get("/moods", getTrackMoods);

export default router;
