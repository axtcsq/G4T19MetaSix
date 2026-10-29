import { Router } from "express";

import { getSongAnalysis, searchSongs } from "../controller/songController.js";

const router = Router();

router.get("/search", searchSongs);
router.get("/:id/analysis", getSongAnalysis);

export default router;
