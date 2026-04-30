export type UserRole = "artist" | "producer" | "listener";

export interface ListenerDetails {
    discoveryGoal: string;
}

export interface ArtistDetails {
    artistName: string;
    location: string;
    bio: string;
    releaseStatus: string;
    services: string[];
    collaborationGoal: string;
    resumeLink: string;
}

export interface ProducerDetails {
    producerName: string;
    location: string;
    studioName: string;
    services: string[];
    tools: string;
    collaborationGoal: string;
    resumeLink: string;
}

export interface RoleDetails {
    listener?: ListenerDetails;
    artist?: ArtistDetails;
    producer?: ProducerDetails;
}

export interface User {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    genres: string[];
    favoriteArtists: string[];
    roleDetails: RoleDetails;
}

export interface SafeUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    genres: string[];
    favoriteArtists: string[];
    roleDetails: RoleDetails;
}

export interface SignupInput {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    genres: string[];
    favoriteArtists: string[];
    roleDetails?: RoleDetails;
}

export interface ProfileUpdateInput {
    name: string;
    email: string;
    genres: string[];
    favoriteArtists: string[];
    roleDetails?: RoleDetails;
}

export interface LoginInput {
    email: string;
    password: string;
}
