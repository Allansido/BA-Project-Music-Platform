"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initUserStore = initUserStore;
exports.findUserByEmail = findUserByEmail;
exports.findUserById = findUserById;
exports.createUser = createUser;
exports.getAllUsers = getAllUsers;
const database_1 = require("../../infrastructure/database");
let initPromise = null;
function initUserStore() {
    initPromise ?? (initPromise = database_1.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('artist', 'producer', 'listener')),
            genres JSONB NOT NULL DEFAULT '[]'::jsonb,
            favorite_artists JSONB NOT NULL DEFAULT '[]'::jsonb,
            role_details JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS favorite_artists JSONB NOT NULL DEFAULT '[]'::jsonb;

        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS role_details JSONB NOT NULL DEFAULT '{}'::jsonb;

        CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
            ON users (LOWER(email));

        CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS set_users_updated_at ON users;

        CREATE TRIGGER set_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at_timestamp();
    `).then(() => undefined));
    return initPromise;
}
function parseStringArray(value) {
    const parsedValue = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsedValue)) {
        return [];
    }
    return parsedValue.filter((item) => typeof item === "string");
}
function parseRoleDetails(value) {
    const parsedValue = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
        return {};
    }
    return parsedValue;
}
function toUser(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role,
        genres: parseStringArray(row.genres),
        favoriteArtists: parseStringArray(row.favorite_artists),
        roleDetails: parseRoleDetails(row.role_details)
    };
}
function firstUser(result) {
    const row = result.rows[0];
    return row ? toUser(row) : undefined;
}
async function findUserByEmail(email) {
    await initUserStore();
    const result = await database_1.pool.query(`
            SELECT id, name, email, password_hash, role, genres, favorite_artists, role_details
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
        `, [email]);
    return firstUser(result);
}
async function findUserById(id) {
    await initUserStore();
    const result = await database_1.pool.query(`
            SELECT id, name, email, password_hash, role, genres, favorite_artists, role_details
            FROM users
            WHERE id = $1
            LIMIT 1
        `, [id]);
    return firstUser(result);
}
async function createUser(user) {
    await initUserStore();
    await database_1.pool.query(`
            INSERT INTO users (
                id,
                name,
                email,
                password_hash,
                role,
                genres,
                favorite_artists,
                role_details
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
        `, [
        user.id,
        user.name,
        user.email,
        user.passwordHash,
        user.role,
        JSON.stringify(user.genres),
        JSON.stringify(user.favoriteArtists),
        JSON.stringify(user.roleDetails)
    ]);
    return user;
}
async function getAllUsers() {
    await initUserStore();
    const result = await database_1.pool.query(`
        SELECT id, name, email, password_hash, role, genres, favorite_artists, role_details
        FROM users
        ORDER BY created_at ASC
    `);
    return result.rows.map(toUser);
}
