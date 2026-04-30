import fs from "fs";
import readline from "readline";
import { Interaction } from "../data/dataset_modules/lastfmLoader";
import {
    ArtistSegment,
    ArtistSegmentationResult,
    ArtistStats,
    classifyArtistSegment,
    getArtistAccountAgeDays
} from "../domain/artistSegmentation";

const inputPath = "dataset/processed/interactions.json";
const outputPath = "dataset/processed/artistSegments.json";

interface MutableArtistStats {
    artistKey: string;
    artistId: string | null;
    artistName: string;
    playCount: number;
    listeners: Set<string>;
    tracks: Set<string>;
    firstListenedAt: string | null;
    lastListenedAt: string | null;
}

function normalizeText(value: string | undefined): string {
    return value?.trim() ?? "";
}

function parseInteractionLine(line: string): Interaction | null {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine === "[" || trimmedLine === "]") {
        return null;
    }

    const normalizedLine = trimmedLine.endsWith(",")
        ? trimmedLine.slice(0, -1)
        : trimmedLine;

    return JSON.parse(normalizedLine) as Interaction;
}

function getArtistKey(interaction: Interaction): string | null {
    const artistId = normalizeText(interaction.artistId);

    if (artistId) {
        return artistId;
    }

    const artistName = normalizeText(interaction.artistName);

    return artistName ? artistName.toLowerCase() : null;
}

function updateDateRange(
    stats: MutableArtistStats,
    timestamp: string
): void {
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

function compareArtistPopularity(
    firstArtist: ArtistStats,
    secondArtist: ArtistStats
): number {
    return (
        secondArtist.listenerCount - firstArtist.listenerCount ||
        secondArtist.playCount - firstArtist.playCount ||
        secondArtist.trackCount - firstArtist.trackCount ||
        firstArtist.artistName.localeCompare(secondArtist.artistName)
    );
}

function toArtistStats(
    stats: MutableArtistStats,
    segment: ArtistSegment,
    referenceDate: Date
): ArtistStats {
    return {
        artistKey: stats.artistKey,
        artistId: stats.artistId,
        artistName: stats.artistName,
        playCount: stats.playCount,
        listenerCount: stats.listeners.size,
        trackCount: stats.tracks.size,
        firstListenedAt: stats.firstListenedAt,
        lastListenedAt: stats.lastListenedAt,
        accountAgeDays: getArtistAccountAgeDays(
            stats.firstListenedAt,
            referenceDate
        ),
        segment
    };
}

async function splitArtistsFromFile(
    filePath: string
): Promise<ArtistSegmentationResult> {
    const artistsByKey = new Map<string, MutableArtistStats>();
    const referenceDate = new Date();
    const lineReader = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: "utf8" }),
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
        const trackKey =
            normalizeText(interaction.trackId) ||
            normalizeText(interaction.trackName);
        const stats =
            artistsByKey.get(artistKey) ??
            {
                artistKey,
                artistId,
                artistName,
                playCount: 0,
                listeners: new Set<string>(),
                tracks: new Set<string>(),
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
        segment: classifyArtistSegment(artist, { referenceDate })
    }));

    return {
        emerging: allArtists.filter((artist) => artist.segment === "emerging"),
        established: allArtists.filter(
            (artist) => artist.segment === "established"
        ),
        allArtists,
        thresholds: {
            emergingMaxAccountAgeDays: 7550,
            emergingMaxTotalListens: 6500
        }
    };
}

async function run() {
    const result = await splitArtistsFromFile(inputPath);

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(
        `Saved ${result.allArtists.length} artist segments to ${outputPath}`
    );
    console.log(`Emerging artists: ${result.emerging.length}`);
    console.log(`Established artists: ${result.established.length}`);
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
