import { Router } from "express";

import { getSpotifyToken } from "../controller/spotifyController.js";

const router = Router();

router.get("/token", getSpotifyToken);

export default router;
