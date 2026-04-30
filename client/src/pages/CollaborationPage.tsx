import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/authApi";
import { getRecommendations } from "../api/recommendationApi";
import type {
    ArtistDetails,
    ProducerDetails,
    SafeUser
} from "../types/auth";
import type {
    RecommendedArtist,
    RecommendedTrack,
    RecommendationResult
} from "../types/recommendations";

interface CollaborationPageProps {
    user: SafeUser;
    onLogout: () => void;
}

interface JobPick {
    title: string;
    company: string;
    badge: string;
    meta: string;
    details: string;
}

function getArtistDetails(user: SafeUser): ArtistDetails | undefined {
    return user.roleDetails.artist;
}

function getProducerDetails(user: SafeUser): ProducerDetails | undefined {
    return user.roleDetails.producer;
}

function getDisplayName(user: SafeUser): string {
    return (
        getArtistDetails(user)?.artistName ||
        getProducerDetails(user)?.producerName ||
        user.name
    );
}

function getLocationLabel(user: SafeUser): string {
    const artistLocation = getArtistDetails(user)?.location;
    const producerLocation = getProducerDetails(user)?.location;
    const studioName = getProducerDetails(user)?.studioName;

    return artistLocation || producerLocation || studioName || "your area";
}

function getServices(user: SafeUser): string[] {
    if (user.role === "artist") {
        return getArtistDetails(user)?.services ?? [];
    }

    return getProducerDetails(user)?.services ?? [];
}

function getCollaborationGoal(user: SafeUser): string {
    if (user.role === "artist") {
        return (
            getArtistDetails(user)?.collaborationGoal ||
            "Find producers for the next release"
        );
    }

    return (
        getProducerDetails(user)?.collaborationGoal ||
        "Discover emerging talent"
    );
}

function getResumeLink(user: SafeUser): string {
    if (user.role === "artist") {
        return getArtistDetails(user)?.resumeLink ?? "";
    }

    return getProducerDetails(user)?.resumeLink ?? "";
}

function getRoleHeadline(user: SafeUser): string {
    const services = getServices(user);
    const topGenre = user.genres[0] ?? "Genre-flexible";

    if (user.role === "artist") {
        return `${services[0] ?? "Artist"} open for ${topGenre.toLowerCase()} collaborations`;
    }

    return `${services[0] ?? "Producer"} building ${topGenre.toLowerCase()} sessions`;
}

function getPrimaryCallToAction(user: SafeUser): string {
    return getResumeLink(user) ? "Apply for job" : "Add resume";
}

function getProfileStrength(user: SafeUser): number {
    const fields = [
        user.name,
        user.email,
        ...user.genres.slice(0, 3),
        ...user.favoriteArtists.slice(0, 3),
        getDisplayName(user),
        getLocationLabel(user),
        getCollaborationGoal(user),
        ...getServices(user).slice(0, 2),
        getResumeLink(user)
    ];
    const completedFields = fields.filter((value) => value.trim().length > 0);

    return Math.min(100, Math.round((completedFields.length / fields.length) * 100));
}

function buildJobPicks(
    user: SafeUser,
    collaborators: RecommendedArtist[]
): JobPick[] {
    const services = getServices(user);
    const topGenre = user.genres[0] ?? "Indie";
    const secondGenre = user.genres[1] ?? topGenre;
    const area = getLocationLabel(user);
    const primaryService =
        services[0] ?? (user.role === "artist" ? "Vocalist" : "Producer");
    const collaboratorName = collaborators[0]?.artistName ?? "North Arcade";
    const nextCollaborator = collaborators[1]?.artistName ?? "Velvet Signal";

    if (user.role === "artist") {
        return [
            {
                title:
                    primaryService.toLowerCase() === "vocals"
                        ? `Vocalist gigs in ${area}`
                        : `${primaryService} collaborations in ${area}`,
                company: `${topGenre} writer camp`,
                badge: "Top job pick for you",
                meta: "Remote-friendly · 2 applications this week",
                details: `Built for artists chasing ${topGenre.toLowerCase()} releases and faster demo turnarounds.`
            },
            {
                title: `Featured artist opening with ${collaboratorName}`,
                company: `${secondGenre} release sprint`,
                badge: "Fresh match",
                meta: "Featured vocal slot · Paid split available",
                details: `Your taste profile overlaps with listeners already engaging with ${collaboratorName}.`
            },
            {
                title: "Songwriting circle looking for hooks",
                company: `${nextCollaborator} network`,
                badge: "Network pick",
                meta: "Weekly sessions · Invite only",
                details: `A smaller collaboration room tuned for artists who want stronger topline and chorus work.`
            }
        ];
    }

    return [
        {
            title: `${primaryService} briefs in ${area}`,
            company: `${topGenre} creator collective`,
            badge: "Top job pick for you",
            meta: "3 open briefs · Paid session work",
            details: `Profiles like yours are getting pulled into fast-turnaround ${topGenre.toLowerCase()} projects.`
        },
        {
            title: `Emerging artist roster near ${area}`,
            company: `${collaboratorName} adjacent scene`,
            badge: "Talent radar",
            meta: "4 artists need production support",
            details: `Good fit for producers focused on discovery and development rather than one-off mixing.`
        },
        {
            title: "Co-producer call for release sprint",
            company: `${secondGenre} writing room`,
            badge: "High intent",
            meta: "Remote session · Weekly drop cycle",
            details: `A concise brief for producers who want recurring work and stronger creative continuity.`
        }
    ];
}

