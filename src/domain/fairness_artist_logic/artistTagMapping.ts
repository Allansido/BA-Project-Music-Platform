import { AVAILABLE_GENRES } from "../authentication/genreData";

export interface LastFmArtistTag {
    name: string;
    count: number;
    url?: string;
}

export interface ArtistGenreScore {
    genre: string;
    score: number;
    matchedTags: string[];
}

export interface ArtistTagRecord {
    artistId: string | null;
    artistName: string;
    tags: LastFmArtistTag[];
    genres: ArtistGenreScore[];
    fetchedAt: string;
    source: "lastfm";
    status: "ok" | "missing" | "error";
    error?: string;
}

export type ArtistTagIndex = Record<string, ArtistTagRecord>;

const TAG_TO_GENRES: Record<string, string[]> = {
    "acid jazz": ["Jazz"],
    "alternative": ["Alternative"],
    "alternative rock": ["Alternative", "Rock"],
    "ambient": ["Electronic"],
    "americana": ["Country", "Folk"],
    "blues rock": ["Blues", "Rock"],
    "classic rock": ["Rock"],
    "classical": ["Classical"],
    "country": ["Country"],
    "dance": ["Pop", "Electronic"],
    "dance pop": ["Pop", "Electronic"],
    "deep house": ["House", "Electronic"],
    "disco": ["Funk", "Pop"],
    "drum and bass": ["Electronic"],
    "dubstep": ["Electronic", "EDM"],
    "edm": ["EDM", "Electronic"],
    "electro": ["Electronic"],
    "electronic": ["Electronic"],
    "electronica": ["Electronic"],
    "electropop": ["Pop", "Electronic"],
    "folk": ["Folk"],
    "folk rock": ["Folk", "Rock"],
    "funk": ["Funk"],
    "gangsta rap": ["Rap", "Hip-Hop"],
    "garage rock": ["Rock"],
    "hard rock": ["Rock"],
    "heavy metal": ["Metal"],
    "hip hop": ["Hip-Hop"],
    "house": ["House", "Electronic"],
    "indie": ["Indie"],
    "indie pop": ["Indie", "Pop"],
    "indie rock": ["Indie", "Rock"],
    "jazz": ["Jazz"],
    "metal": ["Metal"],
    "metalcore": ["Metal"],
    "new wave": ["Alternative", "Pop"],
    "pop": ["Pop"],
    "pop punk": ["Punk", "Pop"],
    "post punk": ["Punk", "Alternative"],
    "punk": ["Punk"],
    "punk rock": ["Punk", "Rock"],
    "r&b": ["R&B"],
    "rap": ["Rap", "Hip-Hop"],
    "rhythm and blues": ["R&B"],
    "rnb": ["R&B"],
    "rock": ["Rock"],
    "neo soul": ["Soul", "R&B"],
    "singer songwriter": ["Folk"],
    "soul": ["Soul", "R&B"],
    "synth pop": ["Pop", "Electronic"],
    "synthpop": ["Pop", "Electronic"],
    "tech house": ["House", "Electronic"],
    "techno": ["Techno", "Electronic"],
    "thrash metal": ["Metal"],
    "trap": ["Rap", "Hip-Hop"],
    "trance": ["EDM", "Electronic"],
    "uk hip hop": ["Hip-Hop", "Rap"]
};

const IGNORED_TAGS = new Set([
    "00s",
    "10s",
    "60s",
    "70s",
    "80s",
    "90s",
    "american",
    "awesome",
    "beautiful",
    "best",
    "british",
    "cher",
    "classic",
    "diva",
    "favorite",
    "favorites",
    "female vocalist",
    "female vocalists",
    "heard on pandora",
    "male vocalist",
    "male vocalists",
    "seen live",
    "spotify",
    "under 2000 listeners"
]);

const AVAILABLE_GENRES_BY_KEY = new Map(
    AVAILABLE_GENRES.map((genre) => [normalizeTagKey(genre), genre])
);

export function getArtistTagKey(artistName: string): string {
    return artistName.trim().toLowerCase();
}

export function normalizeTagKey(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
}

function getMappedGenresForTag(tagName: string): string[] {
    const tagKey = normalizeTagKey(tagName);

    if (!tagKey || IGNORED_TAGS.has(tagKey)) {
        return [];
    }

    const directGenre = AVAILABLE_GENRES_BY_KEY.get(tagKey);
    const mappedGenres = TAG_TO_GENRES[tagKey] ?? [];
    const genres = new Set<string>(mappedGenres);

    if (directGenre) {
        genres.add(directGenre);
    }

    return [...genres];
}

export function mapLastFmTagsToGenres(
    tags: LastFmArtistTag[],
    maxTags = 20
): ArtistGenreScore[] {
    const genreScores = new Map<
        string,
        { score: number; matchedTags: Set<string> }
    >();

    const sortedTags = [...tags]
        .filter((tag) => tag.name.trim())
        .sort((firstTag, secondTag) => secondTag.count - firstTag.count)
        .slice(0, maxTags);

    for (const tag of sortedTags) {
        const genres = getMappedGenresForTag(tag.name);

        if (genres.length === 0) {
            continue;
        }

        const tagWeight = Number.isFinite(tag.count) && tag.count > 0
            ? tag.count
            : 1;

        for (const genre of genres) {
            const current =
                genreScores.get(genre) ?? { score: 0, matchedTags: new Set() };

            current.score += tagWeight;
            current.matchedTags.add(tag.name);
            genreScores.set(genre, current);
        }
    }

    const maxScore = Math.max(
        0,
        ...[...genreScores.values()].map((genreScore) => genreScore.score)
    );

    if (maxScore === 0) {
        return [];
    }

    return [...genreScores.entries()]
        .map(([genre, genreScore]) => ({
            genre,
            score: Number((genreScore.score / maxScore).toFixed(3)),
            matchedTags: [...genreScore.matchedTags].sort()
        }))
        .sort(
            (firstGenre, secondGenre) =>
                secondGenre.score - firstGenre.score ||
                firstGenre.genre.localeCompare(secondGenre.genre)
        );
}
