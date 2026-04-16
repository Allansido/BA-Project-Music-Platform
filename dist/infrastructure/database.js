"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.closeDatabasePool = closeDatabasePool;
const pg_1 = require("pg");
const DEFAULT_DATABASE_URL = "postgres://music_platform:music_platform@localhost:5433/music_platform";
exports.pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
});
async function closeDatabasePool() {
    await exports.pool.end();
}
