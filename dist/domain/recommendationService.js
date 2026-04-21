"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendationsForUser = getRecommendationsForUser;
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
const baselineRecommender_1 = require("../data/recommendation_modules/baselineRecommender");
const authService_1 = require("./auth/authService");
const INTERACTIONS_PATH = "dataset/processed/interactions.json";
let cachedInteractions = null;
let cachedInteractionsPromise = null;
function parseInteractionLine(line) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine === "[" || trimmedLine === "]") {
        return null;
    }
    const normalizedLine = trimmedLine.endsWith(",")
        ? trimmedLine.slice(0, -1)
        : trimmedLine;
    return JSON.parse(normalizedLine);
}
async function loadInteractionsFromStream() {
    if (!fs_1.default.existsSync(INTERACTIONS_PATH)) {
        return [];
    }
    const interactions = [];
    const stream = fs_1.default.createReadStream(INTERACTIONS_PATH, { encoding: "utf8" });
    const lineReader = readline_1.default.createInterface({
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
async function loadInteractions() {
    if (!fs_1.default.existsSync(INTERACTIONS_PATH)) {
        return [];
    }
    const rawInteractions = await fs_1.default.promises.readFile(INTERACTIONS_PATH, "utf8");
    const parsedInteractions = JSON.parse(rawInteractions);
    return Array.isArray(parsedInteractions)
        ? parsedInteractions
        : [];
}
async function getRecommendationsForUser(userId, limit = 10) {
    const user = await (0, authService_1.getSafeUserById)(userId);
    if (!user) {
        throw new Error("Could not load the signed-in user profile.");
    }
    cachedInteractionsPromise ?? (cachedInteractionsPromise = loadInteractionsFromStream()
        .catch(() => loadInteractions())
        .then((interactions) => {
        cachedInteractions = interactions;
        return interactions;
    })
        .finally(() => {
        cachedInteractionsPromise = null;
    }));
    const interactions = cachedInteractions ?? (await cachedInteractionsPromise);
    return (0, baselineRecommender_1.getBaselineRecommendations)(interactions, user, limit);
}
