export type UserRole = "artist" | "producer" | "listener";

export interface User {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    genres: string[];
}

export interface SafeUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    genres: string[];
}

export interface SignupInput {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    genres: string[];
}

export interface LoginInput {
    email: string;
    password: string;
}