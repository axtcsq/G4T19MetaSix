import { Router } from "express";

import {
  callback,
  demoLogin,
  login,
  logout,
} from "../controller/authController.js";

const router = Router();

router.get("/login", login);
router.get("/callback", callback);
router.post("/demo", demoLogin);
router.post("/logout", logout);

export default router;
