import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import GenreSelector from "../components/GenreSelector";
import { getGenres, signup } from "../api/authApi";
import type { SafeUser, UserRole } from "../types/auth";

interface SignupPageProps {
    onSignupSuccess: (user: SafeUser) => void;
}

function SignupPage({ onSignupSuccess }: SignupPageProps) {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<UserRole>("listener");
    const [availableGenres, setAvailableGenres] = useState<string[]>([]);
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [errorMessage, setErrorMessage] = useState("");
    const [genreError, setGenreError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        async function loadGenres() {
            try {
                const genres = await getGenres();
                setAvailableGenres(genres);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Could not load genres.";
                setErrorMessage(message);
            }
        }

        loadGenres();
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

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setErrorMessage("");
        setGenreError("");

        if (selectedGenres.length < 3) {
            setGenreError("Please choose at least 3 genres.");
            return;
        }

        setIsSubmitting(true);

        try {
            const user = await signup({
                name,
                email,
                password,
                role,
                genres: selectedGenres
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
        <div className="page-container">
            <div className="auth-card large">
                <h1>Create account</h1>
                <p className="subtitle">
                    Create a profile and tell us what kind of user you are.
                </p>

                <form onSubmit={handleSubmit} className="auth-form">
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
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="signup-email">
                            Email
                        </label>
                        <input
                            id="signup-email"
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
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
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="role">
                            Account type
                        </label>
                        <select
                            id="role"
                            className="form-input"
                            value={role}
                            onChange={(event) => setRole(event.target.value as UserRole)}
                        >
                            <option value="listener">Listener</option>
                            <option value="artist">Artist</option>
                            <option value="producer">Producer</option>
                        </select>
                    </div>

                    <GenreSelector
                        genres={availableGenres}
                        selectedGenres={selectedGenres}
                        onToggleGenre={toggleGenre}
                        error={genreError}
                    />

                    {errorMessage ? (
                        <p className="error-text">{errorMessage}</p>
                    ) : null}

                    <button type="submit" className="primary-button" disabled={isSubmitting}>
                        {isSubmitting ? "Creating account..." : "Create account"}
                    </button>
                </form>

                <p className="switch-text">
                    Already have an account? <Link to="/login">Go to login</Link>
                </p>
            </div>
        </div>
    );
}

export default SignupPage;