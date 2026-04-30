"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
const artistSegmentation_1 = require("../domain/artistSegmentation");
const inputPath = "dataset/processed/interactions.json";
const outputPath = "dataset/processed/artistSegments.json";
function normalizeText(value) {
    return value?.trim() ?? "";
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
function getArtistKey(interaction) {
    const artistId = normalizeText(interaction.artistId);
    if (artistId) {
        return artistId;
    }
    const artistName = normalizeText(interaction.artistName);
    return artistName ? artistName.toLowerCase() : null;
}
function updateDateRange(stats, timestamp) {
    if (!timestamp) {
        return;
    }
    if (!stats.firstListenedAt || timestamp < stats.firstListenedAt) {
        stats.firstListenedAt = timestamp;
    }
    if (!stats.lastListenedAt || timestamp > stats.lastListenedAt) {
        stats.lastListenedAt = timestamp;
    }
}
function compareArtistPopularity(firstArtist, secondArtist) {
    return (secondArtist.listenerCount - firstArtist.listenerCount ||
        secondArtist.playCount - firstArtist.playCount ||
        secondArtist.trackCount - firstArtist.trackCount ||
        firstArtist.artistName.localeCompare(secondArtist.artistName));
}
function toArtistStats(stats, segment, referenceDate) {
    return {
        artistKey: stats.artistKey,
        artistId: stats.artistId,
        artistName: stats.artistName,
        playCount: stats.playCount,
        listenerCount: stats.listeners.size,
        trackCount: stats.tracks.size,
        firstListenedAt: stats.firstListenedAt,
        lastListenedAt: stats.lastListenedAt,
        accountAgeDays: (0, artistSegmentation_1.getArtistAccountAgeDays)(stats.firstListenedAt, referenceDate),
        segment
    };
}
async function splitArtistsFromFile(filePath) {
    const artistsByKey = new Map();
    const referenceDate = new Date();
    const lineReader = readline_1.default.createInterface({
        input: fs_1.default.createReadStream(filePath, { encoding: "utf8" }),
        crlfDelay: Infinity
    });
    for await (const line of lineReader) {
        const interaction = parseInteractionLine(line);
        if (!interaction) {
            continue;
        }
        const artistKey = getArtistKey(interaction);
        if (!artistKey) {
            continue;
        }
        const artistName = normalizeText(interaction.artistName);
        const artistId = normalizeText(interaction.artistId) || null;
        const trackKey = normalizeText(interaction.trackId) ||
            normalizeText(interaction.trackName);
        const stats = artistsByKey.get(artistKey) ??
            {
                artistKey,
                artistId,
                artistName,
                playCount: 0,
                listeners: new Set(),
                tracks: new Set(),
                firstListenedAt: null,
                lastListenedAt: null
            };
        stats.playCount += 1;
        stats.listeners.add(interaction.userId);
        if (trackKey) {
            stats.tracks.add(trackKey);
        }
        updateDateRange(stats, interaction.timestamp);
        artistsByKey.set(artistKey, stats);
    }
    const unsegmentedArtists = [...artistsByKey.values()]
        .map((stats) => toArtistStats(stats, "emerging", referenceDate))
        .sort(compareArtistPopularity);
    const allArtists = unsegmentedArtists.map((artist) => ({
        ...artist,
        segment: (0, artistSegmentation_1.classifyArtistSegment)(artist, { referenceDate })
    }));
    return {
        emerging: allArtists.filter((artist) => artist.segment === "emerging"),
        established: allArtists.filter((artist) => artist.segment === "established"),
        allArtists,
        thresholds: {
            emergingMaxAccountAgeDays: 7550,
            emergingMaxTotalListens: 6500
        }
    };
}
async function run() {
    const result = await splitArtistsFromFile(inputPath);
    fs_1.default.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Saved ${result.allArtists.length} artist segments to ${outputPath}`);
    console.log(`Emerging artists: ${result.emerging.length}`);
    console.log(`Established artists: ${result.established.length}`);
}
run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
