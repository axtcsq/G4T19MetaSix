import { Router } from "express";

import { getListens } from "../controller/listenController.js";

const router = Router();

router.get("/", getListens);

export default router;
