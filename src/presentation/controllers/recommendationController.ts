import { Request, Response } from "express";
import { getRecommendationsForUser } from "../../domain/recommendationService";

export async function getRecommendations(req: Request, res: Response) {
    const session = req.session as Request["session"] & { userId?: string };

    if (!session.userId) {
        return res.status(401).json({ message: "Not logged in." });
    }

    try {
        const recommendations = await getRecommendationsForUser(session.userId, 10);
        return res.json(recommendations);
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Could not load recommendations.";
        return res.status(500).json({ message });
    }
}
