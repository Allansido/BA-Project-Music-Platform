export type AnalyticsEventType = "click" | "play" | "skip" | "like" | "save";

export interface InteractionLogPayload {
    eventType: AnalyticsEventType;
    itemType?: string;
    itemId?: string | null;
    itemName?: string | null;
    artistName?: string | null;
    context?: string | null;
}

export interface InteractionEvent {
    id: string;
    eventType: AnalyticsEventType;
    itemType: string;
    itemId: string | null;
    itemName: string | null;
    artistName: string | null;
    context: string | null;
    userId: string | null;
    createdAt: string;
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

export interface ExposureCountSummary {
    emerging: number;
    established: number;
}

export interface FairnessMetricEntityOverview {
    exposureByGroup: ExposureCountSummary;
    exposureShare: ExposureCountSummary;
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
    relevance: {
        baseline: RelevanceMetricModeOverview;
        fairnessAware: RelevanceMetricModeOverview;
    };
    fairness: {
        baseline: FairnessMetricModeOverview;
        fairnessAware: FairnessMetricModeOverview;
    };
}

export interface AnalyticsMetrics {
    totals: {
        events: number;
        clicks: number;
        plays: number;
        skips: number;
        likes: number;
        saves: number;
        clickPlays: number;
        trackedUsers: number;
    };
    evaluation: RecommendationEvaluationOverview;
    eventBreakdown: Array<{
        eventType: AnalyticsEventType;
        count: number;
    }>;
    contextBreakdown: Array<{
        context: string;
        count: number;
    }>;
    dailyEvents: Array<{
        day: string;
        eventType: AnalyticsEventType;
        count: number;
    }>;
    topItems: Array<{
        itemName: string;
        artistName: string | null;
        plays: number;
        skips: number;
        likes: number;
        saves: number;
        clicks: number;
        score: number;
    }>;
    recentEvents: InteractionEvent[];
}
