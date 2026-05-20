import { ArtistSegment } from "../../domain/fairness_artist_logic/artistSegmentation";
import { Interaction } from "../dataset_modules/lastfmLoader";
import { SafeUser } from "../../domain/authentication/types";

export interface RecommendedArtist {
    artistId: string | null;
    artistName: string;
    score: number;
    reason: string;
    creatorGroup?: ArtistSegment;
}

export interface RecommendedTracks {
    trackId: string | null;
    trackName: string;
    artistId: string | null;
    artistName: string;
    score: number;
    reason: string;
    creatorGroup?: ArtistSegment;
}

export interface ExposureCountSummary {
    emerging: number;
    established: number;
}

export interface ExposureQuotaEvaluation {
    reranked: boolean;
    quotaSatisfied: boolean;
    quotaAchievable: boolean;
    available: ExposureCountSummary;
    beforeTopN: ExposureCountSummary;
    afterTopN: ExposureCountSummary;
}

export interface PrefixFairnessCheckpointSummary {
    topK: number;
    minimumExposureByGroup: Partial<Record<ArtistSegment, number>>;
}

export interface RecommendationFairnessSummary {
    enabled: boolean;
    candidatePoolSize: number;
    topN: number;
    minimumExposureByGroup: Partial<Record<ArtistSegment, number>>;
    prefixCheckpoints: PrefixFairnessCheckpointSummary[];
    creatorGroupThresholds: {
        emergingMaxAccountAgeDays: number;
        emergingMaxTotalListens: number;
    };
    artists: ExposureQuotaEvaluation;
    tracks: ExposureQuotaEvaluation;
}

export interface BaselineRecommendationResult {
    artists: RecommendedArtist[];
    tracks: RecommendedTracks[];
    fairness?: RecommendationFairnessSummary;
}

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

interface NeighborProfile {
    similarity: number;
    artistPreferenceKeys: Set<string>;
    artistsByPreferenceKey: Map<
        string,
        { artistId: string | null; artistName: string; playCount: number }
    >;
    trackPlayCounts: Map<string, TrackAggregate>;
}

function normalizeText(value: string | undefined): string {
    return value?.trim() ?? "";
}

