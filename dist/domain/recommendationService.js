"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendationsForUser = getRecommendationsForUser;
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
const fairnessRecommender_1 = require("../data/recommendation_modules/fairnessRecommender");
const artistSegmentation_1 = require("./artistSegmentation");
const authService_1 = require("./auth/authService");
const fairnessConfig_1 = require("./fairnessConfig");
const artistTagMapping_1 = require("./artistTagMapping");
const INTERACTIONS_PATH = "dataset/processed/interactions.json";
const ARTIST_TAGS_PATH = "dataset/processed/artistTags.json";
const RECOMMENDATION_WEIGHTS = {
    genre: 0.5,
    goal: 0.25,
    history: 0.15,
    popularity: 0.1
};
let cachedIndex = null;
let cachedIndexPromise = null;
function normalizeText(value) {
    return value?.trim() ?? "";
}
function getArtistPreferenceKey(artistName) {
    return normalizeText(artistName).toLowerCase();
}
function getTrackKey(trackId, artistName, trackName) {
    return (normalizeText(trackId) ||
        `${normalizeText(artistName)}::${normalizeText(trackName)}`);
}
function normalizeGenreKey(genre) {
    return normalizeText(genre).toLowerCase();
}
function loadArtistGenres() {
    const artistGenres = new Map();
    if (!fs_1.default.existsSync(ARTIST_TAGS_PATH)) {
        return artistGenres;
    }
    let tagIndex;
    try {
        tagIndex = JSON.parse(fs_1.default.readFileSync(ARTIST_TAGS_PATH, "utf8"));
    }
    catch (error) {
        console.warn(`Could not load ${ARTIST_TAGS_PATH}. Recommendations will ignore artist tags.`, error);
        return artistGenres;
    }
    for (const [artistKey, record] of Object.entries(tagIndex)) {
        const datasetArtistKey = getArtistPreferenceKey(artistKey);
        const genres = record.genres?.length > 0
            ? record.genres
            : (0, artistTagMapping_1.mapLastFmTagsToGenres)(record.tags ?? []);
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
function parseInteractionLine(line) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine === "[" || trimmedLine === "]") {
        return null;
    }
    const normalizedLine = trimmedLine.endsWith(",")
        ? trimmedLine.slice(0, -1)
        : trimmedLine;
    return JSON.parse(normalizedLine);
}
function updateDateRange(aggregate, timestamp) {
    const normalizedTimestamp = normalizeText(timestamp);
    if (!normalizedTimestamp) {
        return;
    }
    if (!aggregate.firstListenedAt
        || normalizedTimestamp < aggregate.firstListenedAt) {
        aggregate.firstListenedAt = normalizedTimestamp;
    }
    if (!aggregate.lastListenedAt
        || normalizedTimestamp > aggregate.lastListenedAt) {
        aggregate.lastListenedAt = normalizedTimestamp;
    }
}
async function streamInteractions(onInteraction) {
    if (!fs_1.default.existsSync(INTERACTIONS_PATH)) {
        return;
    }
    const stream = fs_1.default.createReadStream(INTERACTIONS_PATH, { encoding: "utf8" });
    const lineReader = readline_1.default.createInterface({
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
    }
    finally {
        lineReader.close();
    }
}
function getUserProfileArtistKeys(user) {
    return new Set(user.favoriteArtists
        .map((artistName) => getArtistPreferenceKey(artistName))
        .filter(Boolean));
}
async function buildRecommendationIndex() {
    const index = {
        userArtistProfiles: new Map(),
        artistsByUser: new Map(),
        tracksByUser: new Map(),
        popularArtists: new Map(),
        popularTracks: new Map(),
        artistGroups: new Map(),
        artistGenres: loadArtistGenres()
    };
    const artistGroupAggregates = new Map();
    let latestInteractionAt = null;
    await streamInteractions((interaction) => {
        const userId = normalizeText(interaction.userId);
        const artistName = normalizeText(interaction.artistName);
        const artistId = normalizeText(interaction.artistId) || null;
        const artistPreferenceKey = getArtistPreferenceKey(interaction.artistName);
        if (!userId || !artistPreferenceKey || !artistName) {
            return;
        }
        const artistProfile = index.userArtistProfiles.get(userId) ?? new Set();
        artistProfile.add(artistPreferenceKey);
        index.userArtistProfiles.set(userId, artistProfile);
        const userArtists = index.artistsByUser.get(userId) ?? new Map();
        const currentUserArtist = userArtists.get(artistPreferenceKey) ??
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
        const currentPopularArtist = index.popularArtists.get(artistPreferenceKey) ??
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
        const currentArtistGroupAggregate = artistGroupAggregates.get(artistPreferenceKey) ??
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
        if (interaction.timestamp &&
            (!latestInteractionAt || interaction.timestamp > latestInteractionAt)) {
            latestInteractionAt = interaction.timestamp;
        }
        artistGroupAggregates.set(artistPreferenceKey, currentArtistGroupAggregate);
        const trackName = normalizeText(interaction.trackName);
        const trackId = normalizeText(interaction.trackId) || null;
        const trackKey = getTrackKey(interaction.trackId, interaction.artistName, interaction.trackName);
        if (!trackKey || !trackName || (trackId == null && artistId == null)) {
            return;
        }
        const userTracks = index.tracksByUser.get(userId) ?? new Map();
        const currentUserTrack = userTracks.get(trackKey) ??
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
        const currentPopularTrack = index.popularTracks.get(trackKey) ??
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
        index.artistGroups.set(artistPreferenceKey, (0, artistSegmentation_1.classifyArtistSegment)(artist, {
            ...fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds,
            referenceDate
        }));
    }
    return index;
}
async function getRecommendationIndex() {
    if (cachedIndex) {
        return cachedIndex;
    }
    cachedIndexPromise ?? (cachedIndexPromise = buildRecommendationIndex()
        .then((index) => {
        cachedIndex = index;
        return index;
    })
        .finally(() => {
        cachedIndexPromise = null;
    }));
    return cachedIndexPromise;
}
function scoreNeighbors(userArtistProfiles, targetArtistKeys) {
    const targetSize = targetArtistKeys.size;
    if (targetSize === 0) {
        return new Map();
    }
    const neighbors = new Map();
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
function getCollaborativeScores(index, targetArtistKeys) {
    const artistScores = new Map();
    const trackScores = new Map();
    const neighbors = scoreNeighbors(index.userArtistProfiles, targetArtistKeys);
    for (const [userId, similarity] of neighbors) {
        const userArtists = index.artistsByUser.get(userId);
        if (userArtists) {
            for (const [artistPreferenceKey, artist] of userArtists) {
                if (targetArtistKeys.has(artistPreferenceKey)) {
                    continue;
                }
                const currentArtist = artistScores.get(artistPreferenceKey) ??
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
                const currentTrack = trackScores.get(trackKey) ??
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
function getUserGenreKeys(user) {
    return new Set(user.genres.map((genre) => normalizeGenreKey(genre)));
}
function normalizeComponentScore(value, maxValue) {
    if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0) {
        return 0;
    }
    return Math.min(1, Math.max(0, value / maxValue));
}
function getMaxValue(values, getValue) {
    let maxValue = 0;
    for (const value of values) {
        const numericValue = getValue(value);
        if (Number.isFinite(numericValue) && numericValue > maxValue) {
            maxValue = numericValue;
        }
    }
    return maxValue;
}
function getArtistGenreMatch(index, artistKey, userGenreKeys) {
    if (userGenreKeys.size === 0) {
        return { score: 0, genres: [] };
    }
    const artistGenres = index.artistGenres.get(artistKey) ?? [];
    let totalMatchScore = 0;
    const matchedGenres = new Set();
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
function getListenerGoalScore(index, artistKey, listenerGoal, genreMatchScore) {
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
    if (normalizedGoal.includes("favorite") ||
        normalizedGoal.includes("recommend")) {
        return genreMatchScore;
    }
    return genreMatchScore;
}
function getRecommendationReason(input) {
    const reasons = [];
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
        reasons.push(`${verb} by ${input.supportingNeighbors} similar listeners`);
    }
    return reasons.length > 0
        ? reasons.join(", ")
        : "Popular among listeners on the platform";
}
function toHybridScore(input) {
    return (RECOMMENDATION_WEIGHTS.genre * input.genreMatchScore +
        RECOMMENDATION_WEIGHTS.goal * input.goalScore +
        RECOMMENDATION_WEIGHTS.history * input.historyScore +
        RECOMMENDATION_WEIGHTS.popularity * input.popularityScore);
}
function getPreferenceBasedRecommendations(index, user, limit) {
    const targetArtistKeys = getUserProfileArtistKeys(user);
    const userGenreKeys = getUserGenreKeys(user);
    const listenerGoal = user.roleDetails.listener?.discoveryGoal ?? "";
    const { artistScores, trackScores } = getCollaborativeScores(index, targetArtistKeys);
    const maxArtistHistoryScore = getMaxValue(artistScores.values(), (artist) => artist.score);
    const maxTrackHistoryScore = getMaxValue(trackScores.values(), (track) => track.score);
    const maxArtistPopularity = getMaxValue(index.popularArtists.values(), (artist) => artist.playCount);
    const maxTrackPopularity = getMaxValue(index.popularTracks.values(), (track) => track.playCount);
    const artistCandidates = [...index.popularArtists.entries()]
        .filter(([artistKey]) => !targetArtistKeys.has(artistKey))
        .map(([artistKey, artist]) => {
        const history = artistScores.get(artistKey);
        const genreMatch = getArtistGenreMatch(index, artistKey, userGenreKeys);
        const goalScore = getListenerGoalScore(index, artistKey, listenerGoal, genreMatch.score);
        const historyScore = normalizeComponentScore(history?.score ?? 0, maxArtistHistoryScore);
        const popularityScore = normalizeComponentScore(artist.playCount, maxArtistPopularity);
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
        .sort((firstArtist, secondArtist) => secondArtist.hybridScore - firstArtist.hybridScore ||
        secondArtist.playCount - firstArtist.playCount ||
        firstArtist.artistName.localeCompare(secondArtist.artistName))
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
        const genreMatch = getArtistGenreMatch(index, artistKey, userGenreKeys);
        const goalScore = getListenerGoalScore(index, artistKey, listenerGoal, genreMatch.score);
        const historyScore = normalizeComponentScore(history?.score ?? 0, maxTrackHistoryScore);
        const popularityScore = normalizeComponentScore(track.playCount, maxTrackPopularity);
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
        .sort((firstTrack, secondTrack) => secondTrack.hybridScore - firstTrack.hybridScore ||
        secondTrack.playCount - firstTrack.playCount ||
        firstTrack.trackName.localeCompare(secondTrack.trackName))
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
function getCreatorGroupForArtist(artistName, index) {
    const artistPreferenceKey = getArtistPreferenceKey(artistName);
    return index.artistGroups.get(artistPreferenceKey) ?? "established";
}
function attachCreatorGroups(recommendations, index) {
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
async function getRecommendationsForUser(userId, limit = 10) {
    const user = await (0, authService_1.getSafeUserById)(userId);
    if (!user) {
        throw new Error("Could not load the signed-in user profile.");
    }
    const index = await getRecommendationIndex();
    const candidatePoolSize = Math.max(limit, fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.candidatePoolSize, fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule.topN);
    const baselineRecommendations = getPreferenceBasedRecommendations(index, user, candidatePoolSize);
    const recommendationsWithGroups = attachCreatorGroups(baselineRecommendations, index);
    const artistQuotaResult = (0, fairnessRecommender_1.applyExposureQuotaToArtists)(recommendationsWithGroups.artists, fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule);
    const trackQuotaResult = (0, fairnessRecommender_1.applyExposureQuotaToTracks)(recommendationsWithGroups.tracks, fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule);
    return {
        artists: artistQuotaResult.artists.slice(0, limit),
        tracks: trackQuotaResult.tracks.slice(0, limit),
        fairness: {
            enabled: fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.enabled,
            candidatePoolSize,
            topN: fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule.topN,
            minimumExposureByGroup: fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule.minimumExposureByGroup,
            prefixCheckpoints: fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.exposureQuotaRule.prefixCheckpoints,
            creatorGroupThresholds: fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds,
            artists: artistQuotaResult.evaluation,
            tracks: trackQuotaResult.evaluation
        }
    };
}
