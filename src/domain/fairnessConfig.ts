import { ArtistSegment } from "./artistSegmentation";

export interface CreatorGroupThresholds {
    emergingMaxAccountAgeDays: number;
    emergingMaxTotalListens: number;
}

export interface PrefixFairnessCheckpoint {
    topK: number;
    minimumExposureShareByGroup: Partial<Record<ArtistSegment, number>>;
}

export interface ExposureQuotaRule {
    topN: number;
    minimumExposureShareByGroup: Partial<Record<ArtistSegment, number>>;
    prefixCheckpoints: PrefixFairnessCheckpoint[];
}

export interface FairnessConfig {
    enabled: boolean;
    creatorGroupThresholds: CreatorGroupThresholds;
    exposureQuotaRule: ExposureQuotaRule;
    candidatePoolSize: number;
}

export const DEFAULT_FAIRNESS_CONFIG: FairnessConfig = {
    enabled: true,
    creatorGroupThresholds: {
        emergingMaxAccountAgeDays: 730,
        emergingMaxTotalListens: 500
    },
    exposureQuotaRule: {
        topN: 20,
        minimumExposureShareByGroup: {
            emerging: 0.4
        },
        prefixCheckpoints: [
            {
                topK: 3,
                minimumExposureShareByGroup: {
                    emerging: 0.4
                }
            },
            {
                topK: 5,
                minimumExposureShareByGroup: {
                    emerging: 0.4
                }
            },
            {
                topK: 10,
                minimumExposureShareByGroup: {
                    emerging: 0.4
                }
            },
            {
                topK: 20,
                minimumExposureShareByGroup: {
                    emerging: 0.4
                }
            }
        ]
    },
    candidatePoolSize: 1000
};

function getValidExposureShare(value: number | undefined): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(1, Math.max(0, value ?? 0));
}

export function getMinimumExposureCountsForLimit(
    minimumExposureShareByGroup: Partial<Record<ArtistSegment, number>>,
    limit: number
): Record<ArtistSegment, number> {
    const safeLimit = Math.max(0, Math.floor(limit));

    return {
        emerging: Math.round(
            safeLimit * getValidExposureShare(minimumExposureShareByGroup.emerging)
        ),
        established: Math.round(
            safeLimit *
                getValidExposureShare(minimumExposureShareByGroup.established)
        )
    };
}
