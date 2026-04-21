import { QueryResult } from "pg";
import { pool } from "../../infrastructure/database";
import { RoleDetails, User, UserRole } from "./types";

interface UserRow {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: string;
    genres: string[] | string;
    favorite_artists: string[] | string;
    role_details: RoleDetails | string;
}

let initPromise: Promise<void> | null = null;

export function initUserStore(): Promise<void> {
    initPromise ??= pool.query(`
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
    `).then(() => undefined);

    return initPromise;
}

function parseStringArray(value: string[] | string): string[] {
    const parsedValue: unknown =
        typeof value === "string" ? JSON.parse(value) : value;

    if (!Array.isArray(parsedValue)) {
        return [];
    }

    return parsedValue.filter(
        (item): item is string => typeof item === "string"
    );
}

function parseRoleDetails(value: RoleDetails | string): RoleDetails {
    const parsedValue: unknown =
        typeof value === "string" ? JSON.parse(value) : value;

    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
        return {};
    }

    return parsedValue as RoleDetails;
}

function toUser(row: UserRow): User {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role as UserRole,
        genres: parseStringArray(row.genres),
        favoriteArtists: parseStringArray(row.favorite_artists),
        roleDetails: parseRoleDetails(row.role_details)
    };
}

function firstUser(result: QueryResult<UserRow>): User | undefined {
    const row = result.rows[0];
    return row ? toUser(row) : undefined;
}

export async function findUserByEmail(
    email: string
): Promise<User | undefined> {
    await initUserStore();

    const result = await pool.query<UserRow>(
        `
            SELECT id, name, email, password_hash, role, genres, favorite_artists, role_details
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
        `,
        [email]
    );

    return firstUser(result);
}

export async function findUserById(id: string): Promise<User | undefined> {
    await initUserStore();

    const result = await pool.query<UserRow>(
        `
            SELECT id, name, email, password_hash, role, genres, favorite_artists, role_details
            FROM users
            WHERE id = $1
            LIMIT 1
        `,
        [id]
    );

    return firstUser(result);
}

export async function createUser(user: User): Promise<User> {
    await initUserStore();

    await pool.query(
        `
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
        `,
        [
            user.id,
            user.name,
            user.email,
            user.passwordHash,
            user.role,
            JSON.stringify(user.genres),
            JSON.stringify(user.favoriteArtists),
            JSON.stringify(user.roleDetails)
        ]
    );

    return user;
}

export async function getAllUsers(): Promise<User[]> {
    await initUserStore();

    const result = await pool.query<UserRow>(`
        SELECT id, name, email, password_hash, role, genres, favorite_artists, role_details
        FROM users
        ORDER BY created_at ASC
    `);

    return result.rows.map(toUser);
}
