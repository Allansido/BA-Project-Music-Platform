import { Interaction } from "../../dataset_modules/lastfmLoader";
import {
    RecommendedArtist,
    RecommendedTracks
} from "../../recommendation_modules/baselineRecommender";
import { SafeUser } from "../../../domain/auth/types";
import {
    createRecommendationIndex,
    getRecommendationsForProfile,
    RecommendationIndex
} from "../../../domain/recommendationService";

interface PrecisionAtNUserSplit {
    userId: string;
    totalInteractions: number;
    trainInteractions: Interaction[];
    testInteractions: Interaction[];
}

interface PrecisionAtNEntityUserResult {
    precisionAtN: number;
    weightedPrecisionAtN: number;
    hitCount: number;
    weightedHitCount: number;
    relevantUniqueCount: number;
    relevantListenCount: number;
    recommendedCount: number;
}

export interface PrecisionAtNUserResult {
    userId: string;
    totalInteractions: number;
    trainInteractions: number;
    testInteractions: number;
    artistPrecisionAtN: number;
    artistWeightedPrecisionAtN: number;
    artistHitCount: number;
    artistRelevantUniqueCount: number;
    artistRelevantListenCount: number;
    artistRecommendedCount: number;
    trackPrecisionAtN: number;
    trackWeightedPrecisionAtN: number;
    trackHitCount: number;
    trackRelevantUniqueCount: number;
    trackRelevantListenCount: number;
    trackRecommendedCount: number;
}

export interface PrecisionAtNEntitySummary {
    averagePrecisionAtN: number;
    averageWeightedPrecisionAtN: number;
    averageHitCount: number;
    averageRelevantUniqueCount: number;
    averageRelevantListenCount: number;
    averageRecommendedCount: number;
}

export interface PrecisionAtNSkipSummary {
    belowActivityThreshold: number;
    insufficientTrainWindow: number;
    insufficientTestWindow: number;
    missingDerivedProfile: number;
}

export interface PrecisionAtNEvaluationResult {
    topN: number;
    testRatio: number;
    minimumUserActivityThreshold: number;
    evaluatedUsers: number;
    skippedUsers: PrecisionAtNSkipSummary;
    artists: PrecisionAtNEntitySummary;
    tracks: PrecisionAtNEntitySummary;
    users: PrecisionAtNUserResult[];
}

export interface PrecisionAtNOptions {
    topN?: number;
    testRatio?: number;
    minimumUserActivityThreshold?: number;
    minimumTrainInteractions?: number;
    minimumTestInteractions?: number;
    favoriteArtistCount?: number;
    genreCount?: number;
    applyFairness?: boolean;
    discoveryGoal?: string;
}

type RankedRecommendation = RecommendedArtist | RecommendedTracks;

type NormalizedPrecisionAtNOptions = {
    topN: number;
    testRatio: number;
    minimumUserActivityThreshold: number;
    minimumTrainInteractions: number;
    minimumTestInteractions: number;
    favoriteArtistCount: number;
    genreCount: number;
    applyFairness: boolean;
    discoveryGoal: string;
};

const DEFAULT_OPTIONS: NormalizedPrecisionAtNOptions = {
    topN: 10,
    testRatio: 0.2,
    minimumUserActivityThreshold: 10,
    minimumTrainInteractions: 1,
    minimumTestInteractions: 1,
    favoriteArtistCount: 5,
    genreCount: 3,
    applyFairness: true,
    discoveryGoal: "recommend similar music"
};

function normalizeText(value: string | undefined): string {
    return value?.trim() ?? "";
}

function getArtistKey(interaction: Pick<Interaction, "artistName">): string {
    return normalizeText(interaction.artistName).toLowerCase();
}

function getTrackKey(
    interaction: Pick<Interaction, "trackId" | "artistName" | "trackName">
): string {
    return (
        normalizeText(interaction.trackId) ||
        `${normalizeText(interaction.artistName)}::${normalizeText(interaction.trackName)}`
    );
}

