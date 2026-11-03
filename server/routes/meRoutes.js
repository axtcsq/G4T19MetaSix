import { Router } from "express";

import { clearHistory, disconnectSpotify, exportData } from "../controller/accountController.js";
import { getMe, updateSettings } from "../controller/authController.js";
import { getDailyMetaphor } from "../controller/metaphorController.js";
import { requireUser } from "../middleware/requireUser.js";

const router = Router();

router.get("/", requireUser, getMe);
router.patch("/settings", requireUser, updateSettings);
router.get("/export", requireUser, exportData);
router.delete("/history", requireUser, clearHistory);
router.post("/spotify/disconnect", requireUser, disconnectSpotify);
router.get("/metaphor", requireUser, getDailyMetaphor);

export default router;
