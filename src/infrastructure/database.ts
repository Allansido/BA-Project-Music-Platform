import { Pool } from "pg";

const DEFAULT_DATABASE_URL =
    "postgres://music_platform:music_platform@localhost:5433/music_platform";

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
});

export async function closeDatabasePool(): Promise<void> {
    await pool.end();
}
