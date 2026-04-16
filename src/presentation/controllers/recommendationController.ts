import { Request, Response } from "express";
import { getRecommendationsForUser } from "../../domain/recommendationService";

export function getRecommendations(req: Request, res: Response) {
    const session = req.session as Request["session"] & { userId?: string };

    if (!session.userId) {
        return res.status(401).json({ message: "Not logged in." });
    }

    const recommendations = getRecommendationsForUser(session.userId, 10);
    return res.json(recommendations);
}