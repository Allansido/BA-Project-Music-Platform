import type { SafeUser, UserRole } from "../types/auth";

export function getHomePathForUser(
    user: Pick<SafeUser, "role"> | null | undefined
): string {
    if (user?.role === "listener") {
        return "/listener";
    }

    return "/collaboration";
}

export function isAllowedRole(
    role: UserRole,
    allowedRoles: UserRole[] | undefined
): boolean {
    return !allowedRoles || allowedRoles.includes(role);
}
