import { Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import type { SafeUser } from "../types/auth";

interface ProtectedRouteProps {
    user: SafeUser | null;
    children: ReactElement;
}

function ProtectedRoute({ user, children }: ProtectedRouteProps) {
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export default ProtectedRoute;