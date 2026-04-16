import { Interaction } from "../dataset_modules/lastfmLoader";

export interface RecommendedArtist {
    artistId: string | null;
    artistName: string;
    score: number;
    reason: string;
}

export interface RecommendedTracks {
    trackId: string | null;
    trackName: string;
    artistId: string | null;
    artistName: string;
    score: number;
    reason: string;
}

export interface BaselineRecommendationResult {
    artists: RecommendedArtist[];
    tracks: RecommendedTracks[];
}


interface ArtistAggregate {
    artistId: string | null;
    artistName: string;
    playCount: number;
}

interface TrackAggregate {
    trackId: string | null;
    trackName: string;
    artistId: string | null;
    artistName: string;
    playCount: number;
}


function normalizeText(value: string | undefined): string {
    return value?.trim() ?? "";
}

function getUserHeardArtists(
    interactions: Interaction[],
    userId: string
): Set<string> {
    const heardArtists = new Set<string>();

    for (const interaction of interactions) {
        if (interaction.userId !== userId) continue;

        const artistKey =
            normalizeText(interaction.artistId) ||
            normalizeText(interaction.artistName).toLocaleLowerCase();

        if (artistKey) {
            heardArtists.add(artistKey);
        }
    }

    return heardArtists;
}

function getUserHeardTracks(
    interactions: Interaction[],
    userId: string
): Set<string> {
    const heardTracks = new Set<string>();

    for (const interaction of interactions) {
        if (interaction.userId !== userId) continue;

        const trackKey =
            normalizeText(interaction.trackId) ||
            `${normalizeText(interaction.artistName)}::${normalizeText(interaction.trackName)}`;

        if (trackKey.trim() !== "::") {
            heardTracks.add(trackKey);
        }
    }

    return heardTracks;
}

function aggregateArtists(interactions: Interaction[]): ArtistAggregate[] {
    const artists = new Map<string, ArtistAggregate>();

    for (const interaction of interactions) {
        const artistId = normalizeText(interaction.artistId) || null;
        const artistName = normalizeText(interaction.artistName);
        const artistKey = artistId || artistName.toLowerCase();

        if (!artistKey || !artistName) continue;

        const current =
            artists.get(artistKey) ?? {
                artistId,
                artistName,
                playCount: 0
            };

        current.playCount += 1;
        artists.set(artistKey, current);
    }

    return [...artists.values()].sort((a, b) => b.playCount - a.playCount);
}

function aggregateTracks(interactions: Interaction[]): TrackAggregate[] {
    const tracks = new Map<string, TrackAggregate>();

    for (const interaction of interactions) {
        const trackId = normalizeText(interaction.trackId) || null;
        const trackName = normalizeText(interaction.trackName);
        const artistId = normalizeText(interaction.artistId) || null;
        const artistName = normalizeText(interaction.artistName);

        const trackKey = trackId || `${artistName}::${trackName}`;

        if (!trackKey || !trackName || !artistName) continue;

        const current =
            tracks.get(trackKey) ?? {
                trackId,
                trackName,
                artistId,
                artistName,
                playCount: 0
            };

        current.playCount += 1;
        tracks.set(trackKey, current);
    }

    return [...tracks.values()].sort((a, b) => b.playCount - a.playCount);
}

export function getBaselineRecommendations(
    interactions: Interaction[],
    userId: string,
    limit = 10
): BaselineRecommendationResult {
    const heardArtists = getUserHeardArtists(interactions, userId);
    const heardTracks = getUserHeardTracks(interactions, userId);

    const artists = aggregateArtists(interactions)
        .filter((artist) => {
            const artistKey = artist.artistId || artist.artistName.toLowerCase();
            return !heardArtists.has(artistKey);
        })
        .slice(0, limit)
        .map((artist) => ({
            artistId: artist.artistId,
            artistName: artist.artistName,
            score: artist.playCount,
            reason: "Popular among listeners on the platform"
        }));

    const tracks = aggregateTracks(interactions)
        .filter((track) => {
            const trackKey = track.trackId || `${track.artistName}::${track.trackName}`;
            if (track.trackId == null || track.artistId == null) return false;
            return !heardTracks.has(trackKey);
        })
        .slice(0, limit)
        .map((track) => ({
            trackId: track.trackId,
            trackName: track.trackName,
            artistId: track.artistId,
            artistName: track.artistName,
            score: track.playCount,
            reason: "Popular among listeners on the platform"
        }));

    return { artists, tracks };

}
