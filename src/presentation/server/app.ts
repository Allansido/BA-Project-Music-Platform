import express from "express";
import cors from "cors";
import { sessionMiddleware } from "./session";
import authRoutes from "./routes/authRoutes";
import analyticsRoutes from "../routes/analyticsRoutes";
import recommendationRoutes from "../routes/recommendationRoutes";

const app = express();
const allowedOrigins = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]);
app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.has(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error("Not allowed by CORS."));
        },
        credentials: true
    })
);

app.use(express.json());
app.use(sessionMiddleware);

app.get("/api/health", (_req, res) => {
    res.json({ message: "Backend is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/recommendations", recommendationRoutes);

export default app;
