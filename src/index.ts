
import "dotenv/config";
import app from "./presentation/server/app";
import { initUserStore } from "./domain/auth/userStore";

const port = process.env.PORT ?? 3000;

function logDatabaseStartupError(error: unknown): void {
    console.error("Failed to initialize database.", error);

    if (
        error instanceof Error &&
        /password authentication failed/.test(error.message)
    ) {
        console.error(
            [
                "The app reached a PostgreSQL server, but the credentials were rejected.",
                "For the Docker database, make sure Docker Desktop is installed and running, then run:",
                "  npm run db:up",
                "The default project database URL is:",
                "  postgres://music_platform:music_platform@localhost:5433/music_platform"
            ].join("\n")
        );
    }
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Let the API start even if the database is temporarily unavailable so
// static signup data, health checks, and non-database routes can still work.
initUserStore().catch((error) => {
    logDatabaseStartupError(error);
});
