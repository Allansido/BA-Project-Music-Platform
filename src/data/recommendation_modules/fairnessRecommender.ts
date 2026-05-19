import { ArtistSegment } from "../../domain/artistSegmentation";
import {
    ExposureQuotaRule,
    PrefixFairnessCheckpoint,
    getMinimumExposureCountsForLimit
} from "../../domain/fairnessConfig";
import {
    ExposureCountSummary,
    ExposureQuotaEvaluation,
    RecommendedArtist,
    RecommendedTracks
} from "./baselineRecommender";

type GroupedRecommendation = {
    creatorGroup?: ArtistSegment;
};

function createEmptyCounts(): ExposureCountSummary {
    return {
        emerging: 0,
        established: 0
    };
}

function getCreatorGroup(item: GroupedRecommendation): ArtistSegment {
    return item.creatorGroup ?? "established";
}

function countExposureByGroup<T extends GroupedRecommendation>(
    items: T[],
    limit: number
): ExposureCountSummary {
    return items.slice(0, limit).reduce((counts, item) => {
        counts[getCreatorGroup(item)] += 1;
        return counts;
    }, createEmptyCounts());
}

function getRequestedMinimums(
    minimumExposureShareByGroup: Partial<Record<ArtistSegment, number>>,
    limit: number
): ExposureCountSummary {
    return getMinimumExposureCountsForLimit(
        minimumExposureShareByGroup,
        limit
    );
}

function getEffectiveMinimums(
    requestedMinimums: ExposureCountSummary,
    available: ExposureCountSummary
): ExposureCountSummary {
    return {
        emerging: Math.min(requestedMinimums.emerging, available.emerging),
        established: Math.min(requestedMinimums.established, available.established)
    };
}

function getActiveCheckpoint(
    checkpoints: PrefixFairnessCheckpoint[],
    nextRank: number
): PrefixFairnessCheckpoint | null {
    for (const checkpoint of checkpoints) {
        if (nextRank <= checkpoint.topK) {
            return checkpoint;
        }
    }

    return checkpoints.length > 0
        ? checkpoints[checkpoints.length - 1]
        : null;
}

function rerankForExposureQuota<T extends GroupedRecommendation>(
    items: T[],
    rule: ExposureQuotaRule,
    getIdentity: (item: T, index: number) => string
): {
    items: T[];
    evaluation: ExposureQuotaEvaluation;
} {
    const targetSize = Math.min(rule.topN, items.length);
    const available = countExposureByGroup(items, items.length);
    const requestedMinimums = getRequestedMinimums(
        rule.minimumExposureShareByGroup,
        targetSize
    );
    const effectiveMinimums = getEffectiveMinimums(requestedMinimums, available);
    const beforeTopN = countExposureByGroup(items, targetSize);
    const remaining = [...items];
    const chosen: T[] = [];
    const chosenCounts = createEmptyCounts();
    const checkpoints = [...rule.prefixCheckpoints]
        .filter((checkpoint) => checkpoint.topK > 0)
        .sort(
            (firstCheckpoint, secondCheckpoint) =>
                firstCheckpoint.topK - secondCheckpoint.topK
        );

    for (let index = 0; index < targetSize; index += 1) {
        const nextRank = index + 1;
        const activeCheckpoint = getActiveCheckpoint(checkpoints, nextRank);
        let nextIndex = 0;

        if (activeCheckpoint) {
            const requestedForCheckpoint = getRequestedMinimums(
                activeCheckpoint.minimumExposureShareByGroup,
                activeCheckpoint.topK
            );
            const effectiveForCheckpoint = getEffectiveMinimums(
                requestedForCheckpoint,
                available
            );
            const remainingSlotsUntilCheckpoint = activeCheckpoint.topK - index;
            const remainingRequiredUntilCheckpoint =
                Math.max(
                    0,
                    effectiveForCheckpoint.emerging - chosenCounts.emerging
                ) +
                Math.max(
                    0,
                    effectiveForCheckpoint.established - chosenCounts.established
                );
            const mustChooseRequiredGroup =
                remainingRequiredUntilCheckpoint >= remainingSlotsUntilCheckpoint;

            if (mustChooseRequiredGroup) {
                nextIndex = remaining.findIndex((item) => {
                    const group = getCreatorGroup(item);
                    return chosenCounts[group] < effectiveForCheckpoint[group];
                });
            }
        }

        if (nextIndex < 0) {
            nextIndex = remaining.findIndex((item) => {
                const group = getCreatorGroup(item);
                return chosenCounts[group] < effectiveMinimums[group];
            });
        }

        nextIndex = nextIndex < 0 ? 0 : nextIndex;

        const [nextItem] = remaining.splice(nextIndex, 1);
        chosen.push(nextItem);
        chosenCounts[getCreatorGroup(nextItem)] += 1;
    }

    const rerankedItems = [...chosen, ...remaining];
    const afterTopN = countExposureByGroup(rerankedItems, targetSize);
    const originalTopIdentities = items
        .slice(0, targetSize)
        .map((item, index) => getIdentity(item, index));
    const rerankedTopIdentities = rerankedItems
        .slice(0, targetSize)
        .map((item, index) => getIdentity(item, index));
    const reranked = originalTopIdentities.some(
        (identity, index) => identity !== rerankedTopIdentities[index]
    );

    return {
        items: rerankedItems,
        evaluation: {
            reranked,
            quotaSatisfied:
                afterTopN.emerging >= requestedMinimums.emerging &&
                afterTopN.established >= requestedMinimums.established,
            quotaAchievable:
                available.emerging >= requestedMinimums.emerging &&
                available.established >= requestedMinimums.established,
            available,
            beforeTopN,
            afterTopN
        }
    };
}

export function applyExposureQuotaToArtists(
    artists: RecommendedArtist[],
    rule: ExposureQuotaRule
): {
    artists: RecommendedArtist[];
    evaluation: ExposureQuotaEvaluation;
} {
    const result = rerankForExposureQuota(
        artists,
        rule,
        (artist, index) => artist.artistId ?? `artist-${index}:${artist.artistName}`
    );

    return {
        artists: result.items,
        evaluation: result.evaluation
    };
}

export function applyExposureQuotaToTracks(
    tracks: RecommendedTracks[],
    rule: ExposureQuotaRule
): {
    tracks: RecommendedTracks[];
    evaluation: ExposureQuotaEvaluation;
} {
    const result = rerankForExposureQuota(
        tracks,
        rule,
        (track, index) =>
            track.trackId ?? `track-${index}:${track.artistName}:${track.trackName}`
    );

    return {
        tracks: result.items,
        evaluation: result.evaluation
    };
}
