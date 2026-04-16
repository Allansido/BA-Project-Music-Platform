"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendations = getRecommendations;
const recommendationService_1 = require("../../domain/recommendationService");
function getRecommendations(req, res) {
    const session = req.session;
    if (!session.userId) {
        return res.status(401).json({ message: "Not logged in." });
    }
    const recommendations = (0, recommendationService_1.getRecommendationsForUser)(session.userId, 10);
    return res.json(recommendations);
}
