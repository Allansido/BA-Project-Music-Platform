import bcrypt from "bcryptjs";
import { getOnboardingArtists, OnboardingArtist } from "./artistData";
import { AVAILABLE_GENRES } from "./genreData";
import {
    createUser,
    deleteUserById,
    findUserByEmail,
    findUserById,
    updateUser
} from "./userStore";
import {
    ArtistDetails,
    LoginInput,
    ProfileUpdateInput,
    ProducerDetails,
    RoleDetails,
    SafeUser,
    SignupInput,
    User,
    UserRole
} from "./types";

const ALLOWED_ROLES: UserRole[] = ["artist", "producer", "listener"];
const MIN_PASSWORD_LENGTH = 8;
const MIN_GENRE_COUNT = 3;
const MIN_ARTIST_COUNT = 3;

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function normalizeGenres(genres: string[]): string[] {
    return [...new Set(genres.map((genre) => genre.trim()))].filter(Boolean);
}

function normalizeFavoriteArtists(favoriteArtists: string[]): string[] {
    return [...new Set(favoriteArtists.map((artist) => artist.trim()))].filter(
        Boolean
    );
}

function normalizeString(value: string | undefined): string {
    return value?.trim() ?? "";
}

function normalizeStringArray(values: string[] | undefined): string[] {
    return [...new Set((values ?? []).map((value) => value.trim()))].filter(
        Boolean
    );
}

function isValidEmail(email: string): boolean {
    return /\S+@\S+\.\S+/.test(email);
}

function getNormalizedRoleDetails(input: {
    role: UserRole;
    roleDetails?: RoleDetails;
}): RoleDetails {
    const roleDetails = input.roleDetails ?? {};

    if (input.role === "artist") {
        const artistDetails = roleDetails.artist;

        return {
            artist: {
                artistName: normalizeString(artistDetails?.artistName),
                location: normalizeString(artistDetails?.location),
                bio: normalizeString(artistDetails?.bio),
                releaseStatus: normalizeString(artistDetails?.releaseStatus)
            }
        };
    }

    if (input.role === "producer") {
        const producerDetails = roleDetails.producer;

        return {
            producer: {
                producerName: normalizeString(producerDetails?.producerName),
                studioName: normalizeString(producerDetails?.studioName),
                services: normalizeStringArray(producerDetails?.services),
                tools: normalizeString(producerDetails?.tools),
                collaborationGoal: normalizeString(
                    producerDetails?.collaborationGoal
                )
            }
        };
    }

    return {
        listener: {
            discoveryGoal: normalizeString(roleDetails.listener?.discoveryGoal)
        }
    };
}

function validateArtistDetails(artistDetails: ArtistDetails | undefined): void {
    if (!artistDetails?.artistName) {
        throw new Error("Artist name is required.");
    }

    if (!artistDetails.releaseStatus) {
        throw new Error("Please choose where you are in your artist journey.");
    }
}

function validateProducerDetails(
    producerDetails: ProducerDetails | undefined
): void {
    if (!producerDetails?.producerName) {
        throw new Error("Producer name is required.");
    }

    if (producerDetails.services.length === 0) {
        throw new Error("Please choose at least one producer service.");
    }

    if (!producerDetails.collaborationGoal) {
        throw new Error("Please choose a collaboration goal.");
    }
}

function toSafeUser(user: User): SafeUser {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        genres: user.genres,
        favoriteArtists: user.favoriteArtists,
        roleDetails: user.roleDetails
    };
}

