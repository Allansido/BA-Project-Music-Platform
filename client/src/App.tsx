import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { getCurrentUser } from "./api/authApi";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import SignupPage from "./pages/SignupPage";
import type { SafeUser } from "./types/auth";

function App() {
    const [user, setUser] = useState<SafeUser | null>(null);
    const [isCheckingSession, setIsCheckingSession] = useState(true);

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
        <Routes>
            <Route
                path="/"
                element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
            />
            <Route
                path="/login"
                element={
                    user ? (
                        <Navigate to="/dashboard" replace />
                    ) : (
                        <LoginPage onLoginSuccess={setUser} />
                    )
                }
            />
            <Route
                path="/signup"
                element={
                    user ? (
                        <Navigate to="/dashboard" replace />
                    ) : (
                        <SignupPage onSignupSuccess={setUser} />
                    )
                }
            />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute user={user}>
                        <DashboardPage user={user as SafeUser} onLogout={() => setUser(null)} />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/recommendations"
                element={
                    <ProtectedRoute user={user}>
                        <RecommendationsPage />
                    </ProtectedRoute>
                }
            />
        </Routes>
    );
}

export default App;
