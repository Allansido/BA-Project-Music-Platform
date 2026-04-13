import { Router, Request, Response } from "express";
import {
    getAvailableGenres,
    getSafeUserById,
    loginUser,
    registerUser
} from "../../../domain/auth/authService";

const router = Router();

type SessionWithUserId = Request["session"] & {
    userId?: string;
};

router.get("/genres", (_req: Request, res: Response) => {
    res.json(getAvailableGenres());
});

router.get("/me", (req: Request, res: Response) => {
    const session = req.session as SessionWithUserId;
    const userId = session.userId;

    if (!userId) {
        return res.status(401).json({ message: "Not logged in." });
    }

    const user = getSafeUserById(userId);

    if (!user) {
        req.session.destroy(() => { });
        return res.status(401).json({ message: "Session is invalid." });
    }

    return res.json(user);
});

router.post("/signup", async (req: Request, res: Response) => {
    try {
        const user = await registerUser(req.body);
        const session = req.session as SessionWithUserId;
        session.userId = user.id;
        return res.status(201).json(user);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Signup failed.";
        return res.status(400).json({ message });
    }
});

router.post("/login", async (req: Request, res: Response) => {
    try {
        const user = await loginUser(req.body);
        const session = req.session as SessionWithUserId;
        session.userId = user.id;
        return res.json(user);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Login failed.";
        return res.status(400).json({ message });
    }
});

router.post("/logout", (req: Request, res: Response) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({ message: "Logout failed." });
        }

        res.clearCookie("connect.sid");
        return res.json({ message: "Logged out successfully." });
    });
});

export default router;