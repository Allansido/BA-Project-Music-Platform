import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import ArtistSelector from "../components/ArtistSelector";
import GenreSelector from "../components/GenreSelector";
import {
    deleteAccount,
    getArtists,
    getGenres,
    updateProfile
} from "../api/authApi";
import type {
    OnboardingArtist,
    ProfileUpdatePayload,
    SafeUser
} from "../types/auth";

interface ProfilePageProps {
    user: SafeUser;
    onUserChange: (user: SafeUser) => void;
    onDeleteAccount: () => void;
}

const MIN_GENRE_COUNT = 3;
const MIN_ARTIST_COUNT = 3;
const producerServices = [
    "Beat making",
    "Recording",
    "Mixing",
    "Mastering",
    "Songwriting",
    "Artist development"
];
const releaseStatuses = [
    "Preparing first release",
    "Released music already",
    "Actively performing",
    "Looking for collaborators"
];
const collaborationGoals = [
    "Find artists to produce",
    "Find co-producers",
    "Offer studio services",
    "Discover emerging talent"
];
const listenerGoals = [
    "Find new favorite artists",
    "Follow local scenes",
    "Get better recommendations",
    "Explore outside my comfort zone"
];

function ProfilePage({
    user,
    onUserChange,
    onDeleteAccount
}: ProfilePageProps) {
    const navigate = useNavigate();
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [selectedGenres, setSelectedGenres] = useState<string[]>(user.genres);
    const [selectedArtists, setSelectedArtists] = useState<string[]>(
        user.favoriteArtists
    );
    const [listenerDiscoveryGoal, setListenerDiscoveryGoal] = useState(
        user.roleDetails.listener?.discoveryGoal ?? listenerGoals[0]
    );
    const [artistName, setArtistName] = useState(
        user.roleDetails.artist?.artistName ?? ""
    );
    const [artistLocation, setArtistLocation] = useState(
        user.roleDetails.artist?.location ?? ""
    );
    const [artistBio, setArtistBio] = useState(user.roleDetails.artist?.bio ?? "");
    const [artistReleaseStatus, setArtistReleaseStatus] = useState(
        user.roleDetails.artist?.releaseStatus ?? releaseStatuses[0]
    );
    const [producerName, setProducerName] = useState(
        user.roleDetails.producer?.producerName ?? ""
    );
    const [studioName, setStudioName] = useState(
        user.roleDetails.producer?.studioName ?? ""
    );
    const [selectedProducerServices, setSelectedProducerServices] = useState<
        string[]
    >(user.roleDetails.producer?.services ?? []);
    const [producerTools, setProducerTools] = useState(
        user.roleDetails.producer?.tools ?? ""
    );
    const [producerCollaborationGoal, setProducerCollaborationGoal] = useState(
        user.roleDetails.producer?.collaborationGoal ?? collaborationGoals[0]
    );
    const [availableGenres, setAvailableGenres] = useState<string[]>([]);
    const [availableArtists, setAvailableArtists] = useState<OnboardingArtist[]>([]);
    const [artistSearchTerm, setArtistSearchTerm] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [genreError, setGenreError] = useState("");
    const [artistError, setArtistError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    function clearFeedback() {
        setErrorMessage("");
        setSuccessMessage("");
    }

    useEffect(() => {
        async function loadProfileChoices() {
            const [genresResult, artistsResult] = await Promise.allSettled([
                getGenres(),
                getArtists()
            ]);

            if (genresResult.status === "fulfilled") {
                setAvailableGenres(genresResult.value);
            }

            if (artistsResult.status === "fulfilled") {
                setAvailableArtists(artistsResult.value);
            }

            if (genresResult.status === "rejected" || artistsResult.status === "rejected") {
                const error =
                    genresResult.status === "rejected"
                        ? genresResult.reason
                        : artistsResult.status === "rejected"
                          ? artistsResult.reason
                          : null;
                const message =
                    error instanceof Error
                        ? error.message
                        : "Could not load profile choices.";
                setErrorMessage(message);
            }
        }

        loadProfileChoices();
    }, []);

    function toggleGenre(genre: string) {
        setGenreError("");
        clearFeedback();

        setSelectedGenres((currentGenres) => {
            if (currentGenres.includes(genre)) {
                return currentGenres.filter((currentGenre) => currentGenre !== genre);
            }

            return [...currentGenres, genre];
        });
    }

    function toggleArtist(artist: string) {
        setArtistError("");
        clearFeedback();

        setSelectedArtists((currentArtists) => {
            if (currentArtists.includes(artist)) {
                return currentArtists.filter((currentArtist) => currentArtist !== artist);
            }

            return [...currentArtists, artist];
        });
    }

    function toggleProducerService(service: string) {
        clearFeedback();

        setSelectedProducerServices((currentServices) => {
            if (currentServices.includes(service)) {
                return currentServices.filter(
                    (currentService) => currentService !== service
                );
            }

            return [...currentServices, service];
        });
    }

    const roleSummary = useMemo(() => {
        if (user.role === "artist") {
            return artistName || "Artist profile";
        }

        if (user.role === "producer") {
            return producerName || "Producer profile";
        }

        return listenerDiscoveryGoal || "Listener profile";
    }, [artistName, listenerDiscoveryGoal, producerName, user.role]);

    function buildPayload(): ProfileUpdatePayload {
        let roleDetails: ProfileUpdatePayload["roleDetails"];

        if (user.role === "artist") {
            roleDetails = {
                artist: {
                    artistName,
                    location: artistLocation,
                    bio: artistBio,
                    releaseStatus: artistReleaseStatus
                }
            };
        } else if (user.role === "producer") {
            roleDetails = {
                producer: {
                    producerName,
                    studioName,
                    services: selectedProducerServices,
                    tools: producerTools,
                    collaborationGoal: producerCollaborationGoal
                }
            };
        } else {
            roleDetails = {
                listener: {
                    discoveryGoal: listenerDiscoveryGoal
                }
            };
        }

        return {
            name,
            email,
            genres: selectedGenres,
            favoriteArtists: selectedArtists,
            roleDetails
        };
    }

    function validateForm(): boolean {
        setErrorMessage("");
        setGenreError("");
        setArtistError("");
        setSuccessMessage("");

        if (!name.trim() || !email.trim()) {
            setErrorMessage("Name and email are required.");
            return false;
        }

        if (user.role === "artist" && !artistName.trim()) {
            setErrorMessage("Artist or project name is required.");
            return false;
        }

        if (user.role === "producer" && !producerName.trim()) {
            setErrorMessage("Producer name is required.");
            return false;
        }

        if (user.role === "producer" && selectedProducerServices.length === 0) {
            setErrorMessage("Choose at least one producer service.");
            return false;
        }

        if (selectedGenres.length < MIN_GENRE_COUNT) {
            setGenreError(`Choose at least ${MIN_GENRE_COUNT} genres.`);
            return false;
        }

        if (selectedArtists.length < MIN_ARTIST_COUNT) {
            setArtistError(`Choose at least ${MIN_ARTIST_COUNT} artists.`);
            return false;
        }

        return true;
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSaving(true);

        try {
            const updatedUser = await updateProfile(buildPayload());
            onUserChange(updatedUser);
            setSuccessMessage("Profile updated successfully.");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Profile update failed.";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDeleteAccount() {
        const confirmed = window.confirm(
            "Delete account?\n\nThis will permanently remove your account, delete your saved profile details, and sign you out immediately. This action cannot be undone."
        );

        if (!confirmed) {
            return;
        }

        setIsDeleting(true);
        clearFeedback();

        try {
            await deleteAccount();
            onDeleteAccount();
            navigate("/signup");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Account deletion failed.";
            setErrorMessage(message);
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <main className="profile-page">
            <Link className="back-link" to="/dashboard">
                Back to dashboard
            </Link>

            <section className="profile-hero-card">
                <div>
                    <p className="eyebrow">Profile</p>
                    <h1>{roleSummary}</h1>
                    <p className="subtitle">
                        Update your account details, taste profile and more
                    </p>
                </div>

                <div className="profile-avatar-panel">
                    <div className="profile-avatar-placeholder" aria-hidden="true">
                        {name.trim().charAt(0).toUpperCase() || "U"}
                    </div>
                </div>
            </section>

            <div className="profile-layout">
                <form className="profile-form-card" onSubmit={handleSubmit}>
                    <section className="profile-section">
                        <div className="section-heading compact">
                            <div>
                                <p className="eyebrow">Account</p>
                                <h2>Personal information</h2>
                            </div>
                        </div>

                        <div className="form-grid two-columns">
                            <div className="form-group">
                                <label className="form-label" htmlFor="profile-name">
                                    Full name
                                </label>
                                <input
                                    id="profile-name"
                                    className="form-input"
                                    type="text"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    autoComplete="name"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="profile-email">
                                    Email
                                </label>
                                <input
                                    id="profile-email"
                                    className="form-input"
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className="form-grid two-columns">
                            <div className="info-block">
                                <span className="profile-meta-label">Account type</span>
                                <strong>{user.role}</strong>
                            </div>
                            <div className="info-block">
                                <span className="profile-meta-label">Current summary</span>
                                <strong>{roleSummary}</strong>
                            </div>
                        </div>
                    </section>

                    <section className="profile-section">
                        <div className="section-heading compact">
                            <div>
                                <p className="eyebrow">Details</p>
                                <h2>Role profile</h2>
                            </div>
                        </div>

                        {user.role === "listener" ? (
                            <div className="role-grid">
                                {listenerGoals.map((goal) => (
                                    <button
                                        key={goal}
                                        type="button"
                                        className={`role-option ${
                                            listenerDiscoveryGoal === goal ? "selected" : ""
                                        }`}
                                        onClick={() => setListenerDiscoveryGoal(goal)}
                                    >
                                        <strong>{goal}</strong>
                                        <span>Guide recommendations and discovery.</span>
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {user.role === "artist" ? (
                            <>
                                <div className="form-grid two-columns">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="artist-name">
                                            Artist or project name
                                        </label>
                                        <input
                                            id="artist-name"
                                            className="form-input"
                                            type="text"
                                            value={artistName}
                                            onChange={(event) => setArtistName(event.target.value)}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="artist-location">
                                            Location
                                        </label>
                                        <input
                                            id="artist-location"
                                            className="form-input"
                                            type="text"
                                            value={artistLocation}
                                            onChange={(event) =>
                                                setArtistLocation(event.target.value)
                                            }
                                            placeholder="City or scene"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="artist-release-status">
                                        Artist journey
                                    </label>
                                    <select
                                        id="artist-release-status"
                                        className="form-input"
                                        value={artistReleaseStatus}
                                        onChange={(event) =>
                                            setArtistReleaseStatus(event.target.value)
                                        }
                                    >
                                        {releaseStatuses.map((status) => (
                                            <option key={status} value={status}>
                                                {status}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="artist-bio">
                                        Short bio
                                    </label>
                                    <textarea
                                        id="artist-bio"
                                        className="form-input textarea-input"
                                        value={artistBio}
                                        onChange={(event) => setArtistBio(event.target.value)}
                                        placeholder="A few words about your sound"
                                    />
                                </div>
                            </>
                        ) : null}

                        {user.role === "producer" ? (
                            <>
                                <div className="form-grid two-columns">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="producer-name">
                                            Producer name
                                        </label>
                                        <input
                                            id="producer-name"
                                            className="form-input"
                                            type="text"
                                            value={producerName}
                                            onChange={(event) =>
                                                setProducerName(event.target.value)
                                            }
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="studio-name">
                                            Studio or collective
                                        </label>
                                        <input
                                            id="studio-name"
                                            className="form-input"
                                            type="text"
                                            value={studioName}
                                            onChange={(event) => setStudioName(event.target.value)}
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>

                                <div className="choice-section">
                                    <div className="choice-section-heading">
                                        <label className="form-label">Services</label>
                                        <span>{selectedProducerServices.length} selected</span>
                                    </div>
                                    <div className="genre-grid">
                                        {producerServices.map((service) => (
                                            <button
                                                key={service}
                                                type="button"
                                                className={`choice-chip ${
                                                    selectedProducerServices.includes(service)
                                                        ? "selected"
                                                        : ""
                                                }`}
                                                onClick={() => toggleProducerService(service)}
                                            >
                                                {service}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-grid two-columns">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="producer-tools">
                                            Tools
                                        </label>
                                        <input
                                            id="producer-tools"
                                            className="form-input"
                                            type="text"
                                            value={producerTools}
                                            onChange={(event) =>
                                                setProducerTools(event.target.value)
                                            }
                                            placeholder="Ableton, Logic, MPC"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label
                                            className="form-label"
                                            htmlFor="collaboration-goal"
                                        >
                                            Main goal
                                        </label>
                                        <select
                                            id="collaboration-goal"
                                            className="form-input"
                                            value={producerCollaborationGoal}
                                            onChange={(event) =>
                                                setProducerCollaborationGoal(event.target.value)
                                            }
                                        >
                                            {collaborationGoals.map((goal) => (
                                                <option key={goal} value={goal}>
                                                    {goal}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </section>

                    <section className="profile-section">
                        <div className="section-heading compact">
                            <div>
                                <p className="eyebrow">Taste</p>
                                <h2>Genres</h2>
                            </div>
                        </div>
                        <GenreSelector
                            genres={availableGenres}
                            selectedGenres={selectedGenres}
                            onToggleGenre={toggleGenre}
                            error={genreError}
                        />
                    </section>

                    <section className="profile-section">
                        <div className="section-heading compact">
                            <div>
                                <p className="eyebrow">Taste</p>
                                <h2>Favorite artists</h2>
                            </div>
                        </div>
                        <ArtistSelector
                            artists={availableArtists}
                            selectedArtists={selectedArtists}
                            searchTerm={artistSearchTerm}
                            onSearchTermChange={setArtistSearchTerm}
                            onToggleArtist={toggleArtist}
                            error={artistError}
                        />
                    </section>

                    {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
                    {successMessage ? (
                        <p className="success-text">{successMessage}</p>
                    ) : null}

                    <div className="form-actions profile-actions">
                        <Link className="secondary-button nav-button" to="/dashboard">
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            className="primary-button"
                            disabled={isSaving || isDeleting}
                        >
                            {isSaving ? "Saving..." : "Save changes"}
                        </button>
                    </div>
                </form>
            </div>

            <div className="profile-delete-footer">
                <button
                    type="button"
                    className="delete-account-link"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || isSaving}
                >
                    {isDeleting ? "Deleting..." : "Delete account"}
                </button>
            </div>
        </main>
    );
}

export default ProfilePage;
