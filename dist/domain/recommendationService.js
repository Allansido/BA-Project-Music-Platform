"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendationsForUser = getRecommendationsForUser;
const fs_1 = __importDefault(require("fs"));
const baselineRecommender_1 = require("../data/recommendation_modules/baselineRecommender");
const INTERACTIONS_PATH = "dataset/processed/interactions.json";
function loadInteractions() {
    return JSON.parse(fs_1.default.readFileSync(INTERACTIONS_PATH, "utf8"));
}
function getRecommendationsForUser(userId, limit = 10) {
    const interactions = loadInteractions();
    return (0, baselineRecommender_1.getBaselineRecommendations)(interactions, userId, limit);
}
