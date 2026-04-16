import fs from "fs";
import path from "path";
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

let cachedArtists: OnboardingArtist[] | null = null;

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

export function getOnboardingArtists(): OnboardingArtist[] {
    cachedArtists ??= readArtistsFromSegments();

    if (cachedArtists.length === 0) {
        cachedArtists = readArtistsFromInteractions();
    }

    return cachedArtists;
}
