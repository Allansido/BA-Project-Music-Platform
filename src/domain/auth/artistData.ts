import fs from "fs";
import path from "path";
import readline from "readline";
import { splitArtistsBySegment } from "../artistSegmentation";
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

const ARTIST_LIMIT = 60;
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
const ESTABLISHED_ARTIST_RATIO = 0.2;

let cachedArtists: OnboardingArtist[] | null = null;
let cachedArtistsPromise: Promise<OnboardingArtist[]> | null = null;

function readJsonFile<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function cleanArtistName(name: string | undefined): string {
    return name?.trim() ?? "";
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
            id: artist.artistId || artist.artistKey || cleanArtistName(artist.artistName),
            name: cleanArtistName(artist.artistName),
            playCount: artist.playCount ?? 0,
            listenerCount: artist.listenerCount ?? 0,
            segment: artist.segment ?? "emerging"
        }))
    )
        .sort(byPopularity)
        .slice(0, ARTIST_LIMIT);
}

function readArtistsFromInteractions(): OnboardingArtist[] {
    const interactions = readJsonFile<Interaction[]>(interactionsPath);

    if (!interactions) {
        return [];
    }

    return splitArtistsBySegment(interactions)
        .allArtists.map((artist): OnboardingArtist => ({
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

type MutableArtistStats = {
    artistKey: string;
    artistId: string | null;
    artistName: string;
    playCount: number;
    listeners: Set<string>;
};

function normalizeText(value: string | undefined): string {
    return value?.trim() ?? "";
}

function getArtistKey(interaction: Interaction): string | null {
    const artistId = normalizeText(interaction.artistId);

    if (artistId) {
        return artistId;
    }

    const artistName = normalizeText(interaction.artistName);

    if (!artistName) {
        return null;
    }

    return artistName.toLowerCase();
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

async function readArtistsFromInteractionStream(): Promise<OnboardingArtist[]> {
    if (!fs.existsSync(interactionsPath)) {
        return [];
    }

    const artistsByKey = new Map<string, MutableArtistStats>();
    const stream = fs.createReadStream(interactionsPath, { encoding: "utf8" });
    const lineReader = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    try {
        for await (const line of lineReader) {
            const interaction = parseInteractionLine(line);

            if (!interaction) {
                continue;
            }

            const artistKey = getArtistKey(interaction);

            if (!artistKey) {
                continue;
            }

            const artistName = cleanArtistName(interaction.artistName);

            if (!artistName) {
                continue;
            }

            const existingArtist =
                artistsByKey.get(artistKey) ??
                {
                    artistKey,
                    artistId: normalizeText(interaction.artistId) || null,
                    artistName,
                    playCount: 0,
                    listeners: new Set<string>()
                };

            existingArtist.playCount += 1;
            existingArtist.listeners.add(interaction.userId);

            if (!existingArtist.artistName) {
                existingArtist.artistName = artistName;
            }

            if (!existingArtist.artistId) {
                existingArtist.artistId = normalizeText(interaction.artistId) || null;
            }

            artistsByKey.set(artistKey, existingArtist);
        }
    } finally {
        lineReader.close();
    }

    const allArtists = [...artistsByKey.values()]
        .map((artist) => ({
            id: artist.artistId || artist.artistKey,
            name: cleanArtistName(artist.artistName),
            playCount: artist.playCount,
            listenerCount: artist.listeners.size,
            segment: "emerging" as const
        }))
        .filter((artist) => artist.name)
        .sort(byPopularity);

    const establishedArtistCount = Math.ceil(
        allArtists.length * ESTABLISHED_ARTIST_RATIO
    );

    return allArtists
        .map((artist, index): OnboardingArtist => ({
            ...artist,
            segment:
                index < establishedArtistCount ? "established" : "emerging"
        }))
        .slice(0, ARTIST_LIMIT);
}

export async function getOnboardingArtists(): Promise<OnboardingArtist[]> {
    if (cachedArtists) {
        return cachedArtists;
    }

    cachedArtists = readArtistsFromSegments();

    if (cachedArtists.length === 0) {
        cachedArtistsPromise ??= readArtistsFromInteractionStream()
            .catch(() => readArtistsFromInteractions())
            .then((artists) => {
                cachedArtists = artists;
                return artists;
            })
            .finally(() => {
                cachedArtistsPromise = null;
            });

        cachedArtists = await cachedArtistsPromise;
    }

    return cachedArtists;
}