function getArtistRecommendationKey(artist: RecommendedArtist): string {
    return normalizeText(artist.artistName).toLowerCase();
}

function getTrackRecommendationKey(track: RecommendedTracks): string {
    return (
        normalizeText(track.trackId ?? undefined) ||
        `${normalizeText(track.artistName)}::${normalizeText(track.trackName)}`
    );
}

function normalizeOptions(
    options: PrecisionAtNOptions = {}
): NormalizedPrecisionAtNOptions {
    const topN = Math.max(1, Math.floor(options.topN ?? DEFAULT_OPTIONS.topN));
    const testRatio = options.testRatio ?? DEFAULT_OPTIONS.testRatio;

    return {
        topN,
        testRatio: Math.min(0.9, Math.max(0.05, testRatio)),
        minimumUserActivityThreshold: Math.max(
            2,
            Math.floor(
                options.minimumUserActivityThreshold ??
                    DEFAULT_OPTIONS.minimumUserActivityThreshold
            )
        ),
        minimumTrainInteractions: Math.max(
            1,
            Math.floor(
                options.minimumTrainInteractions ??
                    DEFAULT_OPTIONS.minimumTrainInteractions
            )
        ),
        minimumTestInteractions: Math.max(
            1,
            Math.floor(
                options.minimumTestInteractions ??
                    DEFAULT_OPTIONS.minimumTestInteractions
            )
        ),
        favoriteArtistCount: Math.max(
            1,
            Math.floor(
                options.favoriteArtistCount ??
                    DEFAULT_OPTIONS.favoriteArtistCount
            )
        ),
        genreCount: Math.max(
            1,
            Math.floor(options.genreCount ?? DEFAULT_OPTIONS.genreCount)
        ),
        applyFairness: options.applyFairness ?? DEFAULT_OPTIONS.applyFairness,
        discoveryGoal: normalizeText(options.discoveryGoal) ||
            DEFAULT_OPTIONS.discoveryGoal
    };
}

function parseTimestampValue(timestamp: string): number | null {
    const normalizedTimestamp = normalizeText(timestamp);

    if (!normalizedTimestamp) {
        return null;
    }

    const numericTimestamp = Number(normalizedTimestamp);

    if (Number.isFinite(numericTimestamp)) {
        return numericTimestamp;
    }

    const dateTimestamp = Date.parse(normalizedTimestamp);
    return Number.isFinite(dateTimestamp) ? dateTimestamp : null;
}

function compareInteractionsChronologically(
    firstInteraction: Interaction,
    secondInteraction: Interaction
): number {
    const firstTimestamp = parseTimestampValue(firstInteraction.timestamp);
    const secondTimestamp = parseTimestampValue(secondInteraction.timestamp);

    if (
        firstTimestamp != null &&
        secondTimestamp != null &&
        firstTimestamp !== secondTimestamp
    ) {
        return firstTimestamp - secondTimestamp;
    }

    const firstTimestampText = normalizeText(firstInteraction.timestamp);
    const secondTimestampText = normalizeText(secondInteraction.timestamp);

    if (firstTimestampText !== secondTimestampText) {
        return firstTimestampText.localeCompare(secondTimestampText);
    }

    const firstArtistKey = getArtistKey(firstInteraction);
    const secondArtistKey = getArtistKey(secondInteraction);

    if (firstArtistKey !== secondArtistKey) {
        return firstArtistKey.localeCompare(secondArtistKey);
    }

    return getTrackKey(firstInteraction).localeCompare(
        getTrackKey(secondInteraction)
    );
}

function getAverage(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return Number((total / values.length).toFixed(4));
}

