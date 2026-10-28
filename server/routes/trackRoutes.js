import { Router } from "express";

import { addSoundMoods, getTrackDetail, getTrackMoods } from "../controller/trackController.js";

const router = Router();

router.get("/moods", getTrackMoods);
router.post("/moods/sound", addSoundMoods);
// After the /moods routes, so "moods" isn't read as a track ID.
router.get("/:id", getTrackDetail);

export default router;
