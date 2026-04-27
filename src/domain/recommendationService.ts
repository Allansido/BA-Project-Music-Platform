import fs from "fs";
import readline from "readline";
import { Interaction } from "../data/dataset_modules/lastfmLoader";
import {
    BaselineRecommendationResult,
    RecommendedArtist,
    RecommendedTracks
} from "../data/recommendation_modules/baselineRecommender";
import {
    applyExposureQuotaToArtists,
    applyExposureQuotaToTracks
} from "../data/recommendation_modules/fairnessRecommender";
import {
    ArtistSegment,
    classifyArtistSegment
} from "./artistSegmentation";
import { SafeUser } from "./auth/types";
import { getSafeUserById } from "./auth/authService";
import { DEFAULT_FAIRNESS_CONFIG } from "./fairnessConfig";

const INTERACTIONS_PATH = "dataset/processed/interactions.json";

type ArtistAggregate = {
    artistId: string | null;
    artistName: string;
    playCount: number;
};

type TrackAggregate = {
    trackId: string | null;
    trackName: string;
    artistId: string | null;
    artistName: string;
    playCount: number;
};

type RecommendationIndex = {
    userArtistProfiles: Map<string, Set<string>>;
    artistsByUser: Map<string, Map<string, ArtistAggregate>>;
    tracksByUser: Map<string, Map<string, TrackAggregate>>;
    popularArtists: Map<string, ArtistAggregate>;
    popularTracks: Map<string, TrackAggregate>;
    artistGroups: Map<string, ArtistSegment>;
};

type ArtistScore = {
    artistId: string | null;
    artistName: string;
    score: number;
    supportingNeighbors: number;
};

type TrackScore = {
    trackId: string | null;
    trackName: string;
    artistId: string | null;
    artistName: string;
    score: number;
    supportingNeighbors: number;
};

type ArtistGroupAggregate = {
    artistId: string | null;
    artistName: string;
    playCount: number;
    firstListenedAt: string | null;
    lastListenedAt: string | null;
};

let cachedIndex: RecommendationIndex | null = null;
let cachedIndexPromise: Promise<RecommendationIndex> | null = null;

function normalizeText(value: string | undefined): string {
    return value?.trim() ?? "";
}

function getArtistPreferenceKey(artistName: string | undefined): string {
    return normalizeText(artistName).toLowerCase();
}

