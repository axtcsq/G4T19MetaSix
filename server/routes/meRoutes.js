import { Router } from "express";

import { getMe } from "../controller/authController.js";
import { requireUser } from "../middleware/requireUser.js";

const router = Router();

router.get("/", requireUser, getMe);

export default router;
