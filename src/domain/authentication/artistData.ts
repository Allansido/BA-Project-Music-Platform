import fs from "fs";
import path from "path";
import readline from "readline";
import { Interaction } from "../../data/dataset_modules/lastfmLoader";

export interface OnboardingArtist {
    id: string;
    name: string;
    playCount: number;
    listenerCount: number;
    segment: "emerging" | "established";
}

interface ArtistSegmentFile {
    allArtists?: Array<{
        artistKey?: string;
        artistId?: string | null;
        artistName?: string;
        playCount?: number;
        listenerCount?: number;
        segment?: "emerging" | "established";
    }>;
}

interface MutableArtistStats {
    id: string;
    name: string;
    playCount: number;
    listeners: Set<string>;
}

const ESTABLISHED_ARTIST_RATIO = 0.2;
const artistSegmentsPath = path.join(
    process.cwd(),
    "dataset",
    "processed",
    "artistSegments.json"
);
const interactionsPath = path.join(
    process.cwd(),
    "dataset",
    "processed",
    "interactions.json"
);

let cachedArtists: OnboardingArtist[] | null = null;
let loadingArtists: Promise<OnboardingArtist[]> | null = null;

function readJsonFile<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function cleanText(value: string | undefined): string {
    return value?.trim() ?? "";
}

function parseInteractionLine(line: string): Interaction | null {
    let jsonLine = line.trim();

    if (!jsonLine || jsonLine === "[" || jsonLine === "]") {
        return null;
    }

    if (jsonLine.endsWith(",")) {
        jsonLine = jsonLine.slice(0, -1);
    }

    return JSON.parse(jsonLine) as Interaction;
}

function toArtistStats(
    stats: MutableArtistStats,
    segment: "emerging" | "established"
): OnboardingArtist {
    return {
        id: stats.id,
        name: stats.name,
        playCount: stats.playCount,
        listenerCount: stats.listeners.size,
        segment
    };
}

function uniqueArtists(artists: OnboardingArtist[]): OnboardingArtist[] {
    const seenNames = new Set<string>();

    return artists.filter((artist) => {
        const key = artist.name.toLowerCase();

        if (!artist.name || seenNames.has(key)) {
            return false;
        }

        seenNames.add(key);
        return true;
    });
}

function byPopularity(
    firstArtist: OnboardingArtist,
    secondArtist: OnboardingArtist
): number {
    return (
        secondArtist.listenerCount - firstArtist.listenerCount ||
        secondArtist.playCount - firstArtist.playCount ||
        firstArtist.name.localeCompare(secondArtist.name)
    );
}

function readArtistsFromSegments(): OnboardingArtist[] {
    const segmentData = readJsonFile<ArtistSegmentFile>(artistSegmentsPath);

    if (!segmentData?.allArtists) {
        return [];
    }

    return uniqueArtists(
        segmentData.allArtists.map((artist) => ({
            id: artist.artistId || artist.artistKey || cleanText(artist.artistName),
            name: cleanText(artist.artistName),
            playCount: artist.playCount ?? 0,
            listenerCount: artist.listenerCount ?? 0,
            segment: artist.segment ?? "emerging"
        }))
    )
        .sort(byPopularity);
}

async function readArtistsFromInteractions(): Promise<OnboardingArtist[]> {
    if (!fs.existsSync(interactionsPath)) {
        return [];
    }

    const artistsByKey = new Map<string, MutableArtistStats>();
    const lines = readline.createInterface({
        input: fs.createReadStream(interactionsPath, { encoding: "utf8" }),
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

        const stats =
            artistsByKey.get(artistKey) ??
            {
                id: artistId || artistKey,
                name: artistName,
                playCount: 0,
                listeners: new Set<string>()
            };

        stats.playCount += 1;
        stats.listeners.add(interaction.userId);
        artistsByKey.set(artistKey, stats);
    }

    const unsegmentedArtists = [...artistsByKey.values()]
        .map((stats) => toArtistStats(stats, "emerging"))
        .sort(byPopularity);
    const establishedArtistCount = Math.ceil(
        unsegmentedArtists.length * ESTABLISHED_ARTIST_RATIO
    );
    const establishedArtistKeys = new Set(
        unsegmentedArtists
            .slice(0, establishedArtistCount)
            .map((artist) => artist.id)
    );

    return uniqueArtists(
        unsegmentedArtists.map((artist) => ({
            ...artist,
            segment: establishedArtistKeys.has(artist.id)
                ? "established"
                : "emerging"
        }))
    );
}

export async function getOnboardingArtists(): Promise<OnboardingArtist[]> {
    if (cachedArtists) {
        return cachedArtists;
    }

    loadingArtists ??= (async () => {
        const segmentedArtists = readArtistsFromSegments();

        cachedArtists =
            segmentedArtists.length > 0
                ? segmentedArtists
                : await readArtistsFromInteractions();

        return cachedArtists;
    })();

    return loadingArtists;
}
