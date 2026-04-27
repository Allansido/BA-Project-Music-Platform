import { Interaction } from "../data/dataset_modules/lastfmLoader";
import { DEFAULT_FAIRNESS_CONFIG } from "./fairnessConfig";

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
    accountAgeDays: number | null;
    segment: ArtistSegment;
}

export interface ArtistSegmentationOptions {
    emergingMaxAccountAgeDays?: number;
    emergingMaxTotalListens?: number;
    referenceDate?: Date;
}

export interface ArtistSegmentationResult {
    emerging: ArtistStats[];
    established: ArtistStats[];
    allArtists: ArtistStats[];
    thresholds: {
        emergingMaxAccountAgeDays: number;
        emergingMaxTotalListens: number;
    };
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

function normalizeText(value: string | undefined): string {
    return value?.trim() ?? "";
}

function getValidThreshold(
    value: number | undefined,
    fallback: number
): number {
    if (value == null || !Number.isFinite(value) || value < 0) {
        return fallback;
    }

    return value;
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

export function getArtistAccountAgeDays(
    firstListenedAt: string | null,
    referenceDate = new Date()
): number | null {
    if (!firstListenedAt) {
        return null;
    }

    const firstObservedAt = new Date(firstListenedAt);

    if (Number.isNaN(firstObservedAt.getTime())) {
        return null;
    }

    const millisecondsDiff = referenceDate.getTime() - firstObservedAt.getTime();

    if (!Number.isFinite(millisecondsDiff) || millisecondsDiff < 0) {
        return 0;
    }

    return Math.floor(millisecondsDiff / (1000 * 60 * 60 * 24));
}

export function classifyArtistSegment(
    artist: Pick<ArtistStats, "playCount" | "firstListenedAt">,
    options: ArtistSegmentationOptions = {}
): ArtistSegment {
    const thresholds = {
        emergingMaxAccountAgeDays: getValidThreshold(
            options.emergingMaxAccountAgeDays,
            DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds.emergingMaxAccountAgeDays
        ),
        emergingMaxTotalListens: getValidThreshold(
            options.emergingMaxTotalListens,
            DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds.emergingMaxTotalListens
        )
    };
    const accountAgeDays = getArtistAccountAgeDays(
        artist.firstListenedAt,
        options.referenceDate
    );
    const hasEmergingAge = accountAgeDays != null
        && accountAgeDays <= thresholds.emergingMaxAccountAgeDays;
    const hasEmergingListenCount =
        artist.playCount <= thresholds.emergingMaxTotalListens;

    return hasEmergingAge && hasEmergingListenCount
        ? "emerging"
        : "established";
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
    const referenceDate = options.referenceDate ?? new Date();
    const thresholds = {
        emergingMaxAccountAgeDays: getValidThreshold(
            options.emergingMaxAccountAgeDays,
            DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds.emergingMaxAccountAgeDays
        ),
        emergingMaxTotalListens: getValidThreshold(
            options.emergingMaxTotalListens,
            DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds.emergingMaxTotalListens
        )
    };

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
        .map((stats) => toArtistStats(stats, "emerging", referenceDate))
        .sort(compareArtistPopularity);

    const allArtists: ArtistStats[] = unsegmentedArtists.map((artist) => ({
        ...artist,
        segment: classifyArtistSegment(artist, {
            ...thresholds,
            referenceDate
        })
    }));

    return {
        emerging: allArtists.filter((artist) => artist.segment === "emerging"),
        established: allArtists.filter(
            (artist) => artist.segment === "established"
        ),
        allArtists,
        thresholds
    };
}