function buildUserInteractionGroups(
    interactions: Interaction[]
): Map<string, Interaction[]> {
    const groups = new Map<string, Interaction[]>();

    for (const interaction of interactions) {
        const userId = normalizeText(interaction.userId);

        if (!userId) {
            continue;
        }

        const userInteractions = groups.get(userId) ?? [];
        userInteractions.push(interaction);
        groups.set(userId, userInteractions);
    }

    for (const userInteractions of groups.values()) {
        userInteractions.sort(compareInteractionsChronologically);
    }

    return groups;
}

function getSplitIndex(
    interactionCount: number,
    options: NormalizedPrecisionAtNOptions
): number | null {
    const requiredInteractionCount = Math.max(
        options.minimumUserActivityThreshold,
        options.minimumTrainInteractions + options.minimumTestInteractions
    );

    if (interactionCount < requiredInteractionCount) {
        return null;
    }

    const desiredTestCount = Math.max(
        options.minimumTestInteractions,
        Math.ceil(interactionCount * options.testRatio)
    );
    const maxTestCount = interactionCount - options.minimumTrainInteractions;
    const actualTestCount = Math.min(desiredTestCount, maxTestCount);
    const splitIndex = interactionCount - actualTestCount;

    if (splitIndex < options.minimumTrainInteractions) {
        return null;
    }

    if (actualTestCount < options.minimumTestInteractions) {
        return null;
    }

    return splitIndex;
}

function buildRelevantCounts(
    interactions: Interaction[],
    favoriteArtistKeys: Set<string>
): {
    artistCounts: Map<string, number>;
    trackCounts: Map<string, number>;
} {
    const artistCounts = new Map<string, number>();
    const trackCounts = new Map<string, number>();

    for (const interaction of interactions) {
        const artistKey = getArtistKey(interaction);

        if (!artistKey || favoriteArtistKeys.has(artistKey)) {
            continue;
        }

        artistCounts.set(artistKey, (artistCounts.get(artistKey) ?? 0) + 1);

        const trackKey = getTrackKey(interaction);
        const trackName = normalizeText(interaction.trackName);

        if (!trackKey || !trackName) {
            continue;
        }

        trackCounts.set(trackKey, (trackCounts.get(trackKey) ?? 0) + 1);
    }

    return { artistCounts, trackCounts };
}

function evaluateRecommendationList<T extends RankedRecommendation>(
    recommendations: T[],
    relevantCounts: Map<string, number>,
    topN: number,
    getKey: (recommendation: T) => string
): PrecisionAtNEntityUserResult {
    const uniqueRelevantCounts = [...relevantCounts.values()];
    const maxRelevantCount = Math.max(0, ...uniqueRelevantCounts);
    const seenRecommendationKeys = new Set<string>();
    let hitCount = 0;
    let weightedHitCount = 0;

    for (const recommendation of recommendations.slice(0, topN)) {
        const key = getKey(recommendation);

        if (!key || seenRecommendationKeys.has(key)) {
            continue;
        }

        seenRecommendationKeys.add(key);
        const repeatCount = relevantCounts.get(key) ?? 0;

        if (repeatCount <= 0) {
            continue;
        }

        hitCount += 1;
        weightedHitCount += maxRelevantCount > 0
            ? repeatCount / maxRelevantCount
            : 0;
    }

    return {
        precisionAtN: Number((hitCount / topN).toFixed(4)),
        weightedPrecisionAtN: Number((weightedHitCount / topN).toFixed(4)),
        hitCount,
        weightedHitCount: Number(weightedHitCount.toFixed(4)),
        relevantUniqueCount: relevantCounts.size,
        relevantListenCount: uniqueRelevantCounts.reduce(
            (sum, count) => sum + count,
            0
        ),
        recommendedCount: recommendations.slice(0, topN).length
    };
}

