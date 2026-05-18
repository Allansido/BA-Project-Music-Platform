require("ts-node/register/transpile-only");

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    NdcgAtNMetric
} = require("../src/data/metrics_evaluator/relevance_metrics/ndcg@n");
const {
    PrecisionAtNMetric
} = require("../src/data/metrics_evaluator/relevance_metrics/precision@n");

function createInteraction(
    userId,
    timestamp,
    artistId,
    artistName,
    trackId,
    trackName
) {
    return {
        userId,
        timestamp,
        artistId,
        artistName,
        trackId,
        trackName
    };
}

function createPerfectRankingInteractions() {
    return [
        createInteraction("listener-1", "2024-01-01T00:00:00Z", "a", "Artist A", "a-track", "Track A"),
        createInteraction("listener-1", "2024-01-02T00:00:00Z", "b", "Artist B", "b-track", "Track B"),
        createInteraction("listener-1", "2024-01-03T00:00:00Z", "c", "Artist C", "c-track", "Track C"),
        createInteraction("listener-2", "2024-01-01T00:00:00Z", "a", "Artist A", "a-track", "Track A"),
        createInteraction("listener-2", "2024-01-02T00:00:00Z", "c", "Artist C", "c-track", "Track C"),
        createInteraction("listener-2", "2024-01-03T00:00:00Z", "b", "Artist B", "b-track", "Track B")
    ];
}

const sharedOptions = {
    topN: 1,
    testRatio: 0.34,
    minimumUserActivityThreshold: 3,
    minimumTrainInteractions: 2,
    minimumTestInteractions: 1,
    favoriteArtistCount: 2,
    genreCount: 1,
    applyFairness: false
};

test("NdcgAtNMetric returns 1 for a perfect top-1 artist and track ranking", () => {
    const metric = new NdcgAtNMetric(sharedOptions);
    const result = metric.evaluate(createPerfectRankingInteractions());

    assert.equal(result.evaluatedUsers, 2);
    assert.equal(result.artists.averageNdcgAtN, 1);
    assert.equal(result.tracks.averageNdcgAtN, 1);

    for (const userResult of result.users) {
        assert.equal(userResult.artistNdcgAtN, 1);
        assert.equal(userResult.trackNdcgAtN, 1);
    }
});

test("PrecisionAtNMetric returns 1 for a perfect top-1 artist and track ranking", () => {
    const metric = new PrecisionAtNMetric(sharedOptions);
    const result = metric.evaluate(createPerfectRankingInteractions());

    assert.equal(result.evaluatedUsers, 2);
    assert.equal(result.artists.averagePrecisionAtN, 1);
    assert.equal(result.tracks.averagePrecisionAtN, 1);

    for (const userResult of result.users) {
        assert.equal(userResult.artistPrecisionAtN, 1);
        assert.equal(userResult.trackPrecisionAtN, 1);
    }
});
