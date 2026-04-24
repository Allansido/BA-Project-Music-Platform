"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendationsForUser = getRecommendationsForUser;
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
const authService_1 = require("./auth/authService");
const INTERACTIONS_PATH = "dataset/processed/interactions.json";
let cachedIndex = null;
let cachedIndexPromise = null;
function normalizeText(value) {
    return value?.trim() ?? "";
}
function getArtistPreferenceKey(artistName) {
    return normalizeText(artistName).toLowerCase();
}
function getTrackKey(trackId, artistName, trackName) {
    return (normalizeText(trackId) ||
        `${normalizeText(artistName)}::${normalizeText(trackName)}`);
}
function parseInteractionLine(line) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine === "[" || trimmedLine === "]") {
        return null;
    }
    const normalizedLine = trimmedLine.endsWith(",")
        ? trimmedLine.slice(0, -1)
        : trimmedLine;
    return JSON.parse(normalizedLine);
}
async function streamInteractions(onInteraction) {
    if (!fs_1.default.existsSync(INTERACTIONS_PATH)) {
        return;
    }
    const stream = fs_1.default.createReadStream(INTERACTIONS_PATH, { encoding: "utf8" });
    const lineReader = readline_1.default.createInterface({
        input: stream,
        crlfDelay: Infinity
    });
    try {
        for await (const line of lineReader) {
            const interaction = parseInteractionLine(line);
            if (interaction) {
                onInteraction(interaction);
            }
        }
    }
    finally {
        lineReader.close();
    }
}
function getUserProfileArtistKeys(user) {
    return new Set(user.favoriteArtists
        .map((artistName) => getArtistPreferenceKey(artistName))
        .filter(Boolean));
}
async function buildRecommendationIndex() {
    const index = {
        userArtistProfiles: new Map(),
        artistsByUser: new Map(),
        tracksByUser: new Map(),
        popularArtists: new Map(),
        popularTracks: new Map()
    };
    await streamInteractions((interaction) => {
        const userId = normalizeText(interaction.userId);
        const artistName = normalizeText(interaction.artistName);
        const artistId = normalizeText(interaction.artistId) || null;
        const artistPreferenceKey = getArtistPreferenceKey(interaction.artistName);
        if (!userId || !artistPreferenceKey || !artistName) {
            return;
        }
        const artistProfile = index.userArtistProfiles.get(userId) ?? new Set();
        artistProfile.add(artistPreferenceKey);
        index.userArtistProfiles.set(userId, artistProfile);
        const userArtists = index.artistsByUser.get(userId) ?? new Map();
        const currentUserArtist = userArtists.get(artistPreferenceKey) ??
            {
                artistId,
                artistName,
                playCount: 0
            };
        currentUserArtist.playCount += 1;
        if (!currentUserArtist.artistId) {
            currentUserArtist.artistId = artistId;
        }
        userArtists.set(artistPreferenceKey, currentUserArtist);
        index.artistsByUser.set(userId, userArtists);
        const currentPopularArtist = index.popularArtists.get(artistPreferenceKey) ??
            {
                artistId,
                artistName,
                playCount: 0
            };
        currentPopularArtist.playCount += 1;
        if (!currentPopularArtist.artistId) {
            currentPopularArtist.artistId = artistId;
        }
        index.popularArtists.set(artistPreferenceKey, currentPopularArtist);
        const trackName = normalizeText(interaction.trackName);
        const trackId = normalizeText(interaction.trackId) || null;
        const trackKey = getTrackKey(interaction.trackId, interaction.artistName, interaction.trackName);
        if (!trackKey || !trackName || (trackId == null && artistId == null)) {
            return;
        }
        const userTracks = index.tracksByUser.get(userId) ?? new Map();
        const currentUserTrack = userTracks.get(trackKey) ??
            {
                trackId,
                trackName,
                artistId,
                artistName,
                playCount: 0
            };
        currentUserTrack.playCount += 1;
        if (!currentUserTrack.trackId) {
            currentUserTrack.trackId = trackId;
        }
        if (!currentUserTrack.artistId) {
            currentUserTrack.artistId = artistId;
        }
        userTracks.set(trackKey, currentUserTrack);
        index.tracksByUser.set(userId, userTracks);
        const currentPopularTrack = index.popularTracks.get(trackKey) ??
            {
                trackId,
                trackName,
                artistId,
                artistName,
                playCount: 0
            };
        currentPopularTrack.playCount += 1;
        if (!currentPopularTrack.trackId) {
            currentPopularTrack.trackId = trackId;
        }
        if (!currentPopularTrack.artistId) {
            currentPopularTrack.artistId = artistId;
        }
        index.popularTracks.set(trackKey, currentPopularTrack);
    });
    return index;
}
async function getRecommendationIndex() {
    if (cachedIndex) {
        return cachedIndex;
    }
    cachedIndexPromise ?? (cachedIndexPromise = buildRecommendationIndex()
        .then((index) => {
        cachedIndex = index;
        return index;
    })
        .finally(() => {
        cachedIndexPromise = null;
    }));
    return cachedIndexPromise;
}
function scoreNeighbors(userArtistProfiles, targetArtistKeys) {
    const targetSize = targetArtistKeys.size;
    if (targetSize === 0) {
        return new Map();
    }
    const neighbors = new Map();
    for (const [userId, artistKeys] of userArtistProfiles) {
        let overlapCount = 0;
        for (const artistKey of targetArtistKeys) {
            if (artistKeys.has(artistKey)) {
                overlapCount += 1;
            }
        }
        if (overlapCount === 0) {
            continue;
        }
        const similarity = overlapCount / Math.sqrt(targetSize * artistKeys.size);
        neighbors.set(userId, similarity);
    }
    return neighbors;
}
function getPopularityFallbackRecommendations(index, limit, excludedArtistKeys) {
    const artists = [...index.popularArtists.entries()]
        .filter(([artistKey]) => !excludedArtistKeys.has(artistKey))
        .map(([, artist]) => artist)
        .sort((firstArtist, secondArtist) => secondArtist.playCount - firstArtist.playCount)
        .slice(0, limit)
        .map((artist) => ({
        artistId: artist.artistId,
        artistName: artist.artistName,
        score: artist.playCount,
        reason: "Popular among listeners on the platform"
    }));
    const tracks = [...index.popularTracks.values()]
        .filter((track) => {
        const artistKey = getArtistPreferenceKey(track.artistName);
        return Boolean(artistKey) && !excludedArtistKeys.has(artistKey);
    })
        .sort((firstTrack, secondTrack) => secondTrack.playCount - firstTrack.playCount)
        .slice(0, limit)
        .map((track) => ({
        trackId: track.trackId,
        trackName: track.trackName,
        artistId: track.artistId,
        artistName: track.artistName,
        score: track.playCount,
        reason: "Popular among listeners on the platform"
    }));
    return { artists, tracks };
}
function getPreferenceBasedRecommendations(index, user, limit) {
    const targetArtistKeys = getUserProfileArtistKeys(user);
    if (targetArtistKeys.size === 0) {
        return getPopularityFallbackRecommendations(index, limit, targetArtistKeys);
    }
    const neighbors = scoreNeighbors(index.userArtistProfiles, targetArtistKeys);
    if (neighbors.size === 0) {
        return getPopularityFallbackRecommendations(index, limit, targetArtistKeys);
    }
    const artistScores = new Map();
    const trackScores = new Map();
    for (const [userId, similarity] of neighbors) {
        const userArtists = index.artistsByUser.get(userId);
        if (userArtists) {
            for (const [artistPreferenceKey, artist] of userArtists) {
                if (targetArtistKeys.has(artistPreferenceKey)) {
                    continue;
                }
                const currentArtist = artistScores.get(artistPreferenceKey) ??
                    {
                        artistId: artist.artistId,
                        artistName: artist.artistName,
                        score: 0,
                        supportingNeighbors: 0
                    };
                currentArtist.score += similarity * artist.playCount;
                currentArtist.supportingNeighbors += 1;
                artistScores.set(artistPreferenceKey, currentArtist);
            }
        }
        const userTracks = index.tracksByUser.get(userId);
        if (userTracks) {
            for (const [trackKey, track] of userTracks) {
                const artistKey = getArtistPreferenceKey(track.artistName);
                if (!artistKey || targetArtistKeys.has(artistKey)) {
                    continue;
                }
                const currentTrack = trackScores.get(trackKey) ??
                    {
                        trackId: track.trackId,
                        trackName: track.trackName,
                        artistId: track.artistId,
                        artistName: track.artistName,
                        score: 0,
                        supportingNeighbors: 0
                    };
                currentTrack.score += similarity * track.playCount;
                currentTrack.supportingNeighbors += 1;
                trackScores.set(trackKey, currentTrack);
            }
        }
    }
    const artists = [...artistScores.values()]
        .sort((firstArtist, secondArtist) => secondArtist.score - firstArtist.score)
        .slice(0, limit)
        .map((artist) => ({
        artistId: artist.artistId,
        artistName: artist.artistName,
        score: Number(artist.score.toFixed(2)),
        reason: `Heard by ${artist.supportingNeighbors} similar listeners`
    }));
    const tracks = [...trackScores.values()]
        .sort((firstTrack, secondTrack) => secondTrack.score - firstTrack.score)
        .slice(0, limit)
        .map((track) => ({
        trackId: track.trackId,
        trackName: track.trackName,
        artistId: track.artistId,
        artistName: track.artistName,
        score: Number(track.score.toFixed(2)),
        reason: `Played by ${track.supportingNeighbors} similar listeners`
    }));
    if (artists.length === 0 && tracks.length === 0) {
        return getPopularityFallbackRecommendations(index, limit, targetArtistKeys);
    }
    return { artists, tracks };
}
async function getRecommendationsForUser(userId, limit = 10) {
    const user = await (0, authService_1.getSafeUserById)(userId);
    if (!user) {
        throw new Error("Could not load the signed-in user profile.");
    }
    const index = await getRecommendationIndex();
    return getPreferenceBasedRecommendations(index, user, limit);
}
