"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.getSafeUserById = getSafeUserById;
exports.getAvailableGenres = getAvailableGenres;
exports.getAvailableArtists = getAvailableArtists;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const artistData_1 = require("./artistData");
const genreData_1 = require("./genreData");
const userStore_1 = require("./userStore");
const ALLOWED_ROLES = ["artist", "producer", "listener"];
const MIN_PASSWORD_LENGTH = 8;
const MIN_GENRE_COUNT = 3;
const MIN_ARTIST_COUNT = 3;
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function normalizeGenres(genres) {
    return [...new Set(genres.map((genre) => genre.trim()))].filter(Boolean);
}
function normalizeFavoriteArtists(favoriteArtists) {
    return [...new Set(favoriteArtists.map((artist) => artist.trim()))].filter(Boolean);
}
function isValidEmail(email) {
    return /\S+@\S+\.\S+/.test(email);
}
function toSafeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        genres: user.genres,
        favoriteArtists: user.favoriteArtists
    };
}
function validateSignupInput(input) {
    const name = input.name?.trim();
    const email = normalizeEmail(input.email ?? "");
    const password = input.password ?? "";
    const role = input.role;
    const genres = normalizeGenres(input.genres ?? []);
    const favoriteArtists = normalizeFavoriteArtists(input.favoriteArtists ?? []);
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
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    }
    if (!ALLOWED_ROLES.includes(role)) {
        throw new Error("Please choose a valid account type.");
    }
    if (genres.length < MIN_GENRE_COUNT) {
        throw new Error(`Please choose at least ${MIN_GENRE_COUNT} genres.`);
    }
    const invalidGenres = genres.filter((genre) => !genreData_1.AVAILABLE_GENRES.includes(genre));
    if (invalidGenres.length > 0) {
        throw new Error("One or more selected genres are invalid.");
    }
    if (favoriteArtists.length < MIN_ARTIST_COUNT) {
        throw new Error(`Please choose at least ${MIN_ARTIST_COUNT} artists.`);
    }
    const availableArtistNames = new Set((0, artistData_1.getOnboardingArtists)().map((artist) => artist.name));
    const invalidArtists = favoriteArtists.filter((artist) => !availableArtistNames.has(artist));
    if (invalidArtists.length > 0) {
        throw new Error("One or more selected artists are invalid.");
    }
}
async function registerUser(input) {
    validateSignupInput(input);
    const normalizedEmail = normalizeEmail(input.email);
    const trimmedName = input.name.trim();
    const normalizedGenres = normalizeGenres(input.genres);
    const normalizedFavoriteArtists = normalizeFavoriteArtists(input.favoriteArtists);
    const existingUser = await (0, userStore_1.findUserByEmail)(normalizedEmail);
    if (existingUser) {
        throw new Error("An account with that email already exists.");
    }
    const passwordHash = await bcryptjs_1.default.hash(input.password, 10);
    const newUser = {
        id: crypto.randomUUID(),
        name: trimmedName,
        email: normalizedEmail,
        passwordHash,
        role: input.role,
        genres: normalizedGenres,
        favoriteArtists: normalizedFavoriteArtists
    };
    await (0, userStore_1.createUser)(newUser);
    return toSafeUser(newUser);
}
async function loginUser(input) {
    const email = normalizeEmail(input.email ?? "");
    const password = input.password ?? "";
    if (!email || !password) {
        throw new Error("Email and password are required.");
    }
    const user = await (0, userStore_1.findUserByEmail)(email);
    if (!user) {
        throw new Error("Invalid email or password.");
    }
    const passwordMatches = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!passwordMatches) {
        throw new Error("Invalid email or password.");
    }
    return toSafeUser(user);
}
async function getSafeUserById(userId) {
    const user = await (0, userStore_1.findUserById)(userId);
    if (!user) {
        return null;
    }
    return toSafeUser(user);
}
function getAvailableGenres() {
    return genreData_1.AVAILABLE_GENRES;
}
function getAvailableArtists() {
    return (0, artistData_1.getOnboardingArtists)();
}
