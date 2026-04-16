import session from "express-session";

export const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET ?? "dev-secret-change-this-later",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
});