function buildDerivedUserProfile(
    userId: string,
    interactions: Interaction[],
    index: RecommendationIndex,
    options: NormalizedPrecisionAtNOptions
): SafeUser | null {
    const artistCounts = new Map<
        string,
        { artistName: string; playCount: number }
    >();

    for (const interaction of interactions) {
        const artistKey = getArtistKey(interaction);
        const artistName = normalizeText(interaction.artistName);

        if (!artistKey || !artistName) {
            continue;
        }

        const currentArtist = artistCounts.get(artistKey) ?? {
            artistName,
            playCount: 0
        };
        currentArtist.playCount += 1;
        artistCounts.set(artistKey, currentArtist);
    }

    const favoriteArtists = [...artistCounts.values()]
        .sort(
            (firstArtist, secondArtist) =>
                secondArtist.playCount - firstArtist.playCount ||
                firstArtist.artistName.localeCompare(secondArtist.artistName)
        )
        .slice(0, options.favoriteArtistCount)
        .map((artist) => artist.artistName);

    if (favoriteArtists.length === 0) {
        return null;
    }

    const genreScores = new Map<string, number>();

    for (const [artistKey, artist] of artistCounts) {
        const artistGenres = index.artistGenres.get(artistKey) ?? [];

        for (const artistGenre of artistGenres) {
            const currentScore = genreScores.get(artistGenre.genre) ?? 0;
            genreScores.set(
                artistGenre.genre,
                currentScore + artistGenre.score * artist.playCount
            );
        }
    }

    const genres = [...genreScores.entries()]
        .sort(
            (firstGenre, secondGenre) =>
                secondGenre[1] - firstGenre[1] ||
                firstGenre[0].localeCompare(secondGenre[0])
        )
        .slice(0, options.genreCount)
        .map(([genre]) => genre);

    return {
        id: userId,
        name: `Offline Evaluation ${userId}`,
        email: `${userId}@offline-evaluation.local`,
        role: "listener",
        genres,
        favoriteArtists,
        roleDetails: {
            listener: {
                discoveryGoal: options.discoveryGoal
            }
        }
    };
}

function summarizeEntity(
    userResults: PrecisionAtNUserResult[],
    metric: "artist" | "track"
): PrecisionAtNEntitySummary {
    if (metric === "artist") {
        return {
            averagePrecisionAtN: getAverage(
                userResults.map((result) => result.artistPrecisionAtN)
            ),
            averageWeightedPrecisionAtN: getAverage(
                userResults.map((result) => result.artistWeightedPrecisionAtN)
            ),
            averageHitCount: getAverage(
                userResults.map((result) => result.artistHitCount)
            ),
            averageRelevantUniqueCount: getAverage(
                userResults.map((result) => result.artistRelevantUniqueCount)
            ),
            averageRelevantListenCount: getAverage(
                userResults.map((result) => result.artistRelevantListenCount)
            ),
            averageRecommendedCount: getAverage(
                userResults.map((result) => result.artistRecommendedCount)
            )
        };
    }

    return {
        averagePrecisionAtN: getAverage(
            userResults.map((result) => result.trackPrecisionAtN)
        ),
        averageWeightedPrecisionAtN: getAverage(
            userResults.map((result) => result.trackWeightedPrecisionAtN)
        ),
        averageHitCount: getAverage(
            userResults.map((result) => result.trackHitCount)
        ),
        averageRelevantUniqueCount: getAverage(
            userResults.map((result) => result.trackRelevantUniqueCount)
        ),
        averageRelevantListenCount: getAverage(
            userResults.map((result) => result.trackRelevantListenCount)
        ),
        averageRecommendedCount: getAverage(
            userResults.map((result) => result.trackRecommendedCount)
        )
    };
}

export class PrecisionAtNMetric {
    private readonly options: NormalizedPrecisionAtNOptions;

    constructor(options: PrecisionAtNOptions = {}) {
        this.options = normalizeOptions(options);
    }

