import fs from "fs";
import readline from "readline";
import { Interaction } from "../data/dataset_modules/lastfmLoader";
import {
    BaselineRecommendationResult,
    getBaselineRecommendations
} from "../data/recommendation_modules/baselineRecommender";
import { getSafeUserById } from "./auth/authService";

const INTERACTIONS_PATH = "dataset/processed/interactions.json";

let cachedInteractions: Interaction[] | null = null;
let cachedInteractionsPromise: Promise<Interaction[]> | null = null;

function parseInteractionLine(line: string): Interaction | null {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine === "[" || trimmedLine === "]") {
        return null;
    }

    const normalizedLine = trimmedLine.endsWith(",")
        ? trimmedLine.slice(0, -1)
        : trimmedLine;

    return JSON.parse(normalizedLine) as Interaction;
}

async function loadInteractionsFromStream(): Promise<Interaction[]> {
    if (!fs.existsSync(INTERACTIONS_PATH)) {
        return [];
    }

    const interactions: Interaction[] = [];
    const stream = fs.createReadStream(INTERACTIONS_PATH, { encoding: "utf8" });
    const lineReader = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    for await (const line of lineReader) {
        const interaction = parseInteractionLine(line);

        if (interaction) {
            interactions.push(interaction);
        }
    }

    return interactions;
}

async function loadInteractions(): Promise<Interaction[]> {
    if (!fs.existsSync(INTERACTIONS_PATH)) {
        return [];
    }

    const rawInteractions = await fs.promises.readFile(INTERACTIONS_PATH, "utf8");
    const parsedInteractions = JSON.parse(rawInteractions);

    return Array.isArray(parsedInteractions)
        ? (parsedInteractions as Interaction[])
        : [];
}

export async function getRecommendationsForUser(
    userId: string,
    limit = 10
): Promise<BaselineRecommendationResult> {
    const user = await getSafeUserById(userId);

    if (!user) {
        throw new Error("Could not load the signed-in user profile.");
    }

    cachedInteractionsPromise ??= loadInteractionsFromStream()
        .catch(() => loadInteractions())
        .then((interactions) => {
            cachedInteractions = interactions;
            return interactions;
        })
        .finally(() => {
            cachedInteractionsPromise = null;
        });

    const interactions = cachedInteractions ?? (await cachedInteractionsPromise);
    return getBaselineRecommendations(interactions, user, limit);
}