function getArtistKey(artistId: string | undefined, artistName: string | undefined): string {
    return normalizeText(artistId) || normalizeText(artistName).toLowerCase();
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

function aggregateArtists(interactions: Interaction[]): ArtistAggregate[] {
    const artists = new Map<string, ArtistAggregate>();

    for (const interaction of interactions) {
        const artistId = normalizeText(interaction.artistId) || null;
        const artistName = normalizeText(interaction.artistName);
        const artistKey = getArtistPreferenceKey(artistName);

        if (!artistKey || !artistName) continue;

        const current =
            artists.get(artistKey) ?? {
                artistId,
                artistName,
                playCount: 0
            };

        current.playCount += 1;
        artists.set(artistKey, current);
    }

    return [...artists.values()].sort((a, b) => b.playCount - a.playCount);
}

function aggregateTracks(interactions: Interaction[]): TrackAggregate[] {
    const tracks = new Map<string, TrackAggregate>();

    for (const interaction of interactions) {
        const trackId = normalizeText(interaction.trackId) || null;
        const trackName = normalizeText(interaction.trackName);
        const artistId = normalizeText(interaction.artistId) || null;
        const artistName = normalizeText(interaction.artistName);

        const trackKey = trackId || `${artistName}::${trackName}`;

        if (!trackKey || !trackName || !artistName) continue;

        const current =
            tracks.get(trackKey) ?? {
                trackId,
                trackName,
                artistId,
                artistName,
                playCount: 0
            };

        current.playCount += 1;
        tracks.set(trackKey, current);
    }

    return [...tracks.values()].sort((a, b) => b.playCount - a.playCount);
}

function getUserProfileArtistKeys(user: SafeUser): Set<string> {
    return new Set(
        user.favoriteArtists
            .map((artistName) => getArtistPreferenceKey(artistName))
            .filter(Boolean)
    );
}

function buildNeighborProfiles(interactions: Interaction[]): Map<string, NeighborProfile> {
    const profiles = new Map<string, NeighborProfile>();

    for (const interaction of interactions) {
        const artistName = normalizeText(interaction.artistName);
        const trackName = normalizeText(interaction.trackName);
        const artistId = normalizeText(interaction.artistId) || null;
        const trackId = normalizeText(interaction.trackId) || null;
        const artistKey = getArtistKey(interaction.artistId, interaction.artistName);
        const artistPreferenceKey = getArtistPreferenceKey(interaction.artistName);
        const trackKey = getTrackKey(interaction.trackId, interaction.artistName, interaction.trackName);

        if (!artistKey || !artistPreferenceKey || !artistName || !trackKey || !trackName) {
            continue;
        }

        const profile =
            profiles.get(interaction.userId) ??
            {
                similarity: 0,
                artistPreferenceKeys: new Set<string>(),
                artistsByPreferenceKey: new Map(),
                trackPlayCounts: new Map<string, TrackAggregate>()
            };

        profile.artistPreferenceKeys.add(artistPreferenceKey);
        const currentArtist =
            profile.artistsByPreferenceKey.get(artistPreferenceKey) ??
            {
                artistId,
                artistName,
                playCount: 0
            };
        currentArtist.playCount += 1;
        if (!currentArtist.artistId) {
            currentArtist.artistId = artistId;
        }
        profile.artistsByPreferenceKey.set(artistPreferenceKey, currentArtist);

        const currentTrack =
            profile.trackPlayCounts.get(trackKey) ??
            {
                trackId,
                trackName,
                artistId,
                artistName,
                playCount: 0
            };

        currentTrack.playCount += 1;
        profile.trackPlayCounts.set(trackKey, currentTrack);
        profiles.set(interaction.userId, profile);
    }

    return profiles;
}

function scoreNeighbors(
    neighborProfiles: Map<string, NeighborProfile>,
    targetArtistKeys: Set<string>
): NeighborProfile[] {
    const targetSize = targetArtistKeys.size;

    if (targetSize === 0) {
        return [];
    }

    return [...neighborProfiles.values()]
        .map((profile) => {
            let overlapCount = 0;

            for (const artistKey of targetArtistKeys) {
                if (profile.artistPreferenceKeys.has(artistKey)) {
                    overlapCount += 1;
                }
            }

            if (overlapCount === 0) {
                return null;
            }

            const similarity =
                overlapCount /
                Math.sqrt(targetSize * profile.artistPreferenceKeys.size);

            return {
                ...profile,
                similarity
            };
        })
        .filter((profile): profile is NeighborProfile => profile !== null)
        .sort((firstProfile, secondProfile) => secondProfile.similarity - firstProfile.similarity);
}

function getPreferenceBasedRecommendations(
    interactions: Interaction[],
    user: SafeUser,
    limit = 10
): BaselineRecommendationResult {
    const targetArtistKeys = getUserProfileArtistKeys(user);

    if (targetArtistKeys.size === 0) {
        return getPopularityFallbackRecommendations(interactions, limit);
    }

    const neighborProfiles = scoreNeighbors(
        buildNeighborProfiles(interactions),
        targetArtistKeys
    );

    if (neighborProfiles.length === 0) {
        return getPopularityFallbackRecommendations(interactions, limit, targetArtistKeys);
    }

    const artistScores = new Map<
        string,
        { artistId: string | null; artistName: string; score: number; supportingNeighbors: number }
    >();
    const trackScores = new Map<
        string,
        { trackId: string | null; trackName: string; artistId: string | null; artistName: string; score: number; supportingNeighbors: number }
    >();

    for (const neighbor of neighborProfiles) {
        for (const [artistPreferenceKey, artist] of neighbor.artistsByPreferenceKey) {
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

            currentArtist.score += neighbor.similarity * artist.playCount;
            currentArtist.supportingNeighbors += 1;
            artistScores.set(artistPreferenceKey, currentArtist);
        }

        for (const [trackKey, track] of neighbor.trackPlayCounts) {
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

            currentTrack.score += neighbor.similarity * track.playCount;
            currentTrack.supportingNeighbors += 1;
            trackScores.set(trackKey, currentTrack);
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
        .filter((track) => track.trackId != null || track.artistId != null)
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
        return getPopularityFallbackRecommendations(interactions, limit, targetArtistKeys);
    }

    return { artists, tracks };
}

function getPopularityFallbackRecommendations(
    interactions: Interaction[],
    limit = 10,
    excludedArtistKeys: Set<string> = new Set<string>()
): BaselineRecommendationResult {
    const artists = aggregateArtists(interactions)
        .filter((artist) => {
            const artistKey = getArtistPreferenceKey(artist.artistName);
            return !excludedArtistKeys.has(artistKey);
        })
        .slice(0, limit)
        .map((artist) => ({
            artistId: artist.artistId,
            artistName: artist.artistName,
            score: artist.playCount,
            reason: "Popular among listeners on the platform"
        }));

    const tracks = aggregateTracks(interactions)
        .filter((track) => {
            const artistKey = getArtistPreferenceKey(track.artistName);
            return Boolean(artistKey) && !excludedArtistKeys.has(artistKey);
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

    return { artists, tracks };
}

export function getBaselineRecommendations(
    interactions: Interaction[],
    user: SafeUser,
    limit = 10
): BaselineRecommendationResult {
    return getPreferenceBasedRecommendations(interactions, user, limit);
}
