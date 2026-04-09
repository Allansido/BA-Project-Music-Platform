export type UserRole = "artist" | "producer" | "listener";

export interface SafeUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    genres: string[];
}

export interface SignupPayload {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    genres: string[];
}

export interface LoginPayload {
    email: string;
    password: string;
}