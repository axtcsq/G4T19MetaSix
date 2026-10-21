import { Router } from "express";

import {
  callback,
  demoLogin,
  demoStatus,
  login,
  logout,
} from "../controller/authController.js";

const router = Router();

router.get("/login", login);
router.get("/callback", callback);
router.get("/demo", demoStatus);
router.post("/demo", demoLogin);
router.post("/logout", logout);

export default router;
