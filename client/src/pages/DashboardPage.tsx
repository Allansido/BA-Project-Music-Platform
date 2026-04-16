import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/authApi";
import type { SafeUser } from "../types/auth";

interface DashboardPageProps {
    user: SafeUser;
    onLogout: () => void;
}

function DashboardPage({ user, onLogout }: DashboardPageProps) {
    const navigate = useNavigate();

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
        <div className="page-container">
            <div className="dashboard-card">
                <h1>Welcome, {user.name}</h1>
                <p className="subtitle">You are now logged in.</p>

                <div className="info-block">
                    <p>
                        <strong>Email:</strong> {user.email}
                    </p>
                    <p>
                        <strong>Account type:</strong> {user.role}
                    </p>
                    <p>
                        <strong>Genres:</strong> {user.genres.join(", ")}
                    </p>
                    <p>
                        <strong>Artists:</strong>{" "}
                        {user.favoriteArtists.length > 0
                            ? user.favoriteArtists.join(", ")
                            : "No artists selected yet"}
                    </p>
                </div>

                <p className="empty-site-text">
                    Your profile is ready for recommendations.
                </p>

                <div className="dashboard-actions">
                    <Link className="primary-button nav-button" to="/recommendations">
                        View recommendations
                    </Link>
                    <button className="secondary-button" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;
