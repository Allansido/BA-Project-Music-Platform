import "dotenv/config";
import fs from "fs";
import path from "path";
import readline from "readline";
import { getArtistTagKey, mapLastFmTagsToGenres } from "../domain/fairness_artist_logic/artistTagMapping";
import {
    ArtistTagIndex,
    ArtistTagRecord,
    LastFmArtistTag
} from "../domain/fairness_artist_logic/artistTagMapping";
import {
    ArtistSegment,
    classifyArtistSegment
} from "../domain/fairness_artist_logic/artistSegmentation";
import { DEFAULT_FAIRNESS_CONFIG } from "../domain/fairness_artist_logic/fairnessConfig";
import { Interaction } from "../data/dataset_modules/lastfmLoader";

const INTERACTIONS_PATH =
    process.env.LASTFM_INTERACTIONS_PATH ?? "dataset/processed/interactions.json";
const ARTIST_TAGS_PATH =
    process.env.LASTFM_ARTIST_TAGS_PATH ?? "dataset/processed/artistTags.json";
const REQUEST_DELAY_MS = Number(process.env.LASTFM_REQUEST_DELAY_MS ?? 250);
const ARTIST_LIMIT = Number(process.env.LASTFM_ARTIST_LIMIT ?? 0);
const ARTIST_NAMES = (process.env.LASTFM_ARTIST_NAMES ?? "")
    .split(",")
    .map((artistName) => artistName.trim())
    .filter(Boolean);
const ARTIST_SEGMENT = process.env.LASTFM_ARTIST_SEGMENT as
    | ArtistSegment
    | "all"
    | undefined;
const CONCURRENCY = Math.max(
    1,
    Math.floor(Number(process.env.LASTFM_CONCURRENCY ?? 1))
);
const MAX_RETRIES = Math.max(
    0,
    Math.floor(Number(process.env.LASTFM_MAX_RETRIES ?? 3))
);
const RATE_LIMIT_BACKOFF_MS = Math.max(
    1000,
    Number(process.env.LASTFM_RATE_LIMIT_BACKOFF_MS ?? 60000)
);
const REFRESH_EXISTING_TAGS = process.env.LASTFM_REFRESH_TAGS === "true";
const SAVE_PROGRESS_EVERY = 25;

interface UniqueArtist {
    artistId: string | null;
    artistName: string;
    listenerCount: number;
    playCount: number;
    firstListenedAt: string | null;
}

interface MutableUniqueArtist {
    artistId: string | null;
    artistName: string;
    listeners: Set<string>;
    playCount: number;
    firstListenedAt: string | null;
}

interface UniqueArtistCollection {
    artists: UniqueArtist[];
    referenceDate: Date;
}

interface LastFmTagResponse {
    toptags?: {
        tag?: LastFmApiTag[] | LastFmApiTag;
        "@attr"?: {
            artist?: string;
        };
    };
    error?: number;
    message?: string;
}

interface LastFmApiTag {
    name?: string;
    count?: number | string;
    url?: string;
}

class LastFmRateLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LastFmRateLimitError";
    }
}

function normalizeText(value: string | undefined): string {
    return value?.trim() ?? "";
}

function parseInteractionLine(line: string): Interaction | null {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine === "[" || trimmedLine === "]") {
        return null;
    }

    const normalizedLine = trimmedLine.endsWith(",")
        ? trimmedLine.slice(0, -1)
        : trimmedLine;

    return JSON.parse(normalizedLine) as Interaction;
}

async function collectUniqueArtists(
    filePath: string
): Promise<UniqueArtistCollection> {
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `Could not find ${filePath}. Run the Last.fm dataset import first.`
        );
    }

    const artists = new Map<string, MutableUniqueArtist>();
    let latestInteractionAt: string | null = null;
    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    const lineReader = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    try {
        for await (const line of lineReader) {
            const interaction = parseInteractionLine(line);

            if (!interaction) {
                continue;
            }

            const artistName = normalizeText(interaction.artistName);

            if (!artistName) {
                continue;
            }

            const artistKey = getArtistTagKey(artistName);

            const currentArtist =
                artists.get(artistKey) ??
                {
                    artistId: normalizeText(interaction.artistId) || null,
                    artistName,
                    listeners: new Set<string>(),
                    playCount: 0,
                    firstListenedAt: null
                };

            if (!currentArtist.artistId) {
                currentArtist.artistId = normalizeText(interaction.artistId) || null;
            }

            currentArtist.listeners.add(interaction.userId);
            currentArtist.playCount += 1;

            if (
                interaction.timestamp &&
                (!currentArtist.firstListenedAt ||
                    interaction.timestamp < currentArtist.firstListenedAt)
            ) {
                currentArtist.firstListenedAt = interaction.timestamp;
            }

            if (
                interaction.timestamp &&
                (!latestInteractionAt || interaction.timestamp > latestInteractionAt)
            ) {
                latestInteractionAt = interaction.timestamp;
            }

            artists.set(artistKey, currentArtist);
        }
    } finally {
        lineReader.close();
    }

    return {
        artists: [...artists.values()]
        .map((artist) => ({
            artistId: artist.artistId,
            artistName: artist.artistName,
            listenerCount: artist.listeners.size,
            playCount: artist.playCount,
            firstListenedAt: artist.firstListenedAt
        }))
        .sort(
            (firstArtist, secondArtist) =>
                secondArtist.playCount - firstArtist.playCount ||
                secondArtist.listenerCount - firstArtist.listenerCount ||
                firstArtist.artistName.localeCompare(secondArtist.artistName)
        ),
        referenceDate: latestInteractionAt
            ? new Date(latestInteractionAt)
            : new Date()
    };
}

