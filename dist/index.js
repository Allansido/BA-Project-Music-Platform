"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = __importDefault(require("./presentation/server/app"));
const userStore_1 = require("./domain/auth/userStore");
const port = process.env.PORT ?? 3000;
function logDatabaseStartupError(error) {
    console.error("Failed to initialize database.", error);
    if (error instanceof Error &&
        /password authentication failed/.test(error.message)) {
        console.error([
            "The app reached a PostgreSQL server, but the credentials were rejected.",
            "For the Docker database, make sure Docker Desktop is installed and running, then run:",
            "  npm run db:up",
            "The default project database URL is:",
            "  postgres://music_platform:music_platform@localhost:5433/music_platform"
        ].join("\n"));
    }
}
(0, userStore_1.initUserStore)()
    .then(() => {
    app_1.default.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
})
    .catch((error) => {
    logDatabaseStartupError(error);
    process.exit(1);
});
