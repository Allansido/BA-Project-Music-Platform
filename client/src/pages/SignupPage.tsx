import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import ArtistSelector from "../components/ArtistSelector";
import GenreSelector from "../components/GenreSelector";
import { getArtists, getGenres, signup } from "../api/authApi";
import heroImage from "../assets/hero.png";
import type { OnboardingArtist, SafeUser, UserRole } from "../types/auth";

interface SignupPageProps {
    onSignupSuccess: (user: SafeUser) => void;
}

type SignupStep = 0 | 1 | 2 | 3 | 4;

const signupSteps = ["Account", "Type", "Genres", "Artists", "Review"];
const MIN_PASSWORD_LENGTH = 8;
const MIN_GENRE_COUNT = 3;
const MIN_ARTIST_COUNT = 3;

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
            try {
                const [genres, artists] = await Promise.all([
                    getGenres(),
                    getArtists()
                ]);
                setAvailableGenres(genres);
                setAvailableArtists(artists);
            } catch (error) {
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

        if (currentStep === 2 && selectedGenres.length < MIN_GENRE_COUNT) {
            setGenreError(`Choose at least ${MIN_GENRE_COUNT} genres.`);
            return false;
        }

        if (currentStep === 3 && selectedArtists.length < MIN_ARTIST_COUNT) {
            setArtistError(`Choose at least ${MIN_ARTIST_COUNT} artists.`);
            return false;
        }

        return true;
    }

    function goToNextStep() {
        if (!validateCurrentStep()) {
            return;
        }

        setCurrentStep((step) => Math.min(step + 1, 4) as SignupStep);
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
                favoriteArtists: selectedArtists
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
                <img
                    src={heroImage}
                    alt="Colorful music player artwork"
                    className="signup-artwork"
                />
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
                            <h2>Pick a few genres</h2>
                            <GenreSelector
                                genres={availableGenres}
                                selectedGenres={selectedGenres}
                                onToggleGenre={toggleGenre}
                                error={genreError}
                            />
                        </div>
                    ) : null}

                    {currentStep === 3 ? (
                        <div className="signup-step">
                            <p className="eyebrow">Step 4</p>
                            <h2>Add artists you like</h2>
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

                    {currentStep === 4 ? (
                        <div className="signup-step">
                            <p className="eyebrow">Step 5</p>
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

                        {currentStep < 4 ? (
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
            </section>
        </main>
    );
}

export default SignupPage;
