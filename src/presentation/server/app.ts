import express from "express";
import cors from "cors";
import { sessionMiddleware } from "./session";
import authRoutes from "./routes/authRoutes";
import recommendationRoutes from "../routes/recommendationRoutes";

const app = express();

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true
    })
);

app.use(express.json());
app.use(sessionMiddleware);

app.get("/api/health", (_req, res) => {
    res.json({ message: "Backend is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/recommendations", recommendationRoutes);

export default app;