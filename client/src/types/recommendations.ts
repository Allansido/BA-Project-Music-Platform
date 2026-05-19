export interface RecommendedArtist {
    artistId: string | null;
    artistName: string;
    score: number;
    reason: string;
    creatorGroup?: "emerging" | "established";
}

export interface RecommendedTrack {
    trackId: string | null;
    trackName: string;
    artistId: string | null;
    artistName: string;
    score: number;
    reason: string;
    creatorGroup?: "emerging" | "established";
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
    minimumExposureShareByGroup: Partial<Record<"emerging" | "established", number>>;
    minimumExposureByGroup: Partial<Record<"emerging" | "established", number>>;
}

export interface RecommendationFairnessSummary {
    enabled: boolean;
    candidatePoolSize: number;
    topN: number;
    minimumExposureShareByGroup: Partial<Record<"emerging" | "established", number>>;
    minimumExposureByGroup: Partial<Record<"emerging" | "established", number>>;
    prefixCheckpoints: PrefixFairnessCheckpointSummary[];
    creatorGroupThresholds: {
        emergingMaxAccountAgeDays: number;
        emergingMaxTotalListens: number;
    };
    artists: ExposureQuotaEvaluation;
    tracks: ExposureQuotaEvaluation;
}

export interface RecommendationResult {
    artists: RecommendedArtist[];
    tracks: RecommendedTrack[];
    fairness?: RecommendationFairnessSummary;
}
