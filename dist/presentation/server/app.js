"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const session_1 = require("./session");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const app = (0, express_1.default)();
const allowedOrigins = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]);
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error("Not allowed by CORS."));
    },
    credentials: true
}));
app.use(express_1.default.json());
app.use(session_1.sessionMiddleware);
app.get("/api/health", (_req, res) => {
    res.json({ message: "Backend is running." });
});
app.use("/api/auth", authRoutes_1.default);
exports.default = app;
