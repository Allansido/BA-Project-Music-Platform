import { Router } from "express";
import {
    createInteractionLog,
    getInteractionMetrics
} from "../controllers/analyticsController";

const router = Router();

router.post("/events", createInteractionLog);
router.get("/metrics", getInteractionMetrics);

export default router;
