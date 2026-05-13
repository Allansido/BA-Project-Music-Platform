import { Request, Response } from "express";
import { getAnalyticsMetrics, logInteraction } from "../../domain/analytics/analyticsService";

type SessionWithUserId = Request["session"] & {
    userId?: string;
};

export async function createInteractionLog(req: Request, res: Response) {
    try {
        const session = req.session as SessionWithUserId;
        const event = await logInteraction(req.body, session.userId);

        return res.status(201).json(event);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Could not log interaction.";

        return res.status(400).json({ message });
    }
}

export async function getInteractionMetrics(_req: Request, res: Response) {
    try {
        const metrics = await getAnalyticsMetrics();

        return res.json(metrics);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Could not load analytics.";

        return res.status(500).json({ message });
    }
}