function getTrackKey(
    trackId: string | undefined,
    artistName: string | undefined,
    trackName: string | undefined
): string {
    return (
        normalizeText(trackId) ||
        `${normalizeText(artistName)}::${normalizeText(trackName)}`
    );
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

function updateDateRange(
    aggregate: ArtistGroupAggregate,
    timestamp: string
): void {
    const normalizedTimestamp = normalizeText(timestamp);

    if (!normalizedTimestamp) {
        return;
    }

    if (
        !aggregate.firstListenedAt
        || normalizedTimestamp < aggregate.firstListenedAt
    ) {
        aggregate.firstListenedAt = normalizedTimestamp;
    }

    if (
        !aggregate.lastListenedAt
        || normalizedTimestamp > aggregate.lastListenedAt
    ) {
        aggregate.lastListenedAt = normalizedTimestamp;
    }
}

async function streamInteractions(
    onInteraction: (interaction: Interaction) => void
): Promise<void> {
    if (!fs.existsSync(INTERACTIONS_PATH)) {
        return;
    }

    const stream = fs.createReadStream(INTERACTIONS_PATH, { encoding: "utf8" });
    const lineReader = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    try {
        for await (const line of lineReader) {
            const interaction = parseInteractionLine(line);

            if (interaction) {
                onInteraction(interaction);
            }
        }
    } finally {
        lineReader.close();
    }
}

function getUserProfileArtistKeys(user: SafeUser): Set<string> {
    return new Set(
        user.favoriteArtists
            .map((artistName) => getArtistPreferenceKey(artistName))
            .filter(Boolean)
    );
}

async function buildRecommendationIndex(): Promise<RecommendationIndex> {
    const index: RecommendationIndex = {
        userArtistProfiles: new Map<string, Set<string>>(),
        artistsByUser: new Map<string, Map<string, ArtistAggregate>>(),
        tracksByUser: new Map<string, Map<string, TrackAggregate>>(),
        popularArtists: new Map<string, ArtistAggregate>(),
        popularTracks: new Map<string, TrackAggregate>(),
        artistGroups: new Map<string, ArtistSegment>()
    };
    const artistGroupAggregates = new Map<string, ArtistGroupAggregate>();

    await streamInteractions((interaction) => {
        const userId = normalizeText(interaction.userId);
        const artistName = normalizeText(interaction.artistName);
        const artistId = normalizeText(interaction.artistId) || null;
        const artistPreferenceKey = getArtistPreferenceKey(interaction.artistName);

        if (!userId || !artistPreferenceKey || !artistName) {
            return;
        }

        const artistProfile =
            index.userArtistProfiles.get(userId) ?? new Set<string>();
        artistProfile.add(artistPreferenceKey);
        index.userArtistProfiles.set(userId, artistProfile);

        const userArtists =
            index.artistsByUser.get(userId) ?? new Map<string, ArtistAggregate>();
        const currentUserArtist =
            userArtists.get(artistPreferenceKey) ??
            {
                artistId,
                artistName,
                playCount: 0
            };
        currentUserArtist.playCount += 1;
        if (!currentUserArtist.artistId) {
            currentUserArtist.artistId = artistId;
        }
        userArtists.set(artistPreferenceKey, currentUserArtist);
        index.artistsByUser.set(userId, userArtists);

        const currentPopularArtist =
            index.popularArtists.get(artistPreferenceKey) ??
            {
                artistId,
                artistName,
                playCount: 0
            };
        currentPopularArtist.playCount += 1;
        if (!currentPopularArtist.artistId) {
            currentPopularArtist.artistId = artistId;
        }
        index.popularArtists.set(artistPreferenceKey, currentPopularArtist);

        const currentArtistGroupAggregate =
            artistGroupAggregates.get(artistPreferenceKey) ??
            {
                artistId,
                artistName,
                playCount: 0,
                firstListenedAt: null,
                lastListenedAt: null
            };
        currentArtistGroupAggregate.playCount += 1;
        if (!currentArtistGroupAggregate.artistId) {
            currentArtistGroupAggregate.artistId = artistId;
        }
        updateDateRange(currentArtistGroupAggregate, interaction.timestamp);
        artistGroupAggregates.set(
            artistPreferenceKey,
            currentArtistGroupAggregate
        );

        const trackName = normalizeText(interaction.trackName);
        const trackId = normalizeText(interaction.trackId) || null;
        const trackKey = getTrackKey(
            interaction.trackId,
            interaction.artistName,
            interaction.trackName
        );

        if (!trackKey || !trackName || (trackId == null && artistId == null)) {
            return;
        }

        const userTracks =
            index.tracksByUser.get(userId) ?? new Map<string, TrackAggregate>();
        const currentUserTrack =
            userTracks.get(trackKey) ??
            {
                trackId,
                trackName,
                artistId,
                artistName,
                playCount: 0
            };
        currentUserTrack.playCount += 1;
        if (!currentUserTrack.trackId) {
            currentUserTrack.trackId = trackId;
        }
        if (!currentUserTrack.artistId) {
            currentUserTrack.artistId = artistId;
        }
        userTracks.set(trackKey, currentUserTrack);
        index.tracksByUser.set(userId, userTracks);

        const currentPopularTrack =
            index.popularTracks.get(trackKey) ??
            {
                trackId,
                trackName,
                artistId,
                artistName,
                playCount: 0
            };
        currentPopularTrack.playCount += 1;
        if (!currentPopularTrack.trackId) {
            currentPopularTrack.trackId = trackId;
        }
        if (!currentPopularTrack.artistId) {
            currentPopularTrack.artistId = artistId;
        }
        index.popularTracks.set(trackKey, currentPopularTrack);
    });

    for (const [artistPreferenceKey, artist] of artistGroupAggregates) {
        index.artistGroups.set(
            artistPreferenceKey,
            classifyArtistSegment(artist, {
                ...DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds
            })
        );
    }

    return index;
}

async function getRecommendationIndex(): Promise<RecommendationIndex> {
    if (cachedIndex) {
        return cachedIndex;
    }

    cachedIndexPromise ??= buildRecommendationIndex()
        .then((index) => {
            cachedIndex = index;
            return index;
        })
        .finally(() => {
            cachedIndexPromise = null;
        });

    return cachedIndexPromise;
}

function scoreNeighbors(
    userArtistProfiles: Map<string, Set<string>>,
    targetArtistKeys: Set<string>
): Map<string, number> {
    const targetSize = targetArtistKeys.size;

    if (targetSize === 0) {
        return new Map<string, number>();
    }

    const neighbors = new Map<string, number>();

    for (const [userId, artistKeys] of userArtistProfiles) {
        let overlapCount = 0;

        for (const artistKey of targetArtistKeys) {
            if (artistKeys.has(artistKey)) {
                overlapCount += 1;
            }
        }

        if (overlapCount === 0) {
            continue;
        }

        const similarity = overlapCount / Math.sqrt(targetSize * artistKeys.size);
        neighbors.set(userId, similarity);
    }

    return neighbors;
}

function getPopularityFallbackRecommendations(
    index: RecommendationIndex,
    limit: number,
    excludedArtistKeys: Set<string>
): BaselineRecommendationResult {
    const artists = [...index.popularArtists.entries()]
        .filter(([artistKey]) => !excludedArtistKeys.has(artistKey))
        .map(([, artist]) => artist)
        .sort((firstArtist, secondArtist) => secondArtist.playCount - firstArtist.playCount)
        .slice(0, limit)
        .map((artist) => ({
            artistId: artist.artistId,
            artistName: artist.artistName,
            score: artist.playCount,
            reason: "Popular among listeners on the platform"
        }));

    const tracks = [...index.popularTracks.values()]
        .filter((track) => {
            const artistKey = getArtistPreferenceKey(track.artistName);
            return Boolean(artistKey) && !excludedArtistKeys.has(artistKey);
        })
        .sort((firstTrack, secondTrack) => secondTrack.playCount - firstTrack.playCount)
        .slice(0, limit)
        .map((track) => ({
            trackId: track.trackId,
            trackName: track.trackName,
            artistId: track.artistId,
            artistName: track.artistName,
            score: track.playCount,
            reason: "Popular among listeners on the platform"
        }));

    return { artists, tracks };
}

function getPreferenceBasedRecommendations(
    index: RecommendationIndex,
    user: SafeUser,
    limit: number
): BaselineRecommendationResult {
    const targetArtistKeys = getUserProfileArtistKeys(user);

    if (targetArtistKeys.size === 0) {
        return getPopularityFallbackRecommendations(index, limit, targetArtistKeys);
    }

    const neighbors = scoreNeighbors(index.userArtistProfiles, targetArtistKeys);

    if (neighbors.size === 0) {
        return getPopularityFallbackRecommendations(index, limit, targetArtistKeys);
    }

    const artistScores = new Map<string, ArtistScore>();
    const trackScores = new Map<string, TrackScore>();

    for (const [userId, similarity] of neighbors) {
        const userArtists = index.artistsByUser.get(userId);

        if (userArtists) {
            for (const [artistPreferenceKey, artist] of userArtists) {
                if (targetArtistKeys.has(artistPreferenceKey)) {
                    continue;
                }

                const currentArtist =
                    artistScores.get(artistPreferenceKey) ??
                    {
                        artistId: artist.artistId,
                        artistName: artist.artistName,
                        score: 0,
                        supportingNeighbors: 0
                    };

                currentArtist.score += similarity * artist.playCount;
                currentArtist.supportingNeighbors += 1;
                artistScores.set(artistPreferenceKey, currentArtist);
            }
        }

        const userTracks = index.tracksByUser.get(userId);

        if (userTracks) {
            for (const [trackKey, track] of userTracks) {
                const artistKey = getArtistPreferenceKey(track.artistName);

                if (!artistKey || targetArtistKeys.has(artistKey)) {
                    continue;
                }

                const currentTrack =
                    trackScores.get(trackKey) ??
                    {
                        trackId: track.trackId,
                        trackName: track.trackName,
                        artistId: track.artistId,
                        artistName: track.artistName,
                        score: 0,
                        supportingNeighbors: 0
                    };

                currentTrack.score += similarity * track.playCount;
                currentTrack.supportingNeighbors += 1;
                trackScores.set(trackKey, currentTrack);
            }
        }
    }

    const artists = [...artistScores.values()]
        .sort((firstArtist, secondArtist) => secondArtist.score - firstArtist.score)
        .slice(0, limit)
        .map((artist) => ({
            artistId: artist.artistId,
            artistName: artist.artistName,
            score: Number(artist.score.toFixed(2)),
            reason: `Heard by ${artist.supportingNeighbors} similar listeners`
        }));

    const tracks = [...trackScores.values()]
        .sort((firstTrack, secondTrack) => secondTrack.score - firstTrack.score)
        .slice(0, limit)
        .map((track) => ({
            trackId: track.trackId,
            trackName: track.trackName,
            artistId: track.artistId,
            artistName: track.artistName,
            score: Number(track.score.toFixed(2)),
            reason: `Played by ${track.supportingNeighbors} similar listeners`
        }));

    if (artists.length === 0 && tracks.length === 0) {
        return getPopularityFallbackRecommendations(index, limit, targetArtistKeys);
    }

    return { artists, tracks };
}

function getCreatorGroupForArtist(
    artistName: string,
    index: RecommendationIndex
): ArtistSegment {
    const artistPreferenceKey = getArtistPreferenceKey(artistName);
    return index.artistGroups.get(artistPreferenceKey) ?? "established";
}

function attachCreatorGroups(
    recommendations: BaselineRecommendationResult,
    index: RecommendationIndex
): {
    artists: RecommendedArtist[];
    tracks: RecommendedTracks[];
} {
    return {
        artists: recommendations.artists.map((artist) => ({
            ...artist,
            creatorGroup: getCreatorGroupForArtist(artist.artistName, index)
        })),
        tracks: recommendations.tracks.map((track) => ({
            ...track,
            creatorGroup: getCreatorGroupForArtist(track.artistName, index)
        }))
    };
}

export async function getRecommendationsForUser(
    userId: string,
    limit = 10
): Promise<BaselineRecommendationResult> {
    const user = await getSafeUserById(userId);

    if (!user) {
        throw new Error("Could not load the signed-in user profile.");
    }

    const index = await getRecommendationIndex();
    const candidatePoolSize = Math.max(
        limit,
        DEFAULT_FAIRNESS_CONFIG.candidatePoolSize,
        DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule.topN
    );
    const baselineRecommendations = getPreferenceBasedRecommendations(
        index,
        user,
        candidatePoolSize
    );
    const recommendationsWithGroups = attachCreatorGroups(
        baselineRecommendations,
        index
    );
    const artistQuotaResult = applyExposureQuotaToArtists(
        recommendationsWithGroups.artists,
        DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule
    );
    const trackQuotaResult = applyExposureQuotaToTracks(
        recommendationsWithGroups.tracks,
        DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule
    );

    return {
        artists: artistQuotaResult.artists.slice(0, limit),
        tracks: trackQuotaResult.tracks.slice(0, limit),
        fairness: {
            enabled: DEFAULT_FAIRNESS_CONFIG.enabled,
            candidatePoolSize,
            topN: DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule.topN,
            minimumExposureByGroup:
                DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule.minimumExposureByGroup,
            prefixCheckpoints:
                DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule.prefixCheckpoints,
            creatorGroupThresholds:
                DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds,
            artists: artistQuotaResult.evaluation,
            tracks: trackQuotaResult.evaluation
        }
    };
}
