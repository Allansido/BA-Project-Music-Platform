import type {
    AnalyticsMetrics,
    InteractionEvent,
    InteractionLogPayload
} from "../types/analytics";
import { ANALYTICS_API_BASE_URL } from "./config";

async function handleResponse<T>(response: Response): Promise<T> {
    const responseText = await response.text();
    let data: unknown = null;

    try {
        data = responseText ? JSON.parse(responseText) : null;
    } catch {
        if (!response.ok) {
            throw new Error("The analytics server returned an invalid response.");
        }

        throw new Error("Could not read analytics response.");
    }

    if (!response.ok) {
        const message =
            data &&
            typeof data === "object" &&
            "message" in data &&
            typeof data.message === "string"
                ? data.message
                : "Something went wrong.";
        throw new Error(message);
    }

    return data as T;
}

export async function logInteraction(
    payload: InteractionLogPayload
): Promise<InteractionEvent> {
    const response = await fetch(`${ANALYTICS_API_BASE_URL}/events`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    return handleResponse<InteractionEvent>(response);
}

export async function getAnalyticsMetrics(): Promise<AnalyticsMetrics> {
    const response = await fetch(`${ANALYTICS_API_BASE_URL}/metrics`, {
        credentials: "include"
    });

    return handleResponse<AnalyticsMetrics>(response);
}

export function trackInteraction(payload: InteractionLogPayload): void {
    logInteraction(payload).catch(() => {
        // Interaction logging should never block the listening flow.
    });
}
