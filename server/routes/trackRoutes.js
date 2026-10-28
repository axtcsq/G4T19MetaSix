import { Router } from "express";

import { addSoundMoods, getTrackMoods } from "../controller/trackController.js";

const router = Router();

router.get("/moods", getTrackMoods);
router.post("/moods/sound", addSoundMoods);

export default router;
