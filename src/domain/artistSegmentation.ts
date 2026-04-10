import { Interaction } from "../data/lastfmLoader";

export type ArtistSegment = "emerging" | "established";

export interface ArtistStats {
    artistKey: string;
    artistId: string | null;
    artistName: string;
    playCount: number;
    listenerCount: number;
    trackCount: number;
    firstListenedAt: string | null;
    lastListenedAt: string | null;
    segment: ArtistSegment;
}

export interface ArtistSegmentationOptions {
    establishedArtistRatio?: number;
}

export interface ArtistSegmentationResult {
    emerging: ArtistStats[];
    established: ArtistStats[];
    allArtists: ArtistStats[];
    establishedArtistRatio: number;
    establishedArtistCount: number;
}

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

const DEFAULT_ESTABLISHED_ARTIST_RATIO = 0.2;

function normalizeText(value: string | undefined): string {
    return value?.trim() ?? "";
}

function clampEstablishedArtistRatio(ratio: number): number {
    if (!Number.isFinite(ratio)) {
        return DEFAULT_ESTABLISHED_ARTIST_RATIO;
    }

    return Math.min(Math.max(ratio, 0), 1);
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

function toArtistStats(
    stats: MutableArtistStats,
    segment: ArtistSegment
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
        segment
    };
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

export function splitArtistsBySegment(
    interactions: Interaction[],
    options: ArtistSegmentationOptions = {}
): ArtistSegmentationResult {
    const artistsByKey = new Map<string, MutableArtistStats>();
    const establishedArtistRatio = clampEstablishedArtistRatio(
        options.establishedArtistRatio ?? DEFAULT_ESTABLISHED_ARTIST_RATIO
    );

    for (const interaction of interactions) {
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
        .map((stats) => toArtistStats(stats, "emerging"))
        .sort(compareArtistPopularity);

    const establishedArtistCount = Math.ceil(
        unsegmentedArtists.length * establishedArtistRatio
    );
    const establishedKeys = new Set(
        unsegmentedArtists
            .slice(0, establishedArtistCount)
            .map((artist) => artist.artistKey)
    );

    const allArtists: ArtistStats[] = unsegmentedArtists.map((artist) => ({
        ...artist,
        segment: establishedKeys.has(artist.artistKey)
            ? "established"
            : "emerging"
    }));

    return {
        emerging: allArtists.filter((artist) => artist.segment === "emerging"),
        established: allArtists.filter(
            (artist) => artist.segment === "established"
        ),
        allArtists,
        establishedArtistRatio,
        establishedArtistCount
    };
}
