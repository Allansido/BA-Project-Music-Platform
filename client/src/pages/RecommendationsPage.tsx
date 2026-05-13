import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { trackInteraction } from "../api/analyticsApi";
import { getRecommendations } from "../api/recommendationApi";
import MusicLogo from "../components/MusicLogo";
import type { AnalyticsEventType } from "../types/analytics";
import type {
    RecommendationResult,
    RecommendedArtist,
    RecommendedTrack
} from "../types/recommendations";

function getScorePercent(score: number, maxScore: number): string {
    if (maxScore <= 0) {
        return "0%";
    }

    return `${Math.max(8, Math.round((score / maxScore) * 100))}%`;
}

function formatScore(score: number): number {
    return Math.ceil(score);
}

function RecommendationsPage() {
    const [recommendations, setRecommendations] =
        useState<RecommendationResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        async function loadRecommendations() {
            try {
                const nextRecommendations = await getRecommendations();
                setRecommendations(nextRecommendations);
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : "Could not load recommendations.";
                setErrorMessage(message);
            } finally {
                setIsLoading(false);
            }
        }

        loadRecommendations();
    }, []);

    const topArtist = recommendations?.artists[0] ?? null;
    const fairness = recommendations?.fairness;
    const maxArtistScore = useMemo(
        () =>
            Math.max(
                ...((recommendations?.artists ?? []).map((artist) => artist.score)),
                0
            ),
        [recommendations]
    );
    const maxTrackScore = useMemo(
        () =>
            Math.max(
                ...((recommendations?.tracks ?? []).map((track) => track.score)),
                0
            ),
        [recommendations]
    );

    function trackArtistClick(artist: RecommendedArtist) {
        trackInteraction({
            eventType: "click",
            itemType: "artist",
            itemId: artist.artistId,
            itemName: artist.artistName,
            context: "recommendations"
        });
    }

    function trackTrackAction(
        eventType: AnalyticsEventType,
        track: RecommendedTrack
    ) {
        trackInteraction({
            eventType,
            itemType: "track",
            itemId: track.trackId,
            itemName: track.trackName,
            artistName: track.artistName,
            context: "recommendations"
        });
    }

    return (
        <main className="recommendations-page">
            <header className="recommendations-header">
                <div>
                    <Link className="back-link" to="/dashboard">
                        Back to dashboard
                    </Link>
                    <p className="eyebrow">Baseline recommender</p>
                    <h1>Recommendations</h1>
                    <p className="subtitle">
                        Popular artists and tracks from the listening dataset, filtered
                        through the baseline recommender.
                    </p>
                </div>
                <MusicLogo className="recommendations-artwork" />
            </header>

            {isLoading ? (
                <p className="loading-pill">Loading recommendations...</p>
            ) : null}

            {errorMessage ? (
                <div className="empty-state-panel">
                    <p className="error-text">{errorMessage}</p>
                    {errorMessage === "Not logged in." ? (
                        <p>
                            Your browser did not send the backend session cookie.
                            Log in again using the same address as this page.
                        </p>
                    ) : null}
                    <Link className="primary-button nav-button" to="/login">
                        Go to login
                    </Link>
                </div>
            ) : null}

            {recommendations && !isLoading ? (
                <>
                    <section className="recommendation-overview">
                        <div className="metric-block">
                            <span>Artist matches</span>
                            <strong>{recommendations.artists.length}</strong>
                        </div>
                        <div className="metric-block">
                            <span>Track matches</span>
                            <strong>{recommendations.tracks.length}</strong>
                        </div>
                        <div className="metric-block">
                            <span>Strongest signal</span>
                            <strong>{topArtist?.artistName ?? "No artists yet"}</strong>
                        </div>
                    </section>

                    {fairness?.enabled ? (
                        <section className="spotlight-panel">
                            <div>
                                <p className="eyebrow">Fairness rule</p>
                                <h2>
                                    Prefix fairness for emerging creators
                                </h2>
                                <p>
                                    {fairness.prefixCheckpoints
                                        .map((checkpoint) => (
                                            `${checkpoint.minimumExposureByGroup.emerging ?? 0} in top ${checkpoint.topK}`
                                        ))
                                        .join(", ")}
                                </p>
                                <p>
                                    Artists: {fairness.artists.afterTopN.emerging} emerging /{" "}
                                    {fairness.artists.afterTopN.established} established. Tracks:{" "}
                                    {fairness.tracks.afterTopN.emerging} emerging /{" "}
                                    {fairness.tracks.afterTopN.established} established.
                                </p>
                                <p>
                                    Fairness re-ranking considers the top{" "}
                                    {fairness.candidatePoolSize} baseline candidates before
                                    producing the final top {fairness.topN}.
                                </p>
                                {!fairness.artists.quotaAchievable
                                    || !fairness.tracks.quotaAchievable ? (
                                    <p>
                                        The current candidate pool does not contain enough
                                        emerging items to fully meet the requested quota, so the
                                        result is shown as best effort.
                                    </p>
                                ) : null}
                            </div>
                            <div className="score-badge">
                                <span>Quota status</span>
                                <strong>
                                    {fairness.artists.quotaSatisfied && fairness.tracks.quotaSatisfied
                                        ? "Met"
                                        : fairness.artists.quotaAchievable
                                            && fairness.tracks.quotaAchievable
                                            ? "Not met"
                                            : "Best effort"}
                                </strong>
                            </div>
                        </section>
                    ) : null}

                    {topArtist ? (
                        <section className="spotlight-panel">
                            <div>
                                <p className="eyebrow">Top artist</p>
                                <h2>{topArtist.artistName}</h2>
                                <p>{topArtist.reason}</p>
                            </div>
                            <div className="score-badge">
                                <span>Score</span>
                                <strong>{formatScore(topArtist.score)}</strong>
                            </div>
                        </section>
                    ) : null}

                    <section className="recommendation-section">
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">Artists</p>
                                <h2>People to explore</h2>
                            </div>
                        </div>

                        <div className="recommendation-grid">
                            {recommendations.artists.map((artist, index) => (
                                <article
                                    className="recommendation-card"
                                    key={artist.artistId ?? artist.artistName}
                                >
                                    <div className="recommendation-card-top">
                                        <span className="rank-pill">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className="score-label">
                                            Score {formatScore(artist.score)}
                                        </span>
                                    </div>
                                    <h3>{artist.artistName}</h3>
                                    <p className="eyebrow">
                                        {artist.creatorGroup === "emerging"
                                            ? "Emerging creator"
                                            : "Established creator"}
                                    </p>
                                    <p>{artist.reason}</p>
                                    <div
                                        className="score-bar"
                                        aria-label={`Score ${formatScore(artist.score)}`}
                                    >
                                        <span
                                            style={{
                                                width: getScorePercent(
                                                    artist.score,
                                                    maxArtistScore
                                                )
                                            }}
                                        />
                                    </div>
                                    <div className="interaction-actions">
                                        <button
                                            type="button"
                                            onClick={() => trackArtistClick(artist)}
                                        >
                                            Open
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="recommendation-section">
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">Tracks</p>
                                <h2>Songs with momentum</h2>
                            </div>
                        </div>

                        <div className="track-list">
                            {recommendations.tracks.map((track, index) => (
                                <article
                                    className="track-row"
                                    key={track.trackId ?? `${track.artistName}-${track.trackName}`}
                                >
                                    <span className="rank-pill">
                                        {String(index + 1).padStart(2, "0")}
                                    </span>
                                    <div>
                                        <h3>{track.trackName}</h3>
                                        <p>
                                            {track.artistName} ·{" "}
                                            {track.creatorGroup === "emerging"
                                                ? "Emerging creator"
                                                : "Established creator"}
                                        </p>
                                    </div>
                                    <div className="track-score">
                                        <span>{track.reason}</span>
                                        <div
                                            className="score-bar"
                                            aria-label={`Score ${formatScore(track.score)}`}
                                        >
                                            <span
                                                style={{
                                                    width: getScorePercent(
                                                        track.score,
                                                        maxTrackScore
                                                    )
                                                }}
                                            />
                                        </div>
                                        <div className="interaction-actions compact">
                                            <button
                                                type="button"
                                                onClick={() => trackTrackAction("play", track)}
                                            >
                                                Play
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => trackTrackAction("skip", track)}
                                            >
                                                Skip
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => trackTrackAction("like", track)}
                                            >
                                                Like
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => trackTrackAction("save", track)}
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                    <strong>{formatScore(track.score)}</strong>
                                </article>
                            ))}
                        </div>
                    </section>
                </>
            ) : null}
        </main>
    );
}

export default RecommendationsPage;
