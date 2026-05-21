import { Router, Request, Response } from "express";
import {
    deleteCurrentUserAccount,
    getAvailableArtists,
    getAvailableGenres,
    getSafeUserById,
    loginUser,
    registerUser,
    updateCurrentUserProfile
} from "../../../domain/authentication/authService";

const router = Router();

type SessionWithUserId = Request["session"] & {
    userId?: string;
};

function saveSession(session: SessionWithUserId): Promise<void> {
    return new Promise((resolve, reject) => {
        session.save((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

router.get("/genres", (_req: Request, res: Response) => {
    res.json(getAvailableGenres());
});

router.get("/artists", async (_req: Request, res: Response) => {
    try {
        res.json(await getAvailableArtists());
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Could not load artists.";
        res.status(500).json({ message });
    }
});

router.get("/me", async (req: Request, res: Response) => {

    const session = req.session as SessionWithUserId;
    const userId = session.userId;

    if (!userId) {
        return res.status(401).json({ message: "Not logged in." });
    }

    const user = await getSafeUserById(userId);
  
    if (!user) {
        req.session.destroy(() => { });
        return res.status(401).json({ message: "Session is invalid." });
    }

    return res.json(user);
});

router.patch("/me", async (req: Request, res: Response) => {
    try {
        const session = req.session as SessionWithUserId;
        const userId = session.userId;

        if (!userId) {
            return res.status(401).json({ message: "Not logged in." });
        }

        const user = await updateCurrentUserProfile(userId, req.body);
        return res.json(user);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Profile update failed.";
        return res.status(400).json({ message });
    }
});

router.post("/signup", async (req: Request, res: Response) => {
    try {
        const user = await registerUser(req.body);
        const session = req.session as SessionWithUserId;
        session.userId = user.id;
        await saveSession(session);
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
        await saveSession(session);
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

router.delete("/me", async (req: Request, res: Response) => {
    try {
        const session = req.session as SessionWithUserId;
        const userId = session.userId;

        if (!userId) {
            return res.status(401).json({ message: "Not logged in." });
        }

        await deleteCurrentUserAccount(userId);

        req.session.destroy((error) => {
            if (error) {
                return res.status(500).json({ message: "Account deleted, but logout failed." });
            }

            res.clearCookie("connect.sid");
            return res.json({ message: "Account deleted successfully." });
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Account deletion failed.";
        return res.status(400).json({ message });
    }
});

export default router;
