"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authService_1 = require("../../../domain/auth/authService");
const router = (0, express_1.Router)();
router.get("/genres", (_req, res) => {
    res.json((0, authService_1.getAvailableGenres)());
});
router.get("/artists", async (_req, res) => {
    try {
        res.json(await (0, authService_1.getAvailableArtists)());
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not load artists.";
        res.status(500).json({ message });
    }
});
router.get("/me", async (req, res) => {
    const session = req.session;
    const userId = session.userId;
    if (!userId) {
        return res.status(401).json({ message: "Not logged in." });
    }
    const user = await (0, authService_1.getSafeUserById)(userId);
    if (!user) {
        req.session.destroy(() => { });
        return res.status(401).json({ message: "Session is invalid." });
    }
    return res.json(user);
});
router.post("/signup", async (req, res) => {
    try {
        const user = await (0, authService_1.registerUser)(req.body);
        const session = req.session;
        session.userId = user.id;
        return res.status(201).json(user);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Signup failed.";
        return res.status(400).json({ message });
    }
});
router.post("/login", async (req, res) => {
    try {
        const user = await (0, authService_1.loginUser)(req.body);
        const session = req.session;
        session.userId = user.id;
        return res.json(user);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Login failed.";
        return res.status(400).json({ message });
    }
});
router.post("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({ message: "Logout failed." });
        }
        res.clearCookie("connect.sid");
        return res.json({ message: "Logged out successfully." });
    });
});
exports.default = router;
