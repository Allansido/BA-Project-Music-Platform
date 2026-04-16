import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/authApi";
import heroImage from "../assets/hero.png";
import type { SafeUser } from "../types/auth";

interface LoginPageProps {
    onLoginSuccess: (user: SafeUser) => void;
}

function LoginPage({ onLoginSuccess }: LoginPageProps) {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setErrorMessage("");
        setIsSubmitting(true);

        try {
            const user = await login({ email, password });
            onLoginSuccess(user);
            navigate("/dashboard");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Login failed.";
            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="auth-page login-page">
            <section className="signup-showcase compact">
                <img
                    src={heroImage}
                    alt="Colorful music player artwork"
                    className="signup-artwork"
                />
                <div>
                    <p className="eyebrow">Welcome back</p>
                    <h1>Your music profile is ready.</h1>
                    <p className="subtitle">
                        Sign in to continue from your saved taste profile.
                    </p>
                </div>
            </section>

            <section className="login-panel" aria-label="Login">
                <h2>Login</h2>
                <p className="subtitle">Use the email and password you signed up with.</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="password">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                    </div>

                    {errorMessage ? (
                        <p className="error-text">{errorMessage}</p>
                    ) : null}

                    <button type="submit" className="primary-button" disabled={isSubmitting}>
                        {isSubmitting ? "Logging in..." : "Login"}
                    </button>
                </form>

                <p className="switch-text">
                    No account yet? <Link to="/signup">Create an account</Link>
                </p>
            </section>
        </main>
    );
}

export default LoginPage;
