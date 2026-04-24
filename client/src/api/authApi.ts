import type {
    LoginPayload,
    OnboardingArtist,
    ProfileUpdatePayload,
    SafeUser,
    SignupPayload
} from "../types/auth";
import { AUTH_API_BASE_URL } from "./config";

async function handleResponse<T>(response: Response): Promise<T> {
    const responseText = await response.text();
    let data: unknown = null;

    try {
        data = responseText ? JSON.parse(responseText) : null;
    } catch {
        if (!response.ok) {
            throw new Error("The auth server returned an invalid response.");
        }

        throw new Error("Could not read auth response.");
    }

    if (!response.ok) {
        const message =
            data &&
            typeof data === "object" &&
            "message" in data &&
            typeof data.message === "string"
                ? data.message
                : "Something went wrong.";
        throw new Error(message);
    }

    return data as T;
}

export async function getGenres(): Promise<string[]> {
    const response = await fetch(`${AUTH_API_BASE_URL}/genres`, {
        credentials: "include"
    });

    return handleResponse<string[]>(response);
}

export async function getArtists(): Promise<OnboardingArtist[]> {
    const response = await fetch(`${AUTH_API_BASE_URL}/artists`, {
        credentials: "include"
    });

    return handleResponse<OnboardingArtist[]>(response);
}

export async function getCurrentUser(): Promise<SafeUser> {
    const response = await fetch(`${AUTH_API_BASE_URL}/me`, {
        credentials: "include"
    });

    return handleResponse<SafeUser>(response);
}

export async function signup(payload: SignupPayload): Promise<SafeUser> {
    const response = await fetch(`${AUTH_API_BASE_URL}/signup`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    return handleResponse<SafeUser>(response);
}

export async function login(payload: LoginPayload): Promise<SafeUser> {
    const response = await fetch(`${AUTH_API_BASE_URL}/login`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    return handleResponse<SafeUser>(response);
}

export async function logout(): Promise<{ message: string }> {
    const response = await fetch(`${AUTH_API_BASE_URL}/logout`, {
        method: "POST",
        credentials: "include"
    });

    return handleResponse<{ message: string }>(response);
}

export async function updateProfile(
    payload: ProfileUpdatePayload
): Promise<SafeUser> {
    const response = await fetch(`${AUTH_API_BASE_URL}/me`, {
        method: "PATCH",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    return handleResponse<SafeUser>(response);
}

export async function deleteAccount(): Promise<{ message: string }> {
    const response = await fetch(`${AUTH_API_BASE_URL}/me`, {
        method: "DELETE",
        credentials: "include"
    });

    return handleResponse<{ message: string }>(response);
}
