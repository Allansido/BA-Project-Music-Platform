"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOnboardingArtists = getOnboardingArtists;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const artistSegmentation_1 = require("../artistSegmentation");
const ARTIST_LIMIT = 60;
const artistSegmentsPath = path_1.default.join(process.cwd(), "dataset", "processed", "artistSegments.json");
const interactionsPath = path_1.default.join(process.cwd(), "dataset", "processed", "interactions.json");
let cachedArtists = null;
function readJsonFile(filePath) {
    if (!fs_1.default.existsSync(filePath)) {
        return null;
    }
    return JSON.parse(fs_1.default.readFileSync(filePath, "utf8"));
}
function cleanArtistName(name) {
    return name?.trim() ?? "";
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
        id: artist.artistId || artist.artistKey || cleanArtistName(artist.artistName),
        name: cleanArtistName(artist.artistName),
        playCount: artist.playCount ?? 0,
        listenerCount: artist.listenerCount ?? 0,
        segment: artist.segment ?? "emerging"
    })))
        .sort(byPopularity)
        .slice(0, ARTIST_LIMIT);
}
function readArtistsFromInteractions() {
    const interactions = readJsonFile(interactionsPath);
    if (!interactions) {
        return [];
    }
    return (0, artistSegmentation_1.splitArtistsBySegment)(interactions)
        .allArtists.map((artist) => ({
        id: artist.artistId || artist.artistKey,
        name: cleanArtistName(artist.artistName),
        playCount: artist.playCount,
        listenerCount: artist.listenerCount,
        segment: artist.segment
    }))
        .filter((artist) => artist.name)
        .sort(byPopularity)
        .slice(0, ARTIST_LIMIT);
}
function getOnboardingArtists() {
    cachedArtists ?? (cachedArtists = readArtistsFromSegments());
    if (cachedArtists.length === 0) {
        cachedArtists = readArtistsFromInteractions();
    }
    return cachedArtists;
}
