import { useState } from "react";
import type { FormEvent } from "react";import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/authApi";
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
        <div className="page-container">
            <div className="auth-card">
                <h1>Login</h1>
                <p className="subtitle">Sign in to your account.</p>

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
            </div>
        </div>
    );
}

export default LoginPage;