function loadExistingTagIndex(filePath: string): ArtistTagIndex {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ArtistTagIndex;
}

function saveTagIndex(filePath: string, tagIndex: ArtistTagIndex): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(tagIndex, null, 2));
}

function getApiKey(): string {
    const apiKey = normalizeText(process.env.LASTFM_API_KEY);

    if (!apiKey) {
        throw new Error(
            "LASTFM_API_KEY is missing. Add it to .env before running this script."
        );
    }

    if (
        apiKey.startsWith("http") ||
        apiKey.includes("method=") ||
        apiKey.includes("api_key=")
    ) {
        throw new Error(
            "LASTFM_API_KEY should contain only the API key, not the full Last.fm URL."
        );
    }

    if (!/^[a-f0-9]{32}$/i.test(apiKey)) {
        throw new Error(
            "LASTFM_API_KEY does not look valid. Last.fm API keys are normally 32 hexadecimal characters."
        );
    }

    return apiKey;
}

function getTagArray(data: LastFmTagResponse): LastFmApiTag[] {
    const tags = data.toptags?.tag;

    if (!tags) {
        return [];
    }

    return Array.isArray(tags) ? tags : [tags];
}

function normalizeLastFmTags(tags: LastFmApiTag[]): LastFmArtistTag[] {
    return tags
        .map((tag) => ({
            name: normalizeText(tag.name),
            count: Number(tag.count ?? 0),
            url: normalizeText(tag.url) || undefined
        }))
        .filter((tag) => tag.name)
        .sort((firstTag, secondTag) => secondTag.count - firstTag.count);
}

