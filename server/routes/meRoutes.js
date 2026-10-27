import { Router } from "express";

import { getMe, updateSettings } from "../controller/authController.js";
import { requireUser } from "../middleware/requireUser.js";

const router = Router();

router.get("/", requireUser, getMe);
router.patch("/settings", requireUser, updateSettings);

export default router;
