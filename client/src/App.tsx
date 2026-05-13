import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { getCurrentUser } from "./api/authApi";
import ProtectedRoute from "./components/ProtectedRoute";
import ThemeToggle from "./components/ThemeToggle";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import CollaborationPage from "./pages/CollaborationPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import RecommendationsPage from "./pages/RecommendationsPage";
import SignupPage from "./pages/SignupPage";
import UpcomingArtistsPage from "./pages/UpcomingArtistsPage";
import type { SafeUser } from "./types/auth";
import { getHomePathForUser } from "./utils/roleRouting";

function App() {
    const [user, setUser] = useState<SafeUser | null>(null);
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [theme, setTheme] = useState<"light" | "dark">(() => {
        const storedTheme = window.localStorage.getItem("theme");
        return storedTheme === "dark" ? "dark" : "light";
    });

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        window.localStorage.setItem("theme", theme);
    }, [theme]);

    useEffect(() => {
        async function checkSession() {
            try {
                const currentUser = await getCurrentUser();
                setUser(currentUser);
            } catch {
                setUser(null);
            } finally {
                setIsCheckingSession(false);
            }
        }

        checkSession();
    }, []);

    if (isCheckingSession) {
        return (
            <main className="page-container">
                <p className="loading-pill">Loading...</p>
            </main>
        );
    }

    return (
        <>
            <ThemeToggle
                theme={theme}
                onToggleTheme={() =>
                    setTheme((currentTheme) =>
                        currentTheme === "light" ? "dark" : "light"
                    )
                }
            />
            <Routes>
                <Route
                    path="/"
                    element={
                        <Navigate
                            to={user ? getHomePathForUser(user) : "/login"}
                            replace
                        />
                    }
                />
                <Route
                    path="/login"
                    element={
                        user ? (
                            <Navigate to={getHomePathForUser(user)} replace />
                        ) : (
                            <LoginPage onLoginSuccess={setUser} />
                        )
                    }
                />
                <Route
                    path="/signup"
                    element={
                        user ? (
                            <Navigate to={getHomePathForUser(user)} replace />
                        ) : (
                            <SignupPage onSignupSuccess={setUser} />
                        )
                    }
                />
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute user={user}>
                            <Navigate
                                to={getHomePathForUser(user as SafeUser)}
                                replace
                            />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/listener"
                    element={
                        <ProtectedRoute user={user} allowedRoles={["listener"]}>
                            <DashboardPage
                                user={user as SafeUser}
                                onLogout={() => setUser(null)}
                            />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/collaboration"
                    element={
                        <ProtectedRoute
                            user={user}
                            allowedRoles={["artist", "producer"]}
                        >
                            <CollaborationPage
                                user={user as SafeUser}
                                onLogout={() => setUser(null)}
                            />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/recommendations"
                    element={
                        <ProtectedRoute user={user} allowedRoles={["listener"]}>
                            <RecommendationsPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute user={user}>
                            <ProfilePage
                                user={user as SafeUser}
                                onUserChange={setUser}
                                onDeleteAccount={() => setUser(null)}
                            />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/artists"
                    element={
                        <ProtectedRoute user={user} allowedRoles={["listener"]}>
                            <UpcomingArtistsPage />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </>
    );
}

export default App;
