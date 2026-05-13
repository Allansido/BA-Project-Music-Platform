import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import ArtistSelector from "../components/ArtistSelector";
import GenreSelector from "../components/GenreSelector";
import { getArtists, getGenres, signup } from "../api/authApi";
import MusicLogo from "../components/MusicLogo";
import type { OnboardingArtist, SafeUser, UserRole } from "../types/auth";

interface SignupPageProps {
    onSignupSuccess: (user: SafeUser) => void;
}

type SignupStep = 0 | 1 | 2 | 3 | 4 | 5;

const signupSteps = ["Account", "Type", "Profile", "Genres", "Artists", "Review"];
const MIN_PASSWORD_LENGTH = 8;
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
const artistServices = [
    "Vocals",
    "Songwriting",
    "Toplining",
    "Live performance",
    "Guitar",
    "Keys"
];
const releaseStatuses = [
    "Preparing first release",
    "Released music already",
    "Actively performing",
    "Looking for collaborators"
];
const artistCollaborationGoals = [
    "Find producers for my next release",
    "Pitch for featured vocals",
    "Join writing sessions",
    "Build a live set with collaborators"
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

const roleOptions: Array<{
    value: UserRole;
    title: string;
    description: string;
}> = [
    {
        value: "listener",
        title: "Listener",
        description: "Find music and shape recommendations around your taste."
    },
    {
        value: "artist",
        title: "Artist",
        description: "Build a profile around your sound and future releases."
    },
    {
        value: "producer",
        title: "Producer",
        description: "Track scenes, collaborators, and artists with momentum."
    }
];

function SignupPage({ onSignupSuccess }: SignupPageProps) {
    const navigate = useNavigate();

    const [currentStep, setCurrentStep] = useState<SignupStep>(0);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<UserRole>("listener");
    const [availableGenres, setAvailableGenres] = useState<string[]>([]);
    const [availableArtists, setAvailableArtists] = useState<OnboardingArtist[]>([]);
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
    const [artistSearchTerm, setArtistSearchTerm] = useState("");
    const [listenerDiscoveryGoal, setListenerDiscoveryGoal] = useState(
        listenerGoals[0]
    );
    const [artistName, setArtistName] = useState("");
    const [artistLocation, setArtistLocation] = useState("");
    const [artistBio, setArtistBio] = useState("");
    const [artistReleaseStatus, setArtistReleaseStatus] = useState(
        releaseStatuses[0]
    );
    const [selectedArtistServices, setSelectedArtistServices] = useState<string[]>(
        []
    );
    const [artistCollaborationGoal, setArtistCollaborationGoal] = useState(
        artistCollaborationGoals[0]
    );
    const [artistResumeLink, setArtistResumeLink] = useState("");
    const [producerName, setProducerName] = useState("");
    const [producerLocation, setProducerLocation] = useState("");
    const [studioName, setStudioName] = useState("");
    const [selectedProducerServices, setSelectedProducerServices] = useState<
        string[]
    >([]);
    const [producerTools, setProducerTools] = useState("");
    const [producerCollaborationGoal, setProducerCollaborationGoal] = useState(
        collaborationGoals[0]
    );
    const [producerResumeLink, setProducerResumeLink] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [genreError, setGenreError] = useState("");
    const [artistError, setArtistError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedRole = useMemo(
        () => roleOptions.find((roleOption) => roleOption.value === role),
        [role]
    );

    useEffect(() => {
        async function loadSignupChoices() {
            const [genresResult, artistsResult] = await Promise.allSettled([
                getGenres(),
                getArtists()
            ]);

            if (genresResult.status === "fulfilled") {
                const genres = genresResult.value;
                setAvailableGenres(genres);
            }

            if (artistsResult.status === "fulfilled") {
                const artists = artistsResult.value;
                setAvailableArtists(artists);
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
                        : "Could not load signup choices.";
                setErrorMessage(message);
            }
        }

        loadSignupChoices();
    }, []);

    function toggleGenre(genre: string) {
        setGenreError("");

        setSelectedGenres((currentGenres) => {
            if (currentGenres.includes(genre)) {
                return currentGenres.filter((currentGenre) => currentGenre !== genre);
            }

            return [...currentGenres, genre];
        });
    }

    function toggleArtist(artistName: string) {
        setArtistError("");

        setSelectedArtists((currentArtists) => {
            if (currentArtists.includes(artistName)) {
                return currentArtists.filter(
                    (currentArtist) => currentArtist !== artistName
                );
            }

            return [...currentArtists, artistName];
        });
    }

    function toggleProducerService(service: string) {
        setSelectedProducerServices((currentServices) => {
            if (currentServices.includes(service)) {
                return currentServices.filter(
                    (currentService) => currentService !== service
                );
            }

            return [...currentServices, service];
        });
    }

    function toggleArtistService(service: string) {
        setSelectedArtistServices((currentServices) => {
            if (currentServices.includes(service)) {
                return currentServices.filter(
                    (currentService) => currentService !== service
                );
            }

            return [...currentServices, service];
        });
    }

    function buildRoleDetails() {
        if (role === "artist") {
            return {
                artist: {
                    artistName,
                    location: artistLocation,
                    bio: artistBio,
                    releaseStatus: artistReleaseStatus,
                    services: selectedArtistServices,
                    collaborationGoal: artistCollaborationGoal,
                    resumeLink: artistResumeLink
                }
            };
        }

        if (role === "producer") {
            return {
                producer: {
                    producerName,
                    location: producerLocation,
                    studioName,
                    services: selectedProducerServices,
                    tools: producerTools,
                    collaborationGoal: producerCollaborationGoal,
                    resumeLink: producerResumeLink
                }
            };
        }

        return {
            listener: {
                discoveryGoal: listenerDiscoveryGoal
            }
        };
    }

    function validateCurrentStep(): boolean {
        setErrorMessage("");
        setGenreError("");
        setArtistError("");

        if (currentStep === 0) {
            if (!name.trim() || !email.trim() || !password) {
                setErrorMessage("Add your name, email, and password to continue.");
                return false;
            }

            if (password.length < MIN_PASSWORD_LENGTH) {
                setErrorMessage(
                    `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`
                );
                return false;
            }
        }

        if (currentStep === 2) {
            if (role === "artist" && !artistName.trim()) {
                setErrorMessage("Add your artist or project name to continue.");
                return false;
            }

            if (role === "producer" && !producerName.trim()) {
                setErrorMessage("Add your producer name to continue.");
                return false;
            }

            if (
                role === "producer" &&
                selectedProducerServices.length === 0
            ) {
                setErrorMessage("Choose at least one producer service.");
                return false;
            }
        }

        if (currentStep === 3 && selectedGenres.length < MIN_GENRE_COUNT) {
            setGenreError(`Choose at least ${MIN_GENRE_COUNT} genres.`);
            return false;
        }

        if (currentStep === 4 && selectedArtists.length < MIN_ARTIST_COUNT) {
            setArtistError(`Choose at least ${MIN_ARTIST_COUNT} artists.`);
            return false;
        }

        return true;
    }

    function goToNextStep() {
        if (!validateCurrentStep()) {
            return;
        }

        setCurrentStep((step) => Math.min(step + 1, 5) as SignupStep);
    }

    function goToPreviousStep() {
        setErrorMessage("");
        setGenreError("");
        setArtistError("");
        setCurrentStep((step) => Math.max(step - 1, 0) as SignupStep);
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        if (!validateCurrentStep()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const user = await signup({
                name,
                email,
                password,
                role,
                genres: selectedGenres,
                favoriteArtists: selectedArtists,
                roleDetails: buildRoleDetails()
            });

            onSignupSuccess(user);
            navigate("/dashboard");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Signup failed.";
            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="auth-page signup-page">
            <section className="signup-showcase">
                <MusicLogo className="signup-artwork" />
                <div>
                    <p className="eyebrow">New profile</p>
                    <h1>Build your sound map.</h1>
                    <p className="subtitle">
                        Start with the basics, then tune the profile with genres and
                        artists from the listening data.
                    </p>
                </div>
            </section>

            <section className="signup-panel" aria-label="Create account">
                <div className="stepper" aria-label="Signup progress">
                    {signupSteps.map((step, index) => (
                        <button
                            key={step}
                            type="button"
                            className={`step-dot ${index === currentStep ? "active" : ""} ${
                                index < currentStep ? "done" : ""
                            }`}
                            onClick={() => {
                                if (index <= currentStep) {
                                    setCurrentStep(index as SignupStep);
                                }
                            }}
                        >
                            <span>{index + 1}</span>
                            {step}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {currentStep === 0 ? (
                        <div className="signup-step">
                            <p className="eyebrow">Step 1</p>
                            <h2>Create your login</h2>
                            <p className="helper-text">
                                Use an email you can reach and a password with at
                                least 8 characters.
                            </p>

                            <div className="form-grid two-columns">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="name">
                                        Full name
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        className="form-input"
                                        value={name}
                                        onChange={(event) => setName(event.target.value)}
                                        autoComplete="name"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label
                                        className="form-label"
                                        htmlFor="signup-email"
                                    >
                                        Email
                                    </label>
                                    <input
                                        id="signup-email"
                                        type="email"
                                        className="form-input"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        autoComplete="email"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="signup-password">
                                    Password
                                </label>
                                <input
                                    id="signup-password"
                                    type="password"
                                    className="form-input"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </div>
                        </div>
                    ) : null}

                    {currentStep === 1 ? (
                        <div className="signup-step">
                            <p className="eyebrow">Step 2</p>
                            <h2>Choose your account type</h2>
                            <p className="helper-text">
                                This keeps the first dashboard aligned with how you
                                want to use the platform.
                            </p>

                            <div className="role-grid">
                                {roleOptions.map((roleOption) => (
                                    <button
                                        key={roleOption.value}
                                        type="button"
                                        className={`role-option ${
                                            role === roleOption.value ? "selected" : ""
                                        }`}
                                        onClick={() => setRole(roleOption.value)}
                                    >
                                        <strong>{roleOption.title}</strong>
                                        <span>{roleOption.description}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {currentStep === 2 ? (
                        <div className="signup-step">
                            <p className="eyebrow">Step 3</p>
                            {role === "listener" ? (
                                <>
                                    <h2>Shape your listener profile</h2>
                                    <p className="helper-text">
                                        Tell us what you want this account to help you find.
                                    </p>
                                    <div className="role-grid">
                                        {listenerGoals.map((goal) => (
                                            <button
                                                key={goal}
                                                type="button"
                                                className={`role-option ${
                                                    listenerDiscoveryGoal === goal
                                                        ? "selected"
                                                        : ""
                                                }`}
                                                onClick={() =>
                                                    setListenerDiscoveryGoal(goal)
                                                }
                                            >
                                                <strong>{goal}</strong>
                                                <span>
                                                    Use taste signals to guide discovery.
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : null}

                            {role === "artist" ? (
                                <>
                                    <h2>Build your artist profile</h2>
                                    <p className="helper-text">
                                        Add the information listeners and collaborators
                                        should see first.
                                    </p>
                                    <div className="form-grid two-columns">
                                        <div className="form-group">
                                            <label
                                                className="form-label"
                                                htmlFor="artist-name"
                                            >
                                                Artist or project name
                                            </label>
                                            <input
                                                id="artist-name"
                                                type="text"
                                                className="form-input"
                                                value={artistName}
                                                onChange={(event) =>
                                                    setArtistName(event.target.value)
                                                }
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label
                                                className="form-label"
                                                htmlFor="artist-location"
                                            >
                                                Location
                                            </label>
                                            <input
                                                id="artist-location"
                                                type="text"
                                                className="form-input"
                                                value={artistLocation}
                                                onChange={(event) =>
                                                    setArtistLocation(event.target.value)
                                                }
                                                placeholder="City or scene"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label
                                            className="form-label"
                                            htmlFor="artist-release-status"
                                        >
                                            Artist journey
                                        </label>
                                        <select
                                            id="artist-release-status"
                                            className="form-input"
                                            value={artistReleaseStatus}
                                            onChange={(event) =>
                                                setArtistReleaseStatus(
                                                    event.target.value
                                                )
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
                                        <label
                                            className="form-label"
                                            htmlFor="artist-bio"
                                        >
                                            Short bio
                                        </label>
                                        <textarea
                                            id="artist-bio"
                                            className="form-input textarea-input"
                                            value={artistBio}
                                            onChange={(event) =>
                                                setArtistBio(event.target.value)
                                            }
                                            placeholder="A few words about your sound"
                                        />
                                    </div>
                                    <div className="choice-section">
                                        <div className="choice-section-heading">
                                            <label className="form-label">
                                                Collaboration services
                                            </label>
                                            <span>
                                                {selectedArtistServices.length} selected
                                            </span>
                                        </div>
                                        <div className="genre-grid">
                                            {artistServices.map((service) => (
                                                <button
                                                    key={service}
                                                    type="button"
                                                    className={`choice-chip ${
                                                        selectedArtistServices.includes(
                                                            service
                                                        )
                                                            ? "selected"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        toggleArtistService(service)
                                                    }
                                                >
                                                    {service}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="form-grid two-columns">
                                        <div className="form-group">
                                            <label
                                                className="form-label"
                                                htmlFor="artist-collaboration-goal"
                                            >
                                                Main collaboration goal
                                            </label>
                                            <select
                                                id="artist-collaboration-goal"
                                                className="form-input"
                                                value={artistCollaborationGoal}
                                                onChange={(event) =>
                                                    setArtistCollaborationGoal(
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                {artistCollaborationGoals.map((goal) => (
                                                    <option key={goal} value={goal}>
                                                        {goal}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label
                                                className="form-label"
                                                htmlFor="artist-resume-link"
                                            >
                                                Resume or portfolio link
                                            </label>
                                            <input
                                                id="artist-resume-link"
                                                type="url"
                                                className="form-input"
                                                value={artistResumeLink}
                                                onChange={(event) =>
                                                    setArtistResumeLink(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Optional"
                                            />
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            {role === "producer" ? (
                                <>
                                    <h2>Set up your producer profile</h2>
                                    <p className="helper-text">
                                        Add the services, tools, and collaboration
                                        goals that describe your work.
                                    </p>
                                    <div className="form-grid two-columns">
                                        <div className="form-group">
                                            <label
                                                className="form-label"
                                                htmlFor="producer-name"
                                            >
                                                Producer name
                                            </label>
                                            <input
                                                id="producer-name"
                                                type="text"
                                                className="form-input"
                                                value={producerName}
                                                onChange={(event) =>
                                                    setProducerName(event.target.value)
                                                }
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label
                                                className="form-label"
                                                htmlFor="studio-name"
                                            >
                                                Studio or collective
                                            </label>
                                            <input
                                                id="studio-name"
                                                type="text"
                                                className="form-input"
                                                value={studioName}
                                                onChange={(event) =>
                                                    setStudioName(event.target.value)
                                                }
                                                placeholder="Optional"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label
                                                className="form-label"
                                                htmlFor="producer-location"
                                            >
                                                Location
                                            </label>
                                            <input
                                                id="producer-location"
                                                type="text"
                                                className="form-input"
                                                value={producerLocation}
                                                onChange={(event) =>
                                                    setProducerLocation(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="City or remote"
                                            />
                                        </div>
                                    </div>
                                    <div className="choice-section">
                                        <div className="choice-section-heading">
                                            <label className="form-label">
                                                Services
                                            </label>
                                            <span>
                                                {selectedProducerServices.length} selected
                                            </span>
                                        </div>
                                        <div className="genre-grid">
                                            {producerServices.map((service) => (
                                                <button
                                                    key={service}
                                                    type="button"
                                                    className={`choice-chip ${
                                                        selectedProducerServices.includes(
                                                            service
                                                        )
                                                            ? "selected"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        toggleProducerService(service)
                                                    }
                                                >
                                                    {service}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="form-grid two-columns">
                                        <div className="form-group">
                                            <label
                                                className="form-label"
                                                htmlFor="producer-tools"
                                            >
                                                Tools
                                            </label>
                                            <input
                                                id="producer-tools"
                                                type="text"
                                                className="form-input"
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
                                                    setProducerCollaborationGoal(
                                                        event.target.value
                                                    )
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
                                    <div className="form-group">
                                        <label
                                            className="form-label"
                                            htmlFor="producer-resume-link"
                                        >
                                            Resume or portfolio link
                                        </label>
                                        <input
                                            id="producer-resume-link"
                                            type="url"
                                            className="form-input"
                                            value={producerResumeLink}
                                            onChange={(event) =>
                                                setProducerResumeLink(
                                                    event.target.value
                                                )
                                            }
                                            placeholder="Optional"
                                        />
                                    </div>
                                </>
                            ) : null}
                        </div>
                    ) : null}

                    {currentStep === 3 ? (
                        <div className="signup-step">
                            <p className="eyebrow">Step 4</p>
                            <h2>
                                {role === "artist"
                                    ? "Choose your sound"
                                    : role === "producer"
                                      ? "Choose your production lanes"
                                      : "Pick a few genres"}
                            </h2>
                            <GenreSelector
                                genres={availableGenres}
                                selectedGenres={selectedGenres}
                                onToggleGenre={toggleGenre}
                                error={genreError}
                            />
                        </div>
                    ) : null}

                    {currentStep === 4 ? (
                        <div className="signup-step">
                            <p className="eyebrow">Step 5</p>
                            <h2>
                                {role === "artist"
                                    ? "Add artists that inspire you"
                                    : role === "producer"
                                      ? "Add artists you want to work near"
                                      : "Add artists you like"}
                            </h2>
                            <ArtistSelector
                                artists={availableArtists}
                                selectedArtists={selectedArtists}
                                searchTerm={artistSearchTerm}
                                onSearchTermChange={setArtistSearchTerm}
                                onToggleArtist={toggleArtist}
                                error={artistError}
                            />
                        </div>
                    ) : null}

                    {currentStep === 5 ? (
                        <div className="signup-step">
                            <p className="eyebrow">Step 6</p>
                            <h2>Review your profile</h2>
                            <div className="review-list">
                                <div>
                                    <span>Name</span>
                                    <strong>{name}</strong>
                                </div>
                                <div>
                                    <span>Email</span>
                                    <strong>{email}</strong>
                                </div>
                                <div>
                                    <span>Account type</span>
                                    <strong>{selectedRole?.title ?? role}</strong>
                                </div>
                                {role === "listener" ? (
                                    <div>
                                        <span>Discovery goal</span>
                                        <strong>{listenerDiscoveryGoal}</strong>
                                    </div>
                                ) : null}
                                {role === "artist" ? (
                                    <>
                                        <div>
                                            <span>Artist name</span>
                                            <strong>{artistName}</strong>
                                        </div>
                                        <div>
                                            <span>Artist journey</span>
                                            <strong>{artistReleaseStatus}</strong>
                                        </div>
                                        <div>
                                            <span>Collaboration goal</span>
                                            <strong>{artistCollaborationGoal}</strong>
                                        </div>
                                    </>
                                ) : null}
                                {role === "producer" ? (
                                    <>
                                        <div>
                                            <span>Producer name</span>
                                            <strong>{producerName}</strong>
                                        </div>
                                        <div>
                                            <span>Services</span>
                                            <strong>
                                                {selectedProducerServices.join(", ")}
                                            </strong>
                                        </div>
                                        <div>
                                            <span>Main goal</span>
                                            <strong>{producerCollaborationGoal}</strong>
                                        </div>
                                    </>
                                ) : null}
                                <div>
                                    <span>Genres</span>
                                    <strong>{selectedGenres.join(", ")}</strong>
                                </div>
                                <div>
                                    <span>Artists</span>
                                    <strong>{selectedArtists.join(", ")}</strong>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

                    <div className="form-actions">
                        {currentStep > 0 ? (
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={goToPreviousStep}
                            >
                                Back
                            </button>
                        ) : null}

                        {currentStep < 5 ? (
                            <button
                                type="button"
                                className="primary-button"
                                onClick={goToNextStep}
                            >
                                Continue
                            </button>
                        ) : (
                            <button
                                type="submit"
                                className="primary-button"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Creating account..." : "Create account"}
                            </button>
                        )}
                    </div>
                </form>

                <p className="switch-text">
                    Already have an account? <Link to="/login">Go to login</Link>
                </p>
                <p className="admin-login-link">
                    <Link to="/admin">Login as Admin</Link>
                </p>
            </section>
        </main>
    );
}

export default SignupPage;
