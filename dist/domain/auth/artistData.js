"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOnboardingArtists = getOnboardingArtists;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
const ESTABLISHED_ARTIST_RATIO = 0.2;
const artistSegmentsPath = path_1.default.join(process.cwd(), "dataset", "processed", "artistSegments.json");
const interactionsPath = path_1.default.join(process.cwd(), "dataset", "processed", "interactions.json");
let cachedArtists = null;
let loadingArtists = null;
function readJsonFile(filePath) {
    if (!fs_1.default.existsSync(filePath)) {
        return null;
    }
    return JSON.parse(fs_1.default.readFileSync(filePath, "utf8"));
}
function cleanText(value) {
    return value?.trim() ?? "";
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
function toArtistStats(stats, segment) {
    return {
        id: stats.id,
        name: stats.name,
        playCount: stats.playCount,
        listenerCount: stats.listeners.size,
        segment
    };
}
function uniqueArtists(artists) {
    const seenNames = new Set();
    return artists.filter((artist) => {
        const key = artist.name.toLowerCase();
        if (!artist.name || seenNames.has(key)) {
            return false;
        }
        seenNames.add(key);
        return true;
    });
}
function byPopularity(firstArtist, secondArtist) {
    return (secondArtist.listenerCount - firstArtist.listenerCount ||
        secondArtist.playCount - firstArtist.playCount ||
        firstArtist.name.localeCompare(secondArtist.name));
}
function readArtistsFromSegments() {
    const segmentData = readJsonFile(artistSegmentsPath);
    if (!segmentData?.allArtists) {
        return [];
    }
    return uniqueArtists(segmentData.allArtists.map((artist) => ({
        id: artist.artistId || artist.artistKey || cleanText(artist.artistName),
        name: cleanText(artist.artistName),
        playCount: artist.playCount ?? 0,
        listenerCount: artist.listenerCount ?? 0,
        segment: artist.segment ?? "emerging"
    })))
        .sort(byPopularity);
}
async function readArtistsFromInteractions() {
    if (!fs_1.default.existsSync(interactionsPath)) {
        return [];
    }
    const artistsByKey = new Map();
    const lines = readline_1.default.createInterface({
        input: fs_1.default.createReadStream(interactionsPath, { encoding: "utf8" }),
        crlfDelay: Infinity
    });
    for await (const line of lines) {
        const interaction = parseInteractionLine(line);
        if (!interaction) {
            continue;
        }
        const artistId = cleanText(interaction.artistId);
        const artistName = cleanText(interaction.artistName);
        const artistKey = artistId || artistName.toLowerCase();
        if (!artistKey || !artistName) {
            continue;
        }
        const stats = artistsByKey.get(artistKey) ??
            {
                id: artistId || artistKey,
                name: artistName,
                playCount: 0,
                listeners: new Set()
            };
        stats.playCount += 1;
        stats.listeners.add(interaction.userId);
        artistsByKey.set(artistKey, stats);
    }
    const unsegmentedArtists = [...artistsByKey.values()]
        .map((stats) => toArtistStats(stats, "emerging"))
        .sort(byPopularity);
    const establishedArtistCount = Math.ceil(unsegmentedArtists.length * ESTABLISHED_ARTIST_RATIO);
    const establishedArtistKeys = new Set(unsegmentedArtists
        .slice(0, establishedArtistCount)
        .map((artist) => artist.id));
    return uniqueArtists(unsegmentedArtists.map((artist) => ({
        ...artist,
        segment: establishedArtistKeys.has(artist.id)
            ? "established"
            : "emerging"
    })));
}
async function getOnboardingArtists() {
    if (cachedArtists) {
        return cachedArtists;
    }
    loadingArtists ?? (loadingArtists = (async () => {
        const segmentedArtists = readArtistsFromSegments();
        cachedArtists =
            segmentedArtists.length > 0
                ? segmentedArtists
                : await readArtistsFromInteractions();
        return cachedArtists;
    })());
    return loadingArtists;
}
