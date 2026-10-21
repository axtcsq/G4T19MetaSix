import { Router } from "express";

import { syncNow } from "../controller/syncController.js";

const router = Router();

router.post("/", syncNow);

export default router;
