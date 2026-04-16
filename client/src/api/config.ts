const API_ORIGIN =
    import.meta.env.VITE_API_ORIGIN ?? `http://${window.location.hostname}:3000`;

export const AUTH_API_BASE_URL = `${API_ORIGIN}/api/auth`;
export const RECOMMENDATION_API_BASE_URL = `${API_ORIGIN}/api/recommendations`;
