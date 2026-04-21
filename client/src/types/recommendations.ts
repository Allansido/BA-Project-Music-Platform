export interface RecommendedArtist {
    artistId: string | null;
    artistName: string;
    score: number;
    reason: string;
}

export interface RecommendedTrack {
    trackId: string | null;
    trackName: string;
    artistId: string | null;
    artistName: string;
    score: number;
    reason: string;
}

export interface RecommendationResult {
    artists: RecommendedArtist[];
    tracks: RecommendedTrack[];
}
