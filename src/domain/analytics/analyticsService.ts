import { pool } from "../../infrastructure/database";
import {
    getRecommendationEvaluationOverview,
    RecommendationEvaluationOverview
} from "./evaluationService";

export const analyticsEventTypes = ["click", "play", "skip", "like", "save"] as const;

export type AnalyticsEventType = (typeof analyticsEventTypes)[number];

export interface InteractionLogInput {
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

interface CountRow {
    event_type: string;
    count: string;
}

interface ContextRow {
    context: string | null;
    count: string;
}

interface DailyEventRow {
    day: string;
    event_type: string;
    count: string;
}

interface TopItemRow {
    item_name: string | null;
    artist_name: string | null;
    plays: string;
    skips: string;
    likes: string;
    saves: string;
    clicks: string;
}

interface InteractionEventRow {
    id: string;
    event_type: string;
    item_type: string;
    item_id: string | null;
    item_name: string | null;
    artist_name: string | null;
    context: string | null;
    user_id: string | null;
    created_at: Date | string;
}

let initPromise: Promise<void> | null = null;

export function initAnalyticsStore(): Promise<void> {
    initPromise ??= pool.query(`
        CREATE TABLE IF NOT EXISTS interaction_events (
            id UUID PRIMARY KEY,
            event_type TEXT NOT NULL CHECK (
                event_type IN ('click', 'play', 'skip', 'like', 'save')
            ),
            item_type TEXT NOT NULL DEFAULT 'unknown',
            item_id TEXT,
            item_name TEXT,
            artist_name TEXT,
            context TEXT,
            user_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS interaction_events_created_at_idx
            ON interaction_events (created_at DESC);

        CREATE INDEX IF NOT EXISTS interaction_events_event_type_idx
            ON interaction_events (event_type);

        CREATE INDEX IF NOT EXISTS interaction_events_context_idx
            ON interaction_events (context);
    `).then(() => undefined);

    return initPromise;
}

function isAnalyticsEventType(value: unknown): value is AnalyticsEventType {
    return (
        typeof value === "string" &&
        analyticsEventTypes.includes(value as AnalyticsEventType)
    );
}

function normalizeOptionalText(value: unknown, maxLength: number): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return null;
    }

    return trimmedValue.slice(0, maxLength);
}

function toCount(value: string | number | null | undefined): number {
    if (typeof value === "number") {
        return value;
    }

    return Number.parseInt(value ?? "0", 10) || 0;
}

function toEvent(row: InteractionEventRow): InteractionEvent {
    return {
        id: row.id,
        eventType: row.event_type as AnalyticsEventType,
        itemType: row.item_type,
        itemId: row.item_id,
        itemName: row.item_name,
        artistName: row.artist_name,
        context: row.context,
        userId: row.user_id,
        createdAt:
            row.created_at instanceof Date
                ? row.created_at.toISOString()
                : new Date(row.created_at).toISOString()
    };
}

export async function logInteraction(
    input: Partial<InteractionLogInput>,
    userId?: string
): Promise<InteractionEvent> {
    await initAnalyticsStore();

    if (!isAnalyticsEventType(input.eventType)) {
        throw new Error("Interaction event type is invalid.");
    }

    const itemType = normalizeOptionalText(input.itemType, 60) ?? "unknown";
    const itemId = normalizeOptionalText(input.itemId, 120);
    const itemName = normalizeOptionalText(input.itemName, 180);
    const artistName = normalizeOptionalText(input.artistName, 180);
    const context = normalizeOptionalText(input.context, 120);

    const result = await pool.query<InteractionEventRow>(
        `
            INSERT INTO interaction_events (
                id,
                event_type,
                item_type,
                item_id,
                item_name,
                artist_name,
                context,
                user_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
                id,
                event_type,
                item_type,
                item_id,
                item_name,
                artist_name,
                context,
                user_id,
                created_at
        `,
        [
            crypto.randomUUID(),
            input.eventType,
            itemType,
            itemId,
            itemName,
            artistName,
            context,
            userId ?? null
        ]
    );

    return toEvent(result.rows[0]);
}