function buildFallbackCollaborators(user: SafeUser): RecommendedArtist[] {
    return user.favoriteArtists.slice(0, 4).map((artistName, index) => ({
        artistId: null,
        artistName,
        score: 100 - index * 12,
        reason: "Close taste overlap from your saved artist profile"
    }));
}

function buildFeedBriefs(tracks: RecommendedTrack[]): string[] {
    if (tracks.length === 0) {
        return [
            "Underground vocalist briefs are refreshing based on saved genres.",
            "Emerging creators with repeat plays are being prioritized this week.",
            "Keep profile services updated to improve job match quality."
        ];
    }

    return tracks.slice(0, 3).map((track) => `${track.trackName} by ${track.artistName}`);
}

function CollaborationPage({ user, onLogout }: CollaborationPageProps) {
    const navigate = useNavigate();
    const [recommendations, setRecommendations] = useState<RecommendationResult | null>(
        null
    );
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
                        : "Could not load collaboration suggestions.";
                setErrorMessage(message);
            } finally {
                setIsLoading(false);
            }
        }

        loadRecommendations();
    }, []);

    const collaboratorCards = useMemo(() => {
        const recommendedArtists = recommendations?.artists ?? [];
        return recommendedArtists.length > 0
            ? recommendedArtists.slice(0, 4)
            : buildFallbackCollaborators(user);
    }, [recommendations, user]);

    const jobPicks = useMemo(
        () => buildJobPicks(user, collaboratorCards),
        [collaboratorCards, user]
    );
    const feedBriefs = useMemo(
        () => buildFeedBriefs(recommendations?.tracks ?? []),
        [recommendations]
    );
    const resumeLink = getResumeLink(user);
    const profileStrength = getProfileStrength(user);

    async function handleLogout() {
        try {
            await logout();
        } catch {
            // Clear frontend user state even if the request fails
        } finally {
            onLogout();
            navigate("/login");
        }
    }

    return (
        <main className="collaboration-shell">
            <aside className="collaboration-sidebar" aria-label="Collaboration navigation">
                <Link className="brand-lockup" to="/collaboration">
                    <span aria-hidden="true">&#9835;</span>
                    Music Platform
                </Link>

                <nav className="collaboration-nav">
                    <Link to="/collaboration">Home</Link>
                    <Link to="/profile">Resume</Link>
                </nav>

                <div className="sidebar-profile collaboration-profile-card">
                    <span>{user.role}</span>
                    <strong>{getDisplayName(user)}</strong>
                    <small>{getRoleHeadline(user)}</small>
                    <Link to="/profile">Profile</Link>
                    <button type="button" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </aside>

            <div className="collaboration-page">
                <section className="collaboration-hero">
                    <div>
                        <p className="eyebrow">Collaboration hub</p>
                        <h1>Work with artists who fit your sound.</h1>
                        <p className="subtitle">
                            {getRoleHeadline(user)} · {getLocationLabel(user)} ·{" "}
                            {getCollaborationGoal(user)}
                        </p>
                        <div className="hero-actions">
                            <Link className="primary-button nav-button" to="/profile">
                                {getPrimaryCallToAction(user)}
                            </Link>
                            <Link className="secondary-button nav-button" to="/profile">
                                Update profile
                            </Link>
                        </div>
                    </div>

                    <div className="collaboration-hero-panel">
                        <span>Profile strength</span>
                        <strong>{profileStrength}%</strong>
                        <p>
                            {resumeLink
                                ? "Resume attached and ready for quick applications."
                                : "Add a resume or portfolio link so applications feel complete."}
                        </p>
                    </div>
                </section>

                <div className="collaboration-layout">
                    <section className="collaboration-main">
                        <section className="home-section collaboration-section">
                            <div className="section-heading">
                                <div>
                                    <p className="eyebrow">Opportunities</p>
                                    <h2>Top job picks for you</h2>
                                </div>
                            </div>

                            <div className="job-picks-grid">
                                {jobPicks.map((job) => (
                                    <article className="job-pick-card" key={job.title}>
                                        <span className="job-badge">{job.badge}</span>
                                        <h3>{job.title}</h3>
                                        <p className="job-company">{job.company}</p>
                                        <p>{job.details}</p>
                                        <small>{job.meta}</small>
                                        <div className="job-actions">
                                            <Link
                                                className="primary-button nav-button"
                                                to="/profile"
                                            >
                                                {getPrimaryCallToAction(user)}
                                            </Link>
                                            <Link
                                                className="secondary-button nav-button"
                                                to="/profile"
                                            >
                                                View profile
                                            </Link>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>

                        <section className="home-section collaboration-section">
                            <div className="section-heading">
                                <div>
                                    <p className="eyebrow">Network</p>
                                    <h2>Artists to collaborate with</h2>
                                </div>
                            </div>

                            {isLoading ? (
                                <p className="loading-pill">Loading collaboration matches...</p>
                            ) : null}

                            {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

                            <div className="collaborator-grid">
                                {collaboratorCards.map((artist) => (
                                    <article
                                        className="collaborator-card"
                                        key={artist.artistId ?? artist.artistName}
                                    >
                                        <div className="collaborator-card-top">
                                            <span aria-hidden="true">
                                                {artist.artistName.charAt(0).toUpperCase()}
                                            </span>
                                            <strong>{Math.ceil(artist.score)} match</strong>
                                        </div>
                                        <h3>{artist.artistName}</h3>
                                        <p>{artist.reason}</p>
                                        <div className="collaborator-card-actions">
                                            <Link
                                                className="secondary-button nav-button"
                                                to="/profile"
                                            >
                                                Connect
                                            </Link>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    </section>

                    <aside className="collaboration-side-rail">
                        <section className="rail-card">
                            <p className="eyebrow">Resume</p>
                            <h2>{resumeLink ? "Resume ready" : "Add your resume"}</h2>
                            <p>
                                {resumeLink
                                    ? "Your current profile includes a resume or portfolio link that can support fast applications."
                                    : "Use the profile page to add a resume or portfolio link before applying to collaboration gigs."}
                            </p>
                            <Link className="primary-button nav-button" to="/profile">
                                {resumeLink ? "Update resume" : "Add resume"}
                            </Link>
                        </section>

                        <section className="rail-card">
                            <p className="eyebrow">Signals</p>
                            <h2>What is working right now</h2>
                            <div className="metric-stack">
                                <div className="metric-block">
                                    <span>Matching genres</span>
                                    <strong>{user.genres.slice(0, 3).join(", ")}</strong>
                                </div>
                                <div className="metric-block">
                                    <span>Open services</span>
                                    <strong>{getServices(user).slice(0, 3).join(", ") || "Add services"}</strong>
                                </div>
                                <div className="metric-block">
                                    <span>Application status</span>
                                    <strong>{resumeLink ? "Ready to apply" : "Needs resume"}</strong>
                                </div>
                            </div>
                        </section>

                        <section className="rail-card">
                            <p className="eyebrow">Talent radar</p>
                            <h2>Fresh briefs</h2>
                            <div className="brief-list">
                                {feedBriefs.map((brief) => (
                                    <article className="brief-item" key={brief}>
                                        <strong>{brief}</strong>
                                    </article>
                                ))}
                            </div>
                        </section>
                    </aside>
                </div>
            </div>
        </main>
    );
}

export default CollaborationPage;
