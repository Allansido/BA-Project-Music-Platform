import { Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import type { SafeUser, UserRole } from "../types/auth";
import { getHomePathForUser, isAllowedRole } from "../utils/roleRouting";

interface ProtectedRouteProps {
    user: SafeUser | null;
    children: ReactElement;
    allowedRoles?: UserRole[];
}

function ProtectedRoute({
    user,
    children,
    allowedRoles
}: ProtectedRouteProps) {
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!isAllowedRole(user.role, allowedRoles)) {
        return <Navigate to={getHomePathForUser(user)} replace />;
    }

    return children;
}

export default ProtectedRoute;