export async function getAnalyticsMetrics(): Promise<AnalyticsMetrics> {
    await initAnalyticsStore();

    const [
        eventCountsResult,
        trackedUsersResult,
        contextResult,
        dailyResult,
        topItemsResult,
        recentEventsResult,
        recommendationEvaluation
    ] = await Promise.all([
        pool.query<CountRow>(`
            SELECT event_type, COUNT(*) AS count
            FROM interaction_events
            GROUP BY event_type
        `),
        pool.query<{ count: string }>(`
            SELECT COUNT(DISTINCT user_id) AS count
            FROM interaction_events
            WHERE user_id IS NOT NULL
        `),
        pool.query<ContextRow>(`
            SELECT context, COUNT(*) AS count
            FROM interaction_events
            GROUP BY context
            ORDER BY COUNT(*) DESC
            LIMIT 8
        `),
        pool.query<DailyEventRow>(`
            SELECT
                created_at::date::text AS day,
                event_type,
                COUNT(*) AS count
            FROM interaction_events
            WHERE created_at >= NOW() - INTERVAL '13 days'
            GROUP BY created_at::date, event_type
            ORDER BY day ASC
        `),
        pool.query<TopItemRow>(`
            SELECT
                COALESCE(item_name, 'Unknown item') AS item_name,
                artist_name,
                COUNT(*) FILTER (WHERE event_type = 'play') AS plays,
                COUNT(*) FILTER (WHERE event_type = 'skip') AS skips,
                COUNT(*) FILTER (WHERE event_type = 'like') AS likes,
                COUNT(*) FILTER (WHERE event_type = 'save') AS saves,
                COUNT(*) FILTER (WHERE event_type = 'click') AS clicks
            FROM interaction_events
            WHERE item_name IS NOT NULL
            GROUP BY item_name, artist_name
            ORDER BY
                (
                    COUNT(*) FILTER (WHERE event_type = 'play') +
                    COUNT(*) FILTER (WHERE event_type = 'like') * 3 +
                    COUNT(*) FILTER (WHERE event_type = 'save') * 4 -
                    COUNT(*) FILTER (WHERE event_type = 'skip')
                ) DESC,
                item_name ASC
            LIMIT 8
        `),
        pool.query<InteractionEventRow>(`
            SELECT
                id,
                event_type,
                item_type,
                item_id,
                item_name,
                artist_name,
                context,
                user_id,
                created_at
            FROM interaction_events
            ORDER BY created_at DESC
            LIMIT 20
        `),
        getRecommendationEvaluationOverview()
    ]);

    const counts = analyticsEventTypes.reduce<Record<AnalyticsEventType, number>>(
        (currentCounts, eventType) => ({
            ...currentCounts,
            [eventType]: 0
        }),
        {
            click: 0,
            play: 0,
            skip: 0,
            like: 0,
            save: 0
        }
    );

    for (const row of eventCountsResult.rows) {
        if (isAnalyticsEventType(row.event_type)) {
            counts[row.event_type] = toCount(row.count);
        }
    }

    const totalEvents = analyticsEventTypes.reduce(
        (total, eventType) => total + counts[eventType],
        0
    );
    const clickPlays = counts.click + counts.play;

    return {
        totals: {
            events: totalEvents,
            clicks: counts.click,
            plays: counts.play,
            skips: counts.skip,
            likes: counts.like,
            saves: counts.save,
            clickPlays,
            trackedUsers: toCount(trackedUsersResult.rows[0]?.count)
        },
        evaluation: recommendationEvaluation,
        eventBreakdown: analyticsEventTypes.map((eventType) => ({
            eventType,
            count: counts[eventType]
        })),
        contextBreakdown: contextResult.rows.map((row) => ({
            context: row.context ?? "Unspecified",
            count: toCount(row.count)
        })),
        dailyEvents: dailyResult.rows
            .filter((row) => isAnalyticsEventType(row.event_type))
            .map((row) => ({
                day: row.day,
                eventType: row.event_type as AnalyticsEventType,
                count: toCount(row.count)
            })),
        topItems: topItemsResult.rows.map((row) => {
            const plays = toCount(row.plays);
            const skips = toCount(row.skips);
            const likes = toCount(row.likes);
            const saves = toCount(row.saves);
            const clicks = toCount(row.clicks);

            return {
                itemName: row.item_name ?? "Unknown item",
                artistName: row.artist_name,
                plays,
                skips,
                likes,
                saves,
                clicks,
                score: plays + clicks + likes * 3 + saves * 4 - skips
            };
        }),
        recentEvents: recentEventsResult.rows.map(toEvent)
    };
}