async function fetchArtistTags(
    artist: UniqueArtist,
    apiKey: string
): Promise<ArtistTagRecord> {
    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.search = new URLSearchParams({
        method: "artist.getTopTags",
        artist: artist.artistName,
        api_key: apiKey,
        format: "json",
        autocorrect: "1"
    }).toString();

    const response = await fetch(url);

    if (!response.ok) {
        if (response.status === 429) {
            throw new LastFmRateLimitError("Last.fm returned HTTP 429");
        }

        throw new Error(`Last.fm returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as LastFmTagResponse;

    if (data.error) {
        if (data.error === 29) {
            throw new LastFmRateLimitError(
                `Last.fm error ${data.error}: ${data.message}`
            );
        }

        throw new Error(`Last.fm error ${data.error}: ${data.message}`);
    }

    const tags = normalizeLastFmTags(getTagArray(data));
    const artistName = normalizeText(data.toptags?.["@attr"]?.artist) ||
        artist.artistName;

    return {
        artistId: artist.artistId,
        artistName,
        tags,
        genres: mapLastFmTagsToGenres(tags),
        fetchedAt: new Date().toISOString(),
        source: "lastfm",
        status: tags.length > 0 ? "ok" : "missing"
    };
}

function isRateLimitError(error: unknown): boolean {
    return error instanceof LastFmRateLimitError;
}

async function fetchArtistTagsWithRetry(
    artist: UniqueArtist,
    apiKey: string
): Promise<ArtistTagRecord> {
    let attempt = 0;

    while (true) {
        try {
            return await fetchArtistTags(artist, apiKey);
        } catch (error) {
            if (!isRateLimitError(error) || attempt >= MAX_RETRIES) {
                throw error;
            }

            attempt += 1;
            const delayMs = RATE_LIMIT_BACKOFF_MS * attempt;
            console.warn(
                `Rate limit hit while fetching ${artist.artistName}. ` +
                `Waiting ${Math.round(delayMs / 1000)}s before retry ${attempt}/${MAX_RETRIES}.`
            );
            await sleep(delayMs);
        }
    }
}

function createErrorRecord(artist: UniqueArtist, error: unknown): ArtistTagRecord {
    return {
        artistId: artist.artistId,
        artistName: artist.artistName,
        tags: [],
        genres: [],
        fetchedAt: new Date().toISOString(),
        source: "lastfm",
        status: "error",
        error: error instanceof Error ? error.message : "Unknown Last.fm error"
    };
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getRequestedArtists(
    requestedArtistNames: string[],
    allArtists: UniqueArtist[]
): UniqueArtist[] {
    const artistsByKey = new Map(
        allArtists.map((artist) => [getArtistTagKey(artist.artistName), artist])
    );

    return requestedArtistNames.map((artistName) => {
        const artistKey = getArtistTagKey(artistName);

        return artistsByKey.get(artistKey) ?? {
            artistId: null,
            artistName,
            listenerCount: 0,
            playCount: 0,
            firstListenedAt: null
        };
    });
}

function shouldFetchArtistTags(
    existingRecord: ArtistTagRecord | undefined
): boolean {
    if (REFRESH_EXISTING_TAGS || !existingRecord) {
        return true;
    }

    return existingRecord.status !== "ok" || existingRecord.tags.length === 0;
}

async function fetchArtistsInParallel(input: {
    artists: UniqueArtist[];
    apiKey: string;
    tagIndex: ArtistTagIndex;
}): Promise<number> {
    let nextArtistIndex = 0;
    let fetchedCount = 0;

    async function worker(): Promise<void> {
        while (nextArtistIndex < input.artists.length) {
            const artist = input.artists[nextArtistIndex];
            nextArtistIndex += 1;

            const artistKey = getArtistTagKey(artist.artistName);

            try {
                input.tagIndex[artistKey] = await fetchArtistTagsWithRetry(
                    artist,
                    input.apiKey
                );
                fetchedCount += 1;
                console.log(
                    `Fetched tags for ${artist.artistName} (${fetchedCount} fetched).`
                );
            } catch (error) {
                input.tagIndex[artistKey] = createErrorRecord(artist, error);
                fetchedCount += 1;
                console.warn(
                    `Could not fetch tags for ${artist.artistName}: ${
                        input.tagIndex[artistKey].error
                    }`
                );
            }

            if (fetchedCount % SAVE_PROGRESS_EVERY === 0) {
                saveTagIndex(ARTIST_TAGS_PATH, input.tagIndex);
            }

            if (REQUEST_DELAY_MS > 0) {
                await sleep(REQUEST_DELAY_MS);
            }
        }
    }

    const workerCount = Math.min(CONCURRENCY, input.artists.length);

    await Promise.all(
        Array.from({ length: workerCount }, () => worker())
    );

    return fetchedCount;
}

async function run(): Promise<void> {
    const apiKey = getApiKey();
    const existingTagIndex = loadExistingTagIndex(ARTIST_TAGS_PATH);
    const { artists: allArtists, referenceDate } =
        await collectUniqueArtists(INTERACTIONS_PATH);
    const filteredArtists = ARTIST_NAMES.length > 0
        ? getRequestedArtists(ARTIST_NAMES, allArtists)
        : ARTIST_SEGMENT && ARTIST_SEGMENT !== "all"
        ? allArtists.filter(
            (artist) =>
                classifyArtistSegment(artist, {
                    ...DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds,
                    referenceDate
                }) === ARTIST_SEGMENT
        )
        : allArtists;
    const tagIndex: ArtistTagIndex = {};
    const selectedArtists = ARTIST_LIMIT > 0
        ? filteredArtists.slice(0, ARTIST_LIMIT)
        : filteredArtists;
    console.log(`Found ${allArtists.length} unique artists.`);

    if (ARTIST_NAMES.length > 0) {
        console.log(`Fetching requested artists: ${ARTIST_NAMES.join(", ")}.`);
    }

    if (ARTIST_SEGMENT && ARTIST_SEGMENT !== "all") {
        console.log(
            `Filtered to ${filteredArtists.length} ${ARTIST_SEGMENT} artists.`
        );
    }

    if (ARTIST_LIMIT > 0) {
        console.log(
            `Fetching the top ${selectedArtists.length} artists by play count first.`
        );
    }

    for (const artist of allArtists) {
        const artistKey = getArtistTagKey(artist.artistName);
        const existingRecord = existingTagIndex[artistKey];

        if (existingRecord) {
            tagIndex[artistKey] = existingRecord;
        }
    }

    const artistsToFetch = selectedArtists.filter((artist) =>
        shouldFetchArtistTags(tagIndex[getArtistTagKey(artist.artistName)])
    );
    const skippedCount = selectedArtists.length - artistsToFetch.length;

    console.log(
        `Fetching ${artistsToFetch.length} artists with concurrency ${CONCURRENCY}.`
    );

    const fetchedCount = await fetchArtistsInParallel({
        artists: artistsToFetch,
        apiKey,
        tagIndex
    });

    saveTagIndex(ARTIST_TAGS_PATH, tagIndex);
    console.log(
        `Saved artist tags to ${ARTIST_TAGS_PATH}. ` +
        `${fetchedCount} fetched, ${skippedCount} skipped.`
    );
}

run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
