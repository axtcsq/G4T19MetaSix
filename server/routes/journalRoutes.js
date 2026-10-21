import { Router } from "express";
import { generateJournalIdea } from "../controller/journalController.js";

const router = Router();

router.post("/ideas", generateJournalIdea);

export default router;
