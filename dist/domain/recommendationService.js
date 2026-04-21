"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendationsForUser = getRecommendationsForUser;
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
const INTERACTIONS_PATH = "dataset/processed/interactions.json";
function normalizeText(value) {
    return value?.trim() ?? "";
}
function getArtistKey(interaction) {
    return (normalizeText(interaction.artistId) ||
        normalizeText(interaction.artistName).toLowerCase());
}
function getTrackKey(interaction) {
    return (normalizeText(interaction.trackId) ||
        `${normalizeText(interaction.artistName)}::${normalizeText(interaction.trackName)}`);
}
function parseInteractionLine(line) {
    let jsonLine = line.trim();
    if (!jsonLine || jsonLine === "[" || jsonLine === "]") {
        return null;
    }
    if (jsonLine.endsWith(",")) {
        jsonLine = jsonLine.slice(0, -1);
    }
    return JSON.parse(jsonLine);
}
function updateHeardSets(aggregates, interaction, userId) {
    if (interaction.userId !== userId) {
        return;
    }
    const artistKey = getArtistKey(interaction);
    const trackKey = getTrackKey(interaction);
    if (artistKey) {
        aggregates.heardArtists.add(artistKey);
    }
    if (trackKey.trim() !== "::") {
        aggregates.heardTracks.add(trackKey);
    }
}
function updateArtistAggregates(aggregates, interaction) {
    const artistId = normalizeText(interaction.artistId) || null;
    const artistName = normalizeText(interaction.artistName);
    const artistKey = artistId || artistName.toLowerCase();
    if (!artistKey || !artistName) {
        return;
    }
    const current = aggregates.artists.get(artistKey) ??
        {
            artistId,
            artistName,
            playCount: 0
        };
    current.playCount += 1;
    aggregates.artists.set(artistKey, current);
}
function updateTrackAggregates(aggregates, interaction) {
    const trackId = normalizeText(interaction.trackId) || null;
    const trackName = normalizeText(interaction.trackName);
    const artistId = normalizeText(interaction.artistId) || null;
    const artistName = normalizeText(interaction.artistName);
    const trackKey = trackId || `${artistName}::${trackName}`;
    if (!trackKey || !trackName || !artistName) {
        return;
    }
    const current = aggregates.tracks.get(trackKey) ??
        {
            trackId,
            trackName,
            artistId,
            artistName,
            playCount: 0
        };
    current.playCount += 1;
    aggregates.tracks.set(trackKey, current);
}
async function aggregateInteractions(userId) {
    const aggregates = {
        heardArtists: new Set(),
        heardTracks: new Set(),
        artists: new Map(),
        tracks: new Map()
    };
    const lines = readline_1.default.createInterface({
        input: fs_1.default.createReadStream(INTERACTIONS_PATH, { encoding: "utf8" }),
        crlfDelay: Infinity
    });
    for await (const line of lines) {
        const interaction = parseInteractionLine(line);
        if (!interaction) {
            continue;
        }
        updateHeardSets(aggregates, interaction, userId);
        updateArtistAggregates(aggregates, interaction);
        updateTrackAggregates(aggregates, interaction);
    }
    return aggregates;
}
function compareByPlayCount(firstItem, secondItem) {
    return secondItem.playCount - firstItem.playCount;
}
function buildRecommendedArtists(aggregates, limit) {
    return [...aggregates.artists.values()]
        .sort(compareByPlayCount)
        .filter((artist) => {
        const artistKey = artist.artistId || artist.artistName.toLowerCase();
        return !aggregates.heardArtists.has(artistKey);
    })
        .slice(0, limit)
        .map((artist) => ({
        artistId: artist.artistId,
        artistName: artist.artistName,
        score: artist.playCount,
        reason: "Popular among listeners on the platform"
    }));
}
function buildRecommendedTracks(aggregates, limit) {
    return [...aggregates.tracks.values()]
        .sort(compareByPlayCount)
        .filter((track) => {
        const trackKey = track.trackId || `${track.artistName}::${track.trackName}`;
        if (track.trackId == null || track.artistId == null) {
            return false;
        }
        return !aggregates.heardTracks.has(trackKey);
    })
        .slice(0, limit)
        .map((track) => ({
        trackId: track.trackId,
        trackName: track.trackName,
        artistId: track.artistId,
        artistName: track.artistName,
        score: track.playCount,
        reason: "Popular among listeners on the platform"
    }));
}
async function getRecommendationsForUser(userId, limit = 10) {
    const aggregates = await aggregateInteractions(userId);
    return {
        artists: buildRecommendedArtists(aggregates, limit),
        tracks: buildRecommendedTracks(aggregates, limit)
    };
}
