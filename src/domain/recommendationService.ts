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
import {
    ArtistGenreScore,
    ArtistTagIndex,
    mapLastFmTagsToGenres
} from "./artistTagMapping";

const INTERACTIONS_PATH = "dataset/processed/interactions.json";
const ARTIST_TAGS_PATH = "dataset/processed/artistTags.json";

const RECOMMENDATION_WEIGHTS = {
    genre: 0.5,
    goal: 0.25,
    history: 0.15,
    popularity: 0.1
};

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
    artistGenres: Map<string, ArtistGenreScore[]>;
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

function normalizeGenreKey(genre: string | undefined): string {
    return normalizeText(genre).toLowerCase();
}

function loadArtistGenres(): Map<string, ArtistGenreScore[]> {
    const artistGenres = new Map<string, ArtistGenreScore[]>();

    if (!fs.existsSync(ARTIST_TAGS_PATH)) {
        return artistGenres;
    }

    let tagIndex: ArtistTagIndex;

    try {
        tagIndex = JSON.parse(
            fs.readFileSync(ARTIST_TAGS_PATH, "utf8")
        ) as ArtistTagIndex;
    } catch (error) {
        console.warn(
            `Could not load ${ARTIST_TAGS_PATH}. Recommendations will ignore artist tags.`,
            error
        );
        return artistGenres;
    }

    for (const [artistKey, record] of Object.entries(tagIndex)) {
        const datasetArtistKey = getArtistPreferenceKey(artistKey);
        const genres = record.genres?.length > 0
            ? record.genres
            : mapLastFmTagsToGenres(record.tags ?? []);

        if (datasetArtistKey && genres.length > 0) {
            artistGenres.set(datasetArtistKey, genres);

            const correctedArtistKey = getArtistPreferenceKey(record.artistName);

            if (correctedArtistKey) {
                artistGenres.set(correctedArtistKey, genres);
            }
        }
    }

    return artistGenres;
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
        artistGroups: new Map<string, ArtistSegment>(),
        artistGenres: loadArtistGenres()
    };
    const artistGroupAggregates = new Map<string, ArtistGroupAggregate>();
    let latestInteractionAt: string | null = null;

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

        if (
            interaction.timestamp &&
            (!latestInteractionAt || interaction.timestamp > latestInteractionAt)
        ) {
            latestInteractionAt = interaction.timestamp;
        }

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

    const referenceDate = latestInteractionAt
        ? new Date(latestInteractionAt)
        : new Date();

    for (const [artistPreferenceKey, artist] of artistGroupAggregates) {
        index.artistGroups.set(
            artistPreferenceKey,
            classifyArtistSegment(artist, {
                ...DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds,
                referenceDate
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

function getCollaborativeScores(
    index: RecommendationIndex,
    targetArtistKeys: Set<string>
): {
    artistScores: Map<string, ArtistScore>;
    trackScores: Map<string, TrackScore>;
} {
    const artistScores = new Map<string, ArtistScore>();
    const trackScores = new Map<string, TrackScore>();
    const neighbors = scoreNeighbors(index.userArtistProfiles, targetArtistKeys);

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

    return { artistScores, trackScores };
}

function getUserGenreKeys(user: SafeUser): Set<string> {
    return new Set(user.genres.map((genre) => normalizeGenreKey(genre)));
}

function normalizeComponentScore(value: number, maxValue: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0) {
        return 0;
    }

    return Math.min(1, Math.max(0, value / maxValue));
}

function getMaxValue<T>(
    values: Iterable<T>,
    getValue: (value: T) => number
): number {
    let maxValue = 0;

    for (const value of values) {
        const numericValue = getValue(value);

        if (Number.isFinite(numericValue) && numericValue > maxValue) {
            maxValue = numericValue;
        }
    }

    return maxValue;
}

function getArtistGenreMatch(
    index: RecommendationIndex,
    artistKey: string,
    userGenreKeys: Set<string>
): { score: number; genres: string[] } {
    if (userGenreKeys.size === 0) {
        return { score: 0, genres: [] };
    }

    const artistGenres = index.artistGenres.get(artistKey) ?? [];
    let totalMatchScore = 0;
    const matchedGenres = new Set<string>();

    for (const artistGenre of artistGenres) {
        if (userGenreKeys.has(normalizeGenreKey(artistGenre.genre))) {
            totalMatchScore += artistGenre.score;
            matchedGenres.add(artistGenre.genre);
        }
    }

    return {
        score: Math.min(1, totalMatchScore / userGenreKeys.size),
        genres: [...matchedGenres].sort()
    };
}

function getListenerGoalScore(
    index: RecommendationIndex,
    artistKey: string,
    listenerGoal: string,
    genreMatchScore: number
): number {
    const normalizedGoal = normalizeText(listenerGoal).toLowerCase();

    if (!normalizedGoal) {
        return 0;
    }

    if (normalizedGoal.includes("outside")) {
        const hasKnownGenres = (index.artistGenres.get(artistKey)?.length ?? 0) > 0;
        return hasKnownGenres ? 1 - genreMatchScore : 0;
    }

    if (normalizedGoal.includes("local")) {
        return index.artistGroups.get(artistKey) === "emerging" ? 1 : 0.25;
    }

    if (
        normalizedGoal.includes("favorite") ||
        normalizedGoal.includes("recommend")
    ) {
        return genreMatchScore;
    }

    return genreMatchScore;
}

function getRecommendationReason(input: {
    genreMatchScore: number;
    matchedGenres: string[];
    goalScore: number;
    listenerGoal: string;
    supportingNeighbors: number;
    type: "artist" | "track";
}): string {
    const reasons: string[] = [];

    if (input.genreMatchScore > 0) {
        const matchedGenreText = input.matchedGenres.length > 0
            ? ` (${input.matchedGenres.join(", ")})`
            : "";
        reasons.push(`Matches your selected genres${matchedGenreText}`);
    }

    if (input.goalScore > 0 && normalizeText(input.listenerGoal)) {
        reasons.push("Supports your discovery goal");
    }

    if (input.supportingNeighbors > 0) {
        const verb = input.type === "track" ? "played" : "heard";
        reasons.push(
            `${verb} by ${input.supportingNeighbors} similar listeners`
        );
    }

    return reasons.length > 0
        ? reasons.join(", ")
        : "Popular among listeners on the platform";
}

function toHybridScore(input: {
    genreMatchScore: number;
    goalScore: number;
    historyScore: number;
    popularityScore: number;
}): number {
    return (
        RECOMMENDATION_WEIGHTS.genre * input.genreMatchScore +
        RECOMMENDATION_WEIGHTS.goal * input.goalScore +
        RECOMMENDATION_WEIGHTS.history * input.historyScore +
        RECOMMENDATION_WEIGHTS.popularity * input.popularityScore
    );
}

function getPreferenceBasedRecommendations(
    index: RecommendationIndex,
    user: SafeUser,
    limit: number
): BaselineRecommendationResult {
    const targetArtistKeys = getUserProfileArtistKeys(user);
    const userGenreKeys = getUserGenreKeys(user);
    const listenerGoal = user.roleDetails.listener?.discoveryGoal ?? "";
    const { artistScores, trackScores } = getCollaborativeScores(
        index,
        targetArtistKeys
    );
    const maxArtistHistoryScore = getMaxValue(
        artistScores.values(),
        (artist) => artist.score
    );
    const maxTrackHistoryScore = getMaxValue(
        trackScores.values(),
        (track) => track.score
    );
    const maxArtistPopularity = getMaxValue(
        index.popularArtists.values(),
        (artist) => artist.playCount
    );
    const maxTrackPopularity = getMaxValue(
        index.popularTracks.values(),
        (track) => track.playCount
    );

    const artistCandidates = [...index.popularArtists.entries()]
        .filter(([artistKey]) => !targetArtistKeys.has(artistKey))
        .map(([artistKey, artist]) => {
            const history = artistScores.get(artistKey);
            const genreMatch = getArtistGenreMatch(
                index,
                artistKey,
                userGenreKeys
            );
            const goalScore = getListenerGoalScore(
                index,
                artistKey,
                listenerGoal,
                genreMatch.score
            );
            const historyScore = normalizeComponentScore(
                history?.score ?? 0,
                maxArtistHistoryScore
            );
            const popularityScore = normalizeComponentScore(
                artist.playCount,
                maxArtistPopularity
            );
            const hybridScore = toHybridScore({
                genreMatchScore: genreMatch.score,
                goalScore,
                historyScore,
                popularityScore
            });

            return {
                artistId: artist.artistId,
                artistName: artist.artistName,
                score: Number((hybridScore * 100).toFixed(2)),
                reason: getRecommendationReason({
                    genreMatchScore: genreMatch.score,
                    matchedGenres: genreMatch.genres,
                    goalScore,
                    listenerGoal,
                    supportingNeighbors: history?.supportingNeighbors ?? 0,
                    type: "artist"
                }),
                hybridScore,
                playCount: artist.playCount
            };
        })
        .sort(
            (firstArtist, secondArtist) =>
                secondArtist.hybridScore - firstArtist.hybridScore ||
                secondArtist.playCount - firstArtist.playCount ||
                firstArtist.artistName.localeCompare(secondArtist.artistName)
        )
        .slice(0, limit)
        .map((artist) => ({
            artistId: artist.artistId,
            artistName: artist.artistName,
            score: artist.score,
            reason: artist.reason
        }));

    const trackCandidates = [...index.popularTracks.entries()]
        .filter(([, track]) => {
            const artistKey = getArtistPreferenceKey(track.artistName);
            return Boolean(artistKey) && !targetArtistKeys.has(artistKey);
        })
        .map(([trackKey, track]) => {
            const artistKey = getArtistPreferenceKey(track.artistName);
            const history = trackScores.get(trackKey);
            const genreMatch = getArtistGenreMatch(
                index,
                artistKey,
                userGenreKeys
            );
            const goalScore = getListenerGoalScore(
                index,
                artistKey,
                listenerGoal,
                genreMatch.score
            );
            const historyScore = normalizeComponentScore(
                history?.score ?? 0,
                maxTrackHistoryScore
            );
            const popularityScore = normalizeComponentScore(
                track.playCount,
                maxTrackPopularity
            );
            const hybridScore = toHybridScore({
                genreMatchScore: genreMatch.score,
                goalScore,
                historyScore,
                popularityScore
            });

            return {
                trackId: track.trackId,
                trackName: track.trackName,
                artistId: track.artistId,
                artistName: track.artistName,
                score: Number((hybridScore * 100).toFixed(2)),
                reason: getRecommendationReason({
                    genreMatchScore: genreMatch.score,
                    matchedGenres: genreMatch.genres,
                    goalScore,
                    listenerGoal,
                    supportingNeighbors: history?.supportingNeighbors ?? 0,
                    type: "track"
                }),
                hybridScore,
                playCount: track.playCount
            };
        })
        .sort(
            (firstTrack, secondTrack) =>
                secondTrack.hybridScore - firstTrack.hybridScore ||
                secondTrack.playCount - firstTrack.playCount ||
                firstTrack.trackName.localeCompare(secondTrack.trackName)
        )
        .slice(0, limit)
        .map((track) => ({
            trackId: track.trackId,
            trackName: track.trackName,
            artistId: track.artistId,
            artistName: track.artistName,
            score: track.score,
            reason: track.reason
        }));

    return { artists: artistCandidates, tracks: trackCandidates };
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
