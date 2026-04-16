import { Router } from "express";
import { getRecommendations } from "../controllers/recommendationController";

const router = Router();

router.get("/", getRecommendations);

export default router;
