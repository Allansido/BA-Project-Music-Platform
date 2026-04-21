import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/authApi";
import { getRecommendations } from "../api/recommendationApi";
import type { SafeUser } from "../types/auth";
import type { RecommendationResult } from "../types/recommendations";

interface DashboardPageProps {
    user: SafeUser;
    onLogout: () => void;
}

const sidebarItems = [
    { icon: "⌂", label: "Home", to: "/dashboard" },
    { icon: "⌕", label: "Search" },
    { icon: "▤", label: "Library" },
    { icon: "♪", label: "Recommendations", to: "/recommendations" },
    { icon: "★", label: "Artists", to: "/artists" },
    { icon: "◉", label: "Radio" },
    { icon: "+", label: "Create playlist" },
    { icon: "⇧", label: "Upload" }
];

const fallbackUpcomingArtists = [
    {
        name: "Velvet Signal",
        tag: "Indie electronic",
        note: "Building a quiet late-night following"
    },
    {
        name: "Mina Vale",
        tag: "Alt pop",
        note: "New demos gaining listener saves"
    },
    {
        name: "North Arcade",
        tag: "Post-rock",
        note: "High discovery potential this week"
    },
    {
        name: "Juno Park",
        tag: "Bedroom soul",
        note: "Early audience with strong repeat plays"
    }
];

function getRoleSummary(user: SafeUser): string {
    if (user.role === "artist") {
        return user.roleDetails.artist?.artistName || "Artist profile";
    }

    if (user.role === "producer") {
        return user.roleDetails.producer?.producerName || "Producer profile";
    }

    return user.roleDetails.listener?.discoveryGoal || "Listener profile";
}

function DashboardPage({ user, onLogout }: DashboardPageProps) {
    const navigate = useNavigate();
    const [recommendations, setRecommendations] =
        useState<RecommendationResult | null>(null);
    const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
    const [recommendationError, setRecommendationError] = useState("");

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
                setRecommendationError(message);
            } finally {
                setIsLoadingRecommendations(false);
            }
        }

        loadRecommendations();
    }, []);

    const featuredArtist = recommendations?.artists[0] ?? null;
    const previewTracks = useMemo(
        () => recommendations?.tracks.slice(0, 4) ?? [],
        [recommendations]
    );
    const previewArtists = useMemo(
        () => recommendations?.artists.slice(0, 4) ?? [],
        [recommendations]
    );
    const upcomingArtists = useMemo(
        () =>
            previewArtists.length > 0
                ? previewArtists.map((artist) => ({
                      name: artist.artistName,
                      tag: "Recommended artist",
                      note: artist.reason
                  }))
                : fallbackUpcomingArtists,
        [previewArtists]
    );

    async function handleLogout() {
        try {
            await logout();
        } catch {
            // Even if logout request fails, clear frontend user state
        } finally {
            onLogout();
            navigate("/login");
        }
    }

    return (
        <main className="app-shell">
            <aside className="sidebar" aria-label="Music platform navigation">
                <Link className="brand-lockup" to="/dashboard">
                    <span aria-hidden="true">&#9835;</span>
                    Music Platform
                </Link>

                <nav className="sidebar-nav">
                    {sidebarItems.map((item) =>
                        item.to ? (
                            <Link key={item.label} to={item.to}>
                                <span aria-hidden="true">{item.icon}</span>
                                {item.label}
                            </Link>
                        ) : (
                            <button key={item.label} type="button">
                                <span aria-hidden="true">{item.icon}</span>
                                {item.label}
                            </button>
                        )
                    )}
                </nav>

                <div className="sidebar-profile">
                    <span>{user.role}</span>
                    <strong>{getRoleSummary(user)}</strong>
                    <button type="button" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </aside>

            <div className="home-page">
                <section className="home-hero">
                    <div>
                        <p className="eyebrow">Good to see you, {user.name}</p>
                        <h1>Find your next sound.</h1>
                        <p className="subtitle">
                            {getRoleSummary(user)} · {user.genres.slice(0, 3).join(", ")}
                        </p>
                        <div className="hero-actions">
                            <button type="button" className="primary-button">
                                Play discovery mix
                            </button>
                            <Link
                                className="secondary-button nav-button"
                                to="/recommendations"
                            >
                                Open recommendations
                            </Link>
                        </div>
                    </div>

                    <div className="now-playing-panel">
                        <span>Featured recommendation</span>
                        <strong>{featuredArtist?.artistName ?? "Loading..."}</strong>
                        <p>
                            {featuredArtist?.reason ??
                                "Preparing recommendations from the listening dataset."}
                        </p>
                    </div>
                </section>

                <section className="home-section">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Recommended</p>
                            <h2>Based on baseline data</h2>
                        </div>
                        <Link to="/recommendations">See all</Link>
                    </div>

                    {isLoadingRecommendations ? (
                        <p className="loading-pill">Loading recommendations...</p>
                    ) : null}

                    {recommendationError ? (
                        <p className="error-text">{recommendationError}</p>
                    ) : null}

                    <div className="music-row">
                        {previewTracks.map((track, index) => (
                            <article
                                className="music-tile"
                                key={track.trackId ?? `${track.artistName}-${track.trackName}`}
                            >
                                <span className="rank-pill">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                <h3>{track.trackName}</h3>
                                <p>{track.artistName}</p>
                                <small>Score {track.score}</small>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="home-section">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Artists</p>
                            <h2>Upcoming artists</h2>
                        </div>
                        <Link to="/artists">Open artist page</Link>
                    </div>

                    <Link className="artist-row-link" to="/artists">
                        <div className="artist-row">
                            {upcomingArtists.map((artist) => (
                                <article className="artist-preview" key={artist.name}>
                                    <span aria-hidden="true">
                                        {artist.name.charAt(0).toUpperCase()}
                                    </span>
                                    <h3>{artist.name}</h3>
                                    <p>{artist.tag}</p>
                                    <small>{artist.note}</small>
                                </article>
                            ))}
                        </div>
                    </Link>
                </section>

                <section className="home-section profile-strip">
                    <div>
                        <p className="eyebrow">Your profile</p>
                        <h2>{getRoleSummary(user)}</h2>
                    </div>
                    <p>{user.favoriteArtists.slice(0, 4).join(", ")}</p>
                </section>
            </div>
        </main>
    );
}

export default DashboardPage;
