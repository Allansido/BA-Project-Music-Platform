import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAnalyticsMetrics } from "../api/analyticsApi";
import type { AnalyticsMetrics } from "../types/analytics";

const eventLabels = {
    click: "Clicks",
    play: "Plays",
    skip: "Skips",
    like: "Likes",
    save: "Saves"
};

function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

function formatDecimal(value: number): string {
    return value.toFixed(4);
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
}

function getMetricWidth(value: number, maxValue: number): string {
    if (maxValue <= 0) {
        return "0%";
    }

    return `${Math.max(8, Math.round((value / maxValue) * 100))}%`;
}

function AdminDashboardPage() {
    const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    async function loadMetrics() {
        setErrorMessage("");
        setIsLoading(true);

        try {
            const nextMetrics = await getAnalyticsMetrics();
            setMetrics(nextMetrics);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Could not load analytics.";
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadMetrics();
    }, []);

    const maxBreakdownCount = useMemo(
        () =>
            Math.max(
                ...((metrics?.eventBreakdown ?? []).map((event) => event.count)),
                0
            ),
        [metrics]
    );
    const maxContextCount = useMemo(
        () =>
            Math.max(
                ...((metrics?.contextBreakdown ?? []).map((context) => context.count)),
                0
            ),
        [metrics]
    );
    const maxItemScore = useMemo(
        () => Math.max(...((metrics?.topItems ?? []).map((item) => item.score)), 0),
        [metrics]
    );

    return (
        <main className="admin-page">
            <header className="admin-header">
                <div>
                    <Link className="back-link" to="/login">
                        Back to login
                    </Link>
                    <p className="eyebrow">Admin analytics</p>
                    <h1>Logging dashboard</h1>
                    <p className="subtitle">
                        Overview of interaction logging and recommender evaluation
                        metrics for relevance and fairness.
                    </p>
                </div>
                <button
                    type="button"
                    className="secondary-button"
                    onClick={loadMetrics}
                    disabled={isLoading}
                >
                    {isLoading ? "Refreshing..." : "Refresh"}
                </button>
            </header>

            {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

            {isLoading && !metrics ? (
                <p className="loading-pill">Loading analytics...</p>
            ) : null}

            {metrics ? (
                <>
                    <section className="admin-metric-grid">
                        <article className="metric-block admin-metric">
                            <span>Total events</span>
                            <strong>{metrics.totals.events}</strong>
                        </article>
                        <article className="metric-block admin-metric">
                            <span>Clicks / plays</span>
                            <strong>{metrics.totals.clickPlays}</strong>
                        </article>
                        <article className="metric-block admin-metric">
                            <span>Skips</span>
                            <strong>{metrics.totals.skips}</strong>
                        </article>
                        <article className="metric-block admin-metric">
                            <span>Likes</span>
                            <strong>{metrics.totals.likes}</strong>
                        </article>
                        <article className="metric-block admin-metric">
                            <span>Saves</span>
                            <strong>{metrics.totals.saves}</strong>
                        </article>
                        <article className="metric-block admin-metric">
                            <span>Tracked users</span>
                            <strong>{metrics.totals.trackedUsers}</strong>
                        </article>
                    </section>

                    <section className="admin-section">
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">Evaluation metrics</p>
                                <h2>Baseline vs fairness-aware ranking</h2>
                            </div>
                            <span className="evaluation-sample">
                                Top-{metrics.evaluation.topN} ·{" "}
                                {metrics.evaluation.sampleUsers} users ·{" "}
                                {metrics.evaluation.sampleInteractions} interactions
                            </span>
                        </div>

                        <div className="evaluation-compare-grid">
                            <article className="evaluation-mode-card">
                                <h3>Baseline recommender</h3>
                                <p>
                                    Evaluated users:{" "}
                                    {metrics.evaluation.relevance.baseline.evaluatedUsers}
                                </p>
                                <div className="metric-pair-grid">
                                    <div>
                                        <span>Artist Precision@N</span>
                                        <strong>
                                            {formatDecimal(
                                                metrics.evaluation.relevance.baseline
                                                    .artists.precisionAtN
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Track Precision@N</span>
                                        <strong>
                                            {formatDecimal(
                                                metrics.evaluation.relevance.baseline
                                                    .tracks.precisionAtN
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Artist nDCG@N</span>
                                        <strong>
                                            {formatDecimal(
                                                metrics.evaluation.relevance.baseline
                                                    .artists.ndcgAtN
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Track nDCG@N</span>
                                        <strong>
                                            {formatDecimal(
                                                metrics.evaluation.relevance.baseline
                                                    .tracks.ndcgAtN
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            </article>

                            <article className="evaluation-mode-card">
                                <h3>Fairness-aware recommender</h3>
                                <p>
                                    Evaluated users:{" "}
                                    {
                                        metrics.evaluation.relevance.fairnessAware
                                            .evaluatedUsers
                                    }
                                </p>
                                <div className="metric-pair-grid">
                                    <div>
                                        <span>Artist Precision@N</span>
                                        <strong>
                                            {formatDecimal(
                                                metrics.evaluation.relevance
                                                    .fairnessAware.artists
                                                    .precisionAtN
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Track Precision@N</span>
                                        <strong>
                                            {formatDecimal(
                                                metrics.evaluation.relevance
                                                    .fairnessAware.tracks
                                                    .precisionAtN
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Artist nDCG@N</span>
                                        <strong>
                                            {formatDecimal(
                                                metrics.evaluation.relevance
                                                    .fairnessAware.artists.ndcgAtN
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Track nDCG@N</span>
                                        <strong>
                                            {formatDecimal(
                                                metrics.evaluation.relevance
                                                    .fairnessAware.tracks.ndcgAtN
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            </article>
                        </div>
                    </section>

                    <section className="admin-section">
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">Fairness metrics</p>
                                <h2>Exposure distribution</h2>
                            </div>
                        </div>

                        <div className="fairness-grid">
                            <article className="fairness-card">
                                <h3>Baseline artists</h3>
                                <div className="metric-pair-grid">
                                    <div>
                                        <span>Emerging exposure share</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness.baseline
                                                    .artists.exposureShare.emerging
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Established exposure share</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness.baseline
                                                    .artists.exposureShare.established
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Exposure disparity</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness.baseline
                                                    .artists.exposureDisparity
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Fairness deviation</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness.baseline
                                                    .artists.fairnessDeviation
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            </article>

                            <article className="fairness-card">
                                <h3>Fairness-aware artists</h3>
                                <div className="metric-pair-grid">
                                    <div>
                                        <span>Emerging exposure share</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness
                                                    .fairnessAware.artists
                                                    .exposureShare.emerging
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Established exposure share</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness
                                                    .fairnessAware.artists
                                                    .exposureShare.established
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Exposure disparity</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness
                                                    .fairnessAware.artists
                                                    .exposureDisparity
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Fairness deviation</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness
                                                    .fairnessAware.artists
                                                    .fairnessDeviation
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            </article>

                            <article className="fairness-card">
                                <h3>Baseline tracks</h3>
                                <div className="metric-pair-grid">
                                    <div>
                                        <span>Emerging exposure share</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness.baseline
                                                    .tracks.exposureShare.emerging
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Established exposure share</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness.baseline
                                                    .tracks.exposureShare.established
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Exposure disparity</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness.baseline
                                                    .tracks.exposureDisparity
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Fairness deviation</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness.baseline
                                                    .tracks.fairnessDeviation
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            </article>

                            <article className="fairness-card">
                                <h3>Fairness-aware tracks</h3>
                                <div className="metric-pair-grid">
                                    <div>
                                        <span>Emerging exposure share</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness
                                                    .fairnessAware.tracks
                                                    .exposureShare.emerging
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Established exposure share</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness
                                                    .fairnessAware.tracks
                                                    .exposureShare.established
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Exposure disparity</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness
                                                    .fairnessAware.tracks
                                                    .exposureDisparity
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Fairness deviation</span>
                                        <strong>
                                            {formatPercent(
                                                metrics.evaluation.fairness
                                                    .fairnessAware.tracks
                                                    .fairnessDeviation
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            </article>
                        </div>
                    </section>

                    <section className="admin-layout">
                        <div className="admin-section">
                            <div className="section-heading compact">
                                <div>
                                    <p className="eyebrow">Logging overview</p>
                                    <h2>Events by type</h2>
                                </div>
                            </div>
                            <div className="bar-list">
                                {metrics.eventBreakdown.map((event) => (
                                    <div className="bar-row" key={event.eventType}>
                                        <span>{eventLabels[event.eventType]}</span>
                                        <div>
                                            <i
                                                style={{
                                                    width: getMetricWidth(
                                                        event.count,
                                                        maxBreakdownCount
                                                    )
                                                }}
                                            />
                                        </div>
                                        <strong>{event.count}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="admin-section">
                            <div className="section-heading compact">
                                <div>
                                    <p className="eyebrow">Contexts</p>
                                    <h2>Where logs come from</h2>
                                </div>
                            </div>
                            <div className="bar-list">
                                {metrics.contextBreakdown.length > 0 ? (
                                    metrics.contextBreakdown.map((context) => (
                                        <div className="bar-row" key={context.context}>
                                            <span>{context.context}</span>
                                            <div>
                                                <i
                                                    style={{
                                                        width: getMetricWidth(
                                                            context.count,
                                                            maxContextCount
                                                        )
                                                    }}
                                                />
                                            </div>
                                            <strong>{context.count}</strong>
                                        </div>
                                    ))
                                ) : (
                                    <p className="empty-site-text">
                                        No logged contexts yet.
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="admin-section">
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">Items</p>
                                <h2>Highest scoring content</h2>
                            </div>
                        </div>
                        <div className="top-item-list">
                            {metrics.topItems.length > 0 ? (
                                metrics.topItems.map((item) => (
                                    <article className="top-item-row" key={`${item.itemName}-${item.artistName}`}>
                                        <div>
                                            <h3>{item.itemName}</h3>
                                            <p>{item.artistName ?? "Unknown artist"}</p>
                                        </div>
                                        <div className="score-bar">
                                            <span
                                                style={{
                                                    width: getMetricWidth(
                                                        item.score,
                                                        maxItemScore
                                                    )
                                                }}
                                            />
                                        </div>
                                        <strong>{item.score}</strong>
                                        <small>
                                            {item.plays} plays, {item.likes} likes,{" "}
                                            {item.saves} saves, {item.skips} skips
                                        </small>
                                    </article>
                                ))
                            ) : (
                                <p className="empty-site-text">
                                    No item-level interaction logs yet.
                                </p>
                            )}
                        </div>
                    </section>

                    <section className="admin-section">
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">Recent log</p>
                                <h2>Latest interactions</h2>
                            </div>
                        </div>
                        <div className="event-table" role="table" aria-label="Recent interactions">
                            <div role="row">
                                <span role="columnheader">Time</span>
                                <span role="columnheader">Event</span>
                                <span role="columnheader">Item</span>
                                <span role="columnheader">Context</span>
                            </div>
                            {metrics.recentEvents.length > 0 ? (
                                metrics.recentEvents.map((event) => (
                                    <div role="row" key={event.id}>
                                        <span role="cell">{formatDate(event.createdAt)}</span>
                                        <span role="cell">{eventLabels[event.eventType]}</span>
                                        <span role="cell">
                                            {event.itemName ?? event.itemType}
                                        </span>
                                        <span role="cell">
                                            {event.context ?? "Unspecified"}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="empty-site-text">
                                    No interactions have been logged yet.
                                </p>
                            )}
                        </div>
                    </section>
                </>
            ) : null}
        </main>
    );
}

export default AdminDashboardPage;
