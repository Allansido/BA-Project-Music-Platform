import fs from "fs";
import { Interaction } from "../data/dataset_modules/lastfmLoader";
import {
    BaselineRecommendationResult,
    getBaselineRecommendations
} from "../data/recommendation_modules/baselineRecommender";

const INTERACTIONS_PATH = "dataset/processed/interactions.json";

function loadInteractions(): Interaction[] {
    return JSON.parse(
        fs.readFileSync(INTERACTIONS_PATH, "utf8")
    ) as Interaction[];
}

export function getRecommendationsForUser(
    userId: string,
    limit = 10
): BaselineRecommendationResult {
    const interactions = loadInteractions();
    return getBaselineRecommendations(interactions, userId, limit);
}
