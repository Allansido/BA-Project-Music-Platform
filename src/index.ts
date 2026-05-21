
import "dotenv/config";
import app from "./presentation/server/app";
import { initAnalyticsStore } from "./domain/analytics/analyticsService";
import { initUserStore } from "./domain/authentication/userStore";
import { warmRecommendationIndex } from "./domain/recommendation_management/recommendationService";

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

initAnalyticsStore().catch((error) => {
    logDatabaseStartupError(error);
});

warmRecommendationIndex()
    .then((index) => {
        console.log(
            `Recommendation index warmed with ${index.popularArtistEntries.length} artists and ${index.popularTrackEntries.length} tracks.`
        );
    })
    .catch((error) => {
        console.warn("Failed to warm recommendation index.", error);
    });
