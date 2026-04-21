import type { RecommendationResult } from "../types/recommendations";
import { RECOMMENDATION_API_BASE_URL } from "./config";

async function handleResponse<T>(response: Response): Promise<T> {
    const responseText = await response.text();
    let data: unknown = null;

    try {
        data = responseText ? JSON.parse(responseText) : null;
    } catch {
        if (!response.ok) {
            throw new Error("The recommendations server returned an invalid response.");
        }

        throw new Error("Could not read recommendations.");
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

export async function getRecommendations(): Promise<RecommendationResult> {
    const response = await fetch(RECOMMENDATION_API_BASE_URL, {
        credentials: "include"
    });

    return handleResponse<RecommendationResult>(response);
}