async function validateSignupInput(input: SignupInput): Promise<void> {
    await validateProfileData({
        name: input.name,
        email: input.email,
        role: input.role,
        genres: input.genres,
        favoriteArtists: input.favoriteArtists,
        roleDetails: input.roleDetails
    });

    const password = input.password ?? "";

    if (!password) {
        throw new Error("Password is required.");
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(
            `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
        );
    }
}

async function validateProfileData(input: {
    name: string;
    email: string;
    role: UserRole;
    genres: string[];
    favoriteArtists: string[];
    roleDetails?: RoleDetails;
}): Promise<void> {
    const name = input.name?.trim();
    const email = normalizeEmail(input.email ?? "");
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

    if (!ALLOWED_ROLES.includes(role)) {
        throw new Error("Please choose a valid account type.");
    }

    const roleDetails = getNormalizedRoleDetails(input);

    if (role === "artist") {
        validateArtistDetails(roleDetails.artist);
    }

    if (role === "producer") {
        validateProducerDetails(roleDetails.producer);
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

    if (favoriteArtists.length < MIN_ARTIST_COUNT) {
        throw new Error(`Please choose at least ${MIN_ARTIST_COUNT} artists.`);
    }

    const availableArtistNames = new Set(
        (await getOnboardingArtists()).map((artist) => artist.name)
    );
    const invalidArtists = favoriteArtists.filter(
        (artist) => !availableArtistNames.has(artist)
    );

    if (invalidArtists.length > 0) {
        throw new Error("One or more selected artists are invalid.");
    }
}

export async function registerUser(input: SignupInput): Promise<SafeUser> {
    await validateSignupInput(input);

    const normalizedEmail = normalizeEmail(input.email);
    const trimmedName = input.name.trim();
    const normalizedGenres = normalizeGenres(input.genres);
    const normalizedFavoriteArtists = normalizeFavoriteArtists(input.favoriteArtists);
    const normalizedRoleDetails = getNormalizedRoleDetails(input);

    const existingUser = await findUserByEmail(normalizedEmail);

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
        genres: normalizedGenres,
        favoriteArtists: normalizedFavoriteArtists,
        roleDetails: normalizedRoleDetails
    };

    await createUser(newUser);

    return toSafeUser(newUser);
}

export async function loginUser(input: LoginInput): Promise<SafeUser> {
    const email = normalizeEmail(input.email ?? "");
    const password = input.password ?? "";

    if (!email || !password) {
        throw new Error("Email and password are required.");
    }

    const user = await findUserByEmail(email);

    if (!user) {
        throw new Error("Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
        throw new Error("Invalid email or password.");
    }

    return toSafeUser(user);
}

export async function getSafeUserById(userId: string): Promise<SafeUser | null> {
    const user = await findUserById(userId);

    if (!user) {
        return null;
    }

    return toSafeUser(user);
}

export async function updateCurrentUserProfile(
    userId: string,
    input: ProfileUpdateInput
): Promise<SafeUser> {
    const existingUser = await findUserById(userId);

    if (!existingUser) {
        throw new Error("Could not load the signed-in user profile.");
    }

    await validateProfileData({
        name: input.name,
        email: input.email,
        role: existingUser.role,
        genres: input.genres,
        favoriteArtists: input.favoriteArtists,
        roleDetails: input.roleDetails
    });

    const normalizedEmail = normalizeEmail(input.email);
    const trimmedName = input.name.trim();
    const normalizedGenres = normalizeGenres(input.genres);
    const normalizedFavoriteArtists = normalizeFavoriteArtists(input.favoriteArtists);
    const normalizedRoleDetails = getNormalizedRoleDetails({
        ...input,
        role: existingUser.role
    });

    const conflictingUser = await findUserByEmail(normalizedEmail);

    if (conflictingUser && conflictingUser.id !== existingUser.id) {
        throw new Error("An account with that email already exists.");
    }

    const updatedUser: User = {
        ...existingUser,
        name: trimmedName,
        email: normalizedEmail,
        genres: normalizedGenres,
        favoriteArtists: normalizedFavoriteArtists,
        roleDetails: normalizedRoleDetails
    };

    await updateUser(updatedUser);

    return toSafeUser(updatedUser);
}

export async function deleteCurrentUserAccount(userId: string): Promise<void> {
    const existingUser = await findUserById(userId);

    if (!existingUser) {
        throw new Error("Could not load the signed-in user profile.");
    }

    await deleteUserById(userId);
}

export function getAvailableGenres(): string[] {
    return AVAILABLE_GENRES;
}

export async function getAvailableArtists(): Promise<OnboardingArtist[]> {
    return getOnboardingArtists();
}
