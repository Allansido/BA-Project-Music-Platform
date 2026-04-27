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

export interface SafeUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    genres: string[];
    favoriteArtists: string[];
    roleDetails: RoleDetails;
}

export interface SignupPayload {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    genres: string[];
    favoriteArtists: string[];
    roleDetails: RoleDetails;
}

export interface ProfileUpdatePayload {
    name: string;
    email: string;
    genres: string[];
    favoriteArtists: string[];
    roleDetails: RoleDetails;
}

export interface LoginPayload {
    email: string;
    password: string;
}

export interface OnboardingArtist {
    id: string;
    name: string;
    playCount: number;
    listenerCount: number;
    segment: "emerging" | "established";
}
