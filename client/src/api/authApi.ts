import type { LoginPayload, SafeUser, SignupPayload } from "../types/auth";

const API_BASE_URL = "http://localhost:3000/api/auth";

async function handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
    }

    return data;
}

export async function getGenres(): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/genres`, {
        credentials: "include"
    });

    return handleResponse<string[]>(response);
}

export async function getCurrentUser(): Promise<SafeUser> {
    const response = await fetch(`${API_BASE_URL}/me`, {
        credentials: "include"
    });

    return handleResponse<SafeUser>(response);
}

export async function signup(payload: SignupPayload): Promise<SafeUser> {
    const response = await fetch(`${API_BASE_URL}/signup`, {
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
    const response = await fetch(`${API_BASE_URL}/login`, {
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
    const response = await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        credentials: "include"
    });

    return handleResponse<{ message: string }>(response);
}