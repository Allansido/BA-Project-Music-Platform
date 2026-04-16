import fs from "fs";
import readline from "readline";
import { Interaction } from "../data/dataset_modules/lastfmLoader";
import {
    BaselineRecommendationResult,
    RecommendedArtist,
    RecommendedTracks
} from "../data/recommendation_modules/baselineRecommender";

const INTERACTIONS_PATH = "dataset/processed/interactions.json";

interface ArtistAggregate {
    artistId: string | null;
    artistName: string;
    playCount: number;
}

interface TrackAggregate {
    trackId: string | null;
    trackName: string;
    artistId: string | null;
    artistName: string;
    playCount: number;
}

interface RecommendationAggregates {
    heardArtists: Set<string>;
    heardTracks: Set<string>;
    artists: Map<string, ArtistAggregate>;
    tracks: Map<string, TrackAggregate>;
}

function normalizeText(value: string | undefined): string {
    return value?.trim() ?? "";
}

function getArtistKey(interaction: Interaction): string {
    return (
        normalizeText(interaction.artistId) ||
        normalizeText(interaction.artistName).toLowerCase()
    );
}

function getTrackKey(interaction: Interaction): string {
    return (
        normalizeText(interaction.trackId) ||
        `${normalizeText(interaction.artistName)}::${normalizeText(
            interaction.trackName
        )}`
    );
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

function updateHeardSets(
    aggregates: RecommendationAggregates,
    interaction: Interaction,
    userId: string
): void {
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

function updateArtistAggregates(
    aggregates: RecommendationAggregates,
    interaction: Interaction
): void {
    const artistId = normalizeText(interaction.artistId) || null;
    const artistName = normalizeText(interaction.artistName);
    const artistKey = artistId || artistName.toLowerCase();

    if (!artistKey || !artistName) {
        return;
    }

    const current =
        aggregates.artists.get(artistKey) ??
        {
            artistId,
            artistName,
            playCount: 0
        };

    current.playCount += 1;
    aggregates.artists.set(artistKey, current);
}

function updateTrackAggregates(
    aggregates: RecommendationAggregates,
    interaction: Interaction
): void {
    const trackId = normalizeText(interaction.trackId) || null;
    const trackName = normalizeText(interaction.trackName);
    const artistId = normalizeText(interaction.artistId) || null;
    const artistName = normalizeText(interaction.artistName);
    const trackKey = trackId || `${artistName}::${trackName}`;

    if (!trackKey || !trackName || !artistName) {
        return;
    }

    const current =
        aggregates.tracks.get(trackKey) ??
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

async function aggregateInteractions(
    userId: string
): Promise<RecommendationAggregates> {
    const aggregates: RecommendationAggregates = {
        heardArtists: new Set<string>(),
        heardTracks: new Set<string>(),
        artists: new Map<string, ArtistAggregate>(),
        tracks: new Map<string, TrackAggregate>()
    };
    const lines = readline.createInterface({
        input: fs.createReadStream(INTERACTIONS_PATH, { encoding: "utf8" }),
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

function compareByPlayCount<T extends { playCount: number }>(
    firstItem: T,
    secondItem: T
): number {
    return secondItem.playCount - firstItem.playCount;
}

function buildRecommendedArtists(
    aggregates: RecommendationAggregates,
    limit: number
): RecommendedArtist[] {
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

function buildRecommendedTracks(
    aggregates: RecommendationAggregates,
    limit: number
): RecommendedTracks[] {
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

export async function getRecommendationsForUser(
    userId: string,
    limit = 10
): Promise<BaselineRecommendationResult> {
    const aggregates = await aggregateInteractions(userId);

    return {
        artists: buildRecommendedArtists(aggregates, limit),
        tracks: buildRecommendedTracks(aggregates, limit)
    };
}
