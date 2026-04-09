import bcrypt from "bcryptjs";
import { AVAILABLE_GENRES } from "./genreData";
import { createUser, findUserByEmail, findUserById } from "./userStore";
import {
    LoginInput,
    SafeUser,
    SignupInput,
    User,
    UserRole
} from "./types";

const ALLOWED_ROLES: UserRole[] = ["artist", "producer", "listener"];
const MIN_PASSWORD_LENGTH = 8;
const MIN_GENRE_COUNT = 3;

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function normalizeGenres(genres: string[]): string[] {
    return [...new Set(genres.map((genre) => genre.trim()))].filter(Boolean);
}

function isValidEmail(email: string): boolean {
    return /\S+@\S+\.\S+/.test(email);
}

function toSafeUser(user: User): SafeUser {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        genres: user.genres
    };
}

function validateSignupInput(input: SignupInput): void {
    const name = input.name?.trim();
    const email = normalizeEmail(input.email ?? "");
    const password = input.password ?? "";
    const role = input.role;
    const genres = normalizeGenres(input.genres ?? []);

    if (!name) {
        throw new Error("Name is required.");
    }

    if (!email) {
        throw new Error("Email is required.");
    }

    if (!isValidEmail(email)) {
        throw new Error("Please provide a valid email address.");
    }

    if (!password) {
        throw new Error("Password is required.");
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(
            `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
        );
    }

    if (!ALLOWED_ROLES.includes(role)) {
        throw new Error("Please choose a valid account type.");
    }

    if (genres.length < MIN_GENRE_COUNT) {
        throw new Error(`Please choose at least ${MIN_GENRE_COUNT} genres.`);
    }

    const invalidGenres = genres.filter(
        (genre) => !AVAILABLE_GENRES.includes(genre)
    );

    if (invalidGenres.length > 0) {
        throw new Error("One or more selected genres are invalid.");
    }
}

export async function registerUser(input: SignupInput): Promise<SafeUser> {
    validateSignupInput(input);

    const normalizedEmail = normalizeEmail(input.email);
    const trimmedName = input.name.trim();
    const normalizedGenres = normalizeGenres(input.genres);

    const existingUser = findUserByEmail(normalizedEmail);

    if (existingUser) {
        throw new Error("An account with that email already exists.");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const newUser: User = {
        id: crypto.randomUUID(),
        name: trimmedName,
        email: normalizedEmail,
        passwordHash,
        role: input.role,
        genres: normalizedGenres
    };

    createUser(newUser);

    return toSafeUser(newUser);
}

export async function loginUser(input: LoginInput): Promise<SafeUser> {
    const email = normalizeEmail(input.email ?? "");
    const password = input.password ?? "";

    if (!email || !password) {
        throw new Error("Email and password are required.");
    }

    const user = findUserByEmail(email);

    if (!user) {
        throw new Error("Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
        throw new Error("Invalid email or password.");
    }

    return toSafeUser(user);
}

export function getSafeUserById(userId: string): SafeUser | null {
    const user = findUserById(userId);

    if (!user) {
        return null;
    }

    return toSafeUser(user);
}

export function getAvailableGenres(): string[] {
    return AVAILABLE_GENRES;
}