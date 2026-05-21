import fs from "fs";
import readline from "readline";
import { Interaction } from "../../data/dataset_modules/lastfmLoader";
import { ExposureDisparityMetric } from "../../data/metrics_evaluator/fairness_metrics/exposureDisparity";
import { ExposureShareMetric } from "../../data/metrics_evaluator/fairness_metrics/exposureShare";
import { FairnessDeviationMetric } from "../../data/metrics_evaluator/fairness_metrics/fairnessDeviation";
import { NdcgAtNMetric } from "../../data/metrics_evaluator/relevance_metrics/ndcg@n";
import { PrecisionAtNMetric } from "../../data/metrics_evaluator/relevance_metrics/precision@n";
import {
    BaselineRecommendationResult,
    ExposureCountSummary,
    RecommendedArtist,
    RecommendedTracks
} from "../../data/recommendation_modules/baselineRecommender";
import {
    ArtistSegment,
    ArtistStats,
    classifyArtistSegment
} from "../fairness_artist_logic/artistSegmentation";
import { SafeUser } from "../authentication/types";
import { DEFAULT_FAIRNESS_CONFIG } from "../fairness_artist_logic/fairnessConfig";
import {
    createRecommendationIndex,
    getRecommendationsForProfile,
    RecommendationIndex
} from "../recommendation_management/recommendationService";

const INTERACTIONS_PATH = "dataset/processed/interactions.json";
const ARTIST_SEGMENTS_PATH = "dataset/processed/artistSegments.json";
const DEFAULT_TOP_N = 10;
const DEFAULT_SAMPLE_USERS = 25;
const DEFAULT_MAX_INTERACTIONS = 12000;
const DEFAULT_MAX_INTERACTIONS_PER_USER = 500;
const DEFAULT_TEST_RATIO = 0.2;
const DEFAULT_FAVORITE_ARTIST_COUNT = 5;
const DEFAULT_GENRE_COUNT = 3;

type EvaluationMode = "baseline" | "fairnessAware";

interface EvaluationSample {
    interactions: Interaction[];
    sampledUsers: number;
}

export interface RelevanceMetricEntityOverview {
    precisionAtN: number;
    weightedPrecisionAtN: number;
    ndcgAtN: number;
}

export interface RelevanceMetricModeOverview {
    evaluatedUsers: number;
    skippedUsers: number;
    artists: RelevanceMetricEntityOverview;
    tracks: RelevanceMetricEntityOverview;
}

export interface FairnessMetricEntityOverview {
    exposureByGroup: ExposureCountSummary;
    exposureShare: Record<ArtistSegment, number>;
    exposureDisparity: number;
    fairnessDeviation: number;
    missingExposureByGroup: ExposureCountSummary;
    targetExposureByGroup: ExposureCountSummary;
    quotaSatisfied: boolean;
}

export interface FairnessMetricModeOverview {
    evaluatedUsers: number;
    artists: FairnessMetricEntityOverview;
    tracks: FairnessMetricEntityOverview;
}

export interface RecommendationEvaluationOverview {
    topN: number;
    sampleUsers: number;
    sampleInteractions: number;
    relevance: Record<EvaluationMode, RelevanceMetricModeOverview>;
    fairness: Record<EvaluationMode, FairnessMetricModeOverview>;
}

let cachedEvaluationOverview: RecommendationEvaluationOverview | null = null;
let cachedEvaluationPromise: Promise<RecommendationEvaluationOverview> | null = null;
let cachedArtistSegmentMap: Map<string, ArtistSegment> | null = null;

function normalizeText(value: string | undefined): string {
    return value?.trim() ?? "";
}

function parseInteger(value: string | undefined, fallback: number): number {
    const parsedValue = Number.parseInt(value ?? "", 10);

    return Number.isFinite(parsedValue) && parsedValue > 0
        ? parsedValue
        : fallback;
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

function compareInteractionsChronologically(
    firstInteraction: Interaction,
    secondInteraction: Interaction
): number {
    return firstInteraction.timestamp.localeCompare(secondInteraction.timestamp);
}

function createEmptyCounts(): ExposureCountSummary {
    return {
        emerging: 0,
        established: 0
    };
}

function getCreatorGroup(
    item: Pick<RecommendedArtist | RecommendedTracks, "creatorGroup">
): ArtistSegment {
    return item.creatorGroup ?? "established";
}

async function loadEvaluationSample(): Promise<EvaluationSample> {
    if (!fs.existsSync(INTERACTIONS_PATH)) {
        return {
            interactions: [],
            sampledUsers: 0
        };
    }

    const sampleUsers = parseInteger(
        process.env.EVALUATION_SAMPLE_USERS,
        DEFAULT_SAMPLE_USERS
    );
    const maxInteractions = parseInteger(
        process.env.EVALUATION_MAX_INTERACTIONS,
        DEFAULT_MAX_INTERACTIONS
    );
    const maxInteractionsPerUser = parseInteger(
        process.env.EVALUATION_MAX_INTERACTIONS_PER_USER,
        DEFAULT_MAX_INTERACTIONS_PER_USER
    );
    const selectedUsers = new Set<string>();
    const interactionsPerUser = new Map<string, number>();
    const interactions: Interaction[] = [];
    const stream = fs.createReadStream(INTERACTIONS_PATH, { encoding: "utf8" });
    const lineReader = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    try {
        for await (const line of lineReader) {
            if (interactions.length >= maxInteractions) {
                break;
            }

            const interaction = parseInteractionLine(line);

            if (!interaction) {
                continue;
            }

            const userId = normalizeText(interaction.userId);

            if (!userId) {
                continue;
            }

            if (!selectedUsers.has(userId)) {
                if (selectedUsers.size >= sampleUsers) {
                    break;
                }

                selectedUsers.add(userId);
            }

            const currentUserInteractionCount =
                interactionsPerUser.get(userId) ?? 0;

            if (currentUserInteractionCount >= maxInteractionsPerUser) {
                continue;
            }

            interactionsPerUser.set(userId, currentUserInteractionCount + 1);
            interactions.push(interaction);
        }
    } finally {
        lineReader.close();
    }

    return {
        interactions,
        sampledUsers: selectedUsers.size
    };
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

function getTrainInteractions(interactions: Interaction[]): Interaction[] {
    if (interactions.length < 10) {
        return [];
    }

    const testCount = Math.max(1, Math.ceil(interactions.length * DEFAULT_TEST_RATIO));
    const splitIndex = interactions.length - testCount;

    return splitIndex > 0 ? interactions.slice(0, splitIndex) : [];
}

function getArtistPreferenceKey(artistName: string | undefined): string {
    return normalizeText(artistName).toLowerCase();
}

function loadReclassifiedArtistSegments(): Map<string, ArtistSegment> {
    if (cachedArtistSegmentMap) {
        return cachedArtistSegmentMap;
    }

    const artistSegmentMap = new Map<string, ArtistSegment>();

    if (!fs.existsSync(ARTIST_SEGMENTS_PATH)) {
        cachedArtistSegmentMap = artistSegmentMap;
        return artistSegmentMap;
    }

    const segmentData = JSON.parse(
        fs.readFileSync(ARTIST_SEGMENTS_PATH, "utf8")
    ) as { allArtists?: ArtistStats[] };
    const allArtists = segmentData.allArtists ?? [];
    const latestInteractionAt = allArtists.reduce<string | null>(
        (latestTimestamp, artist) => {
            if (!artist.lastListenedAt) {
                return latestTimestamp;
            }

            return !latestTimestamp || artist.lastListenedAt > latestTimestamp
                ? artist.lastListenedAt
                : latestTimestamp;
        },
        null
    );
    const referenceDate = latestInteractionAt
        ? new Date(latestInteractionAt)
        : new Date();

    for (const artist of allArtists) {
        const artistNameKey = getArtistPreferenceKey(artist.artistName);
        const segment = classifyArtistSegment(artist, {
            ...DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds,
            referenceDate
        });

        if (artistNameKey) {
            artistSegmentMap.set(artistNameKey, segment);
        }

        if (artist.artistKey) {
            artistSegmentMap.set(artist.artistKey, segment);
        }

        if (artist.artistId) {
            artistSegmentMap.set(artist.artistId, segment);
        }
    }

    cachedArtistSegmentMap = artistSegmentMap;
    return artistSegmentMap;
}

function applyFullDatasetArtistSegments(index: RecommendationIndex): void {
    const artistSegmentMap = loadReclassifiedArtistSegments();

    for (const [artistKey, segment] of artistSegmentMap) {
        index.artistGroups.set(artistKey, segment);
    }
}

function buildDerivedUserProfile(
    userId: string,
    trainInteractions: Interaction[],
    index: RecommendationIndex
): SafeUser | null {
    const artistCounts = new Map<
        string,
        { artistName: string; playCount: number }
    >();

    for (const interaction of trainInteractions) {
        const artistKey = getArtistPreferenceKey(interaction.artistName);
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
        .slice(0, DEFAULT_FAVORITE_ARTIST_COUNT)
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
        .slice(0, DEFAULT_GENRE_COUNT)
        .map(([genre]) => genre);

    return {
        id: userId,
        name: `Evaluation ${userId}`,
        email: `${userId}@evaluation.local`,
        role: "listener",
        genres,
        favoriteArtists,
        roleDetails: {
            listener: {
                discoveryGoal: "recommend similar music"
            }
        }
    };
}

function summarizeRelevanceMetrics(input: {
    precision: ReturnType<PrecisionAtNMetric["evaluate"]>;
    ndcg: ReturnType<NdcgAtNMetric["evaluate"]>;
}): RelevanceMetricModeOverview {
    const skippedUsers =
        input.precision.skippedUsers.belowActivityThreshold +
        input.precision.skippedUsers.insufficientTrainWindow +
        input.precision.skippedUsers.insufficientTestWindow +
        input.precision.skippedUsers.missingDerivedProfile;

    return {
        evaluatedUsers: input.precision.evaluatedUsers,
        skippedUsers,
        artists: {
            precisionAtN: input.precision.artists.averagePrecisionAtN,
            weightedPrecisionAtN:
                input.precision.artists.averageWeightedPrecisionAtN,
            ndcgAtN: input.ndcg.artists.averageNdcgAtN
        },
        tracks: {
            precisionAtN: input.precision.tracks.averagePrecisionAtN,
            weightedPrecisionAtN:
                input.precision.tracks.averageWeightedPrecisionAtN,
            ndcgAtN: input.ndcg.tracks.averageNdcgAtN
        }
    };
}

function countRecommendationExposure(
    recommendations: RecommendedArtist[] | RecommendedTracks[]
): ExposureCountSummary {
    return recommendations.reduce((counts, recommendation) => {
        counts[getCreatorGroup(recommendation)] += 1;
        return counts;
    }, createEmptyCounts());
}

function addExposureCounts(
    firstCounts: ExposureCountSummary,
    secondCounts: ExposureCountSummary
): ExposureCountSummary {
    return {
        emerging: firstCounts.emerging + secondCounts.emerging,
        established: firstCounts.established + secondCounts.established
    };
}

function summarizeFairnessEntity(input: {
    exposureByGroup: ExposureCountSummary;
    evaluatedLists: number;
}): FairnessMetricEntityOverview {
    const exposureShare = new ExposureShareMetric().evaluate(
        input.exposureByGroup
    );
    const exposureDisparity = new ExposureDisparityMetric().evaluate(
        exposureShare
    );
    const fairnessDeviation = new FairnessDeviationMetric().evaluate({
        exposureByGroup: input.exposureByGroup,
        rule: DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule,
        evaluatedLists: input.evaluatedLists
    });

    return {
        exposureByGroup: input.exposureByGroup,
        exposureShare: exposureShare.shareByGroup,
        exposureDisparity: exposureDisparity.disparity,
        fairnessDeviation: fairnessDeviation.deviationShare,
        missingExposureByGroup: fairnessDeviation.missingExposureByGroup,
        targetExposureByGroup: fairnessDeviation.targetExposureByGroup,
        quotaSatisfied: fairnessDeviation.quotaSatisfied
    };
}

function getRecommendationsForEvaluationMode(input: {
    mode: EvaluationMode;
    profile: SafeUser;
    index: RecommendationIndex;
}): BaselineRecommendationResult {
    return getRecommendationsForProfile(
        input.profile,
        DEFAULT_TOP_N,
        input.index,
        {
            applyFairness: input.mode === "fairnessAware",
            candidatePoolSize: DEFAULT_FAIRNESS_CONFIG.candidatePoolSize
        }
    );
}

function evaluateFairnessForMode(input: {
    mode: EvaluationMode;
    interactions: Interaction[];
    index: RecommendationIndex;
}): FairnessMetricModeOverview {
    const userGroups = buildUserInteractionGroups(input.interactions);
    let evaluatedUsers = 0;
    let artistExposure = createEmptyCounts();
    let trackExposure = createEmptyCounts();

    for (const [userId, userInteractions] of userGroups) {
        const trainInteractions = getTrainInteractions(userInteractions);
        const profile = buildDerivedUserProfile(
            userId,
            trainInteractions,
            input.index
        );

        if (!profile) {
            continue;
        }

        const recommendations = getRecommendationsForEvaluationMode({
            mode: input.mode,
            profile,
            index: input.index
        });

        artistExposure = addExposureCounts(
            artistExposure,
            countRecommendationExposure(recommendations.artists.slice(0, DEFAULT_TOP_N))
        );
        trackExposure = addExposureCounts(
            trackExposure,
            countRecommendationExposure(recommendations.tracks.slice(0, DEFAULT_TOP_N))
        );
        evaluatedUsers += 1;
    }

    return {
        evaluatedUsers,
        artists: summarizeFairnessEntity({
            exposureByGroup: artistExposure,
            evaluatedLists: evaluatedUsers
        }),
        tracks: summarizeFairnessEntity({
            exposureByGroup: trackExposure,
            evaluatedLists: evaluatedUsers
        })
    };
}

async function buildRecommendationEvaluationOverview():
    Promise<RecommendationEvaluationOverview> {
    const sample = await loadEvaluationSample();
    const precisionBaseline = new PrecisionAtNMetric({
        topN: DEFAULT_TOP_N,
        applyFairness: false
    }).evaluate(sample.interactions);
    const precisionFairnessAware = new PrecisionAtNMetric({
        topN: DEFAULT_TOP_N,
        applyFairness: true
    }).evaluate(sample.interactions);
    const ndcgBaseline = new NdcgAtNMetric({
        topN: DEFAULT_TOP_N,
        applyFairness: false
    }).evaluate(sample.interactions);
    const ndcgFairnessAware = new NdcgAtNMetric({
        topN: DEFAULT_TOP_N,
        applyFairness: true
    }).evaluate(sample.interactions);
    const recommendationIndex = createRecommendationIndex(sample.interactions);
    applyFullDatasetArtistSegments(recommendationIndex);

    return {
        topN: DEFAULT_TOP_N,
        sampleUsers: sample.sampledUsers,
        sampleInteractions: sample.interactions.length,
        relevance: {
            baseline: summarizeRelevanceMetrics({
                precision: precisionBaseline,
                ndcg: ndcgBaseline
            }),
            fairnessAware: summarizeRelevanceMetrics({
                precision: precisionFairnessAware,
                ndcg: ndcgFairnessAware
            })
        },
        fairness: {
            baseline: evaluateFairnessForMode({
                mode: "baseline",
                interactions: sample.interactions,
                index: recommendationIndex
            }),
            fairnessAware: evaluateFairnessForMode({
                mode: "fairnessAware",
                interactions: sample.interactions,
                index: recommendationIndex
            })
        }
    };
}

export function getRecommendationEvaluationOverview():
    Promise<RecommendationEvaluationOverview> {
    if (cachedEvaluationOverview) {
        return Promise.resolve(cachedEvaluationOverview);
    }

    cachedEvaluationPromise ??= buildRecommendationEvaluationOverview()
        .then((overview) => {
            cachedEvaluationOverview = overview;
            return overview;
        })
        .finally(() => {
            cachedEvaluationPromise = null;
        });

    return cachedEvaluationPromise;
}