    evaluate(interactions: Interaction[]): PrecisionAtNEvaluationResult {
        const userGroups = buildUserInteractionGroups(interactions);
        const userSplits: PrecisionAtNUserSplit[] = [];
        const skippedUsers: PrecisionAtNSkipSummary = {
            belowActivityThreshold: 0,
            insufficientTrainWindow: 0,
            insufficientTestWindow: 0,
            missingDerivedProfile: 0
        };
        const trainingInteractions: Interaction[] = [];

        for (const [userId, userInteractions] of userGroups) {
            const splitIndex = getSplitIndex(userInteractions.length, this.options);

            if (splitIndex == null) {
                skippedUsers.belowActivityThreshold += 1;
                continue;
            }

            const trainInteractions = userInteractions.slice(0, splitIndex);
            const testInteractions = userInteractions.slice(splitIndex);

            if (trainInteractions.length < this.options.minimumTrainInteractions) {
                skippedUsers.insufficientTrainWindow += 1;
                continue;
            }

            if (testInteractions.length < this.options.minimumTestInteractions) {
                skippedUsers.insufficientTestWindow += 1;
                continue;
            }

            userSplits.push({
                userId,
                totalInteractions: userInteractions.length,
                trainInteractions,
                testInteractions
            });
            trainingInteractions.push(...trainInteractions);
        }

        const recommendationIndex = createRecommendationIndex(trainingInteractions);
        const results: PrecisionAtNUserResult[] = [];

        for (const userSplit of userSplits) {
            const profile = buildDerivedUserProfile(
                userSplit.userId,
                userSplit.trainInteractions,
                recommendationIndex,
                this.options
            );

            if (!profile) {
                skippedUsers.missingDerivedProfile += 1;
                continue;
            }

            const recommendations = getRecommendationsForProfile(
                profile,
                this.options.topN,
                recommendationIndex,
                {
                    applyFairness: this.options.applyFairness
                }
            );
            const favoriteArtistKeys = new Set(
                profile.favoriteArtists.map((artistName) =>
                    normalizeText(artistName).toLowerCase()
                )
            );
            const relevantCounts = buildRelevantCounts(
                userSplit.testInteractions,
                favoriteArtistKeys
            );
            const artistMetrics = evaluateRecommendationList(
                recommendations.artists,
                relevantCounts.artistCounts,
                this.options.topN,
                getArtistRecommendationKey
            );
            const trackMetrics = evaluateRecommendationList(
                recommendations.tracks,
                relevantCounts.trackCounts,
                this.options.topN,
                getTrackRecommendationKey
            );

            results.push({
                userId: userSplit.userId,
                totalInteractions: userSplit.totalInteractions,
                trainInteractions: userSplit.trainInteractions.length,
                testInteractions: userSplit.testInteractions.length,
                artistPrecisionAtN: artistMetrics.precisionAtN,
                artistWeightedPrecisionAtN: artistMetrics.weightedPrecisionAtN,
                artistHitCount: artistMetrics.hitCount,
                artistRelevantUniqueCount: artistMetrics.relevantUniqueCount,
                artistRelevantListenCount: artistMetrics.relevantListenCount,
                artistRecommendedCount: artistMetrics.recommendedCount,
                trackPrecisionAtN: trackMetrics.precisionAtN,
                trackWeightedPrecisionAtN: trackMetrics.weightedPrecisionAtN,
                trackHitCount: trackMetrics.hitCount,
                trackRelevantUniqueCount: trackMetrics.relevantUniqueCount,
                trackRelevantListenCount: trackMetrics.relevantListenCount,
                trackRecommendedCount: trackMetrics.recommendedCount
            });
        }

        return {
            topN: this.options.topN,
            testRatio: this.options.testRatio,
            minimumUserActivityThreshold:
                this.options.minimumUserActivityThreshold,
            evaluatedUsers: results.length,
            skippedUsers,
            artists: summarizeEntity(results, "artist"),
            tracks: summarizeEntity(results, "track"),
            users: results
        };
    }
}
