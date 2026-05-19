import { Request, Response } from "express";
import { getRecommendationsForUser } from "../../domain/recommendationService";

const RECOMMENDATION_LIMIT = 20;

export async function getRecommendations(req: Request, res: Response) {
    const session = req.session as Request["session"] & { userId?: string };

    if (!session.userId) {
        return res.status(401).json({ message: "Not logged in." });
    }

    try {
        const recommendations = await getRecommendationsForUser(
            session.userId,
            RECOMMENDATION_LIMIT
        );
        return res.json(recommendations);
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Could not load recommendations.";
        return res.status(500).json({ message });
    }
}
