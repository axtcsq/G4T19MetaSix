import { Router } from "express";

import {
  callback,
  login,
  logout,
} from "../controller/authController.js";

const router = Router();

router.get("/login", login);
router.get("/callback", callback);
router.post("/logout", logout);

export default router;
