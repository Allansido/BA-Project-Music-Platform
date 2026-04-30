"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArtistAccountAgeDays = getArtistAccountAgeDays;
exports.classifyArtistSegment = classifyArtistSegment;
exports.splitArtistsBySegment = splitArtistsBySegment;
const fairnessConfig_1 = require("./fairnessConfig");
function normalizeText(value) {
    return value?.trim() ?? "";
}
function getValidThreshold(value, fallback) {
    if (value == null || !Number.isFinite(value) || value < 0) {
        return fallback;
    }
    return value;
}
function getArtistKey(interaction) {
    const artistId = normalizeText(interaction.artistId);
    if (artistId) {
        return artistId;
    }
    const artistName = normalizeText(interaction.artistName);
    if (!artistName) {
        return null;
    }
    return artistName.toLowerCase();
}
function updateDateRange(stats, timestamp) {
    if (!timestamp) {
        return;
    }
    if (!stats.firstListenedAt || timestamp < stats.firstListenedAt) {
        stats.firstListenedAt = timestamp;
    }
    if (!stats.lastListenedAt || timestamp > stats.lastListenedAt) {
        stats.lastListenedAt = timestamp;
    }
}
function getArtistAccountAgeDays(firstListenedAt, referenceDate = new Date()) {
    if (!firstListenedAt) {
        return null;
    }
    const firstObservedAt = new Date(firstListenedAt);
    if (Number.isNaN(firstObservedAt.getTime())) {
        return null;
    }
    const millisecondsDiff = referenceDate.getTime() - firstObservedAt.getTime();
    if (!Number.isFinite(millisecondsDiff) || millisecondsDiff < 0) {
        return 0;
    }
    return Math.floor(millisecondsDiff / (1000 * 60 * 60 * 24));
}
function classifyArtistSegment(artist, options = {}) {
    const thresholds = {
        emergingMaxAccountAgeDays: getValidThreshold(options.emergingMaxAccountAgeDays, fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds.emergingMaxAccountAgeDays),
        emergingMaxTotalListens: getValidThreshold(options.emergingMaxTotalListens, fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds.emergingMaxTotalListens)
    };
    const accountAgeDays = getArtistAccountAgeDays(artist.firstListenedAt, options.referenceDate);
    const hasEmergingAge = accountAgeDays != null
        && accountAgeDays <= thresholds.emergingMaxAccountAgeDays;
    const hasEmergingListenCount = artist.playCount <= thresholds.emergingMaxTotalListens;
    return hasEmergingAge && hasEmergingListenCount
        ? "emerging"
        : "established";
}
function toArtistStats(stats, segment, referenceDate) {
    return {
        artistKey: stats.artistKey,
        artistId: stats.artistId,
        artistName: stats.artistName,
        playCount: stats.playCount,
        listenerCount: stats.listeners.size,
        trackCount: stats.tracks.size,
        firstListenedAt: stats.firstListenedAt,
        lastListenedAt: stats.lastListenedAt,
        accountAgeDays: getArtistAccountAgeDays(stats.firstListenedAt, referenceDate),
        segment
    };
}
function compareArtistPopularity(firstArtist, secondArtist) {
    return (secondArtist.listenerCount - firstArtist.listenerCount ||
        secondArtist.playCount - firstArtist.playCount ||
        secondArtist.trackCount - firstArtist.trackCount ||
        firstArtist.artistName.localeCompare(secondArtist.artistName));
}
function splitArtistsBySegment(interactions, options = {}) {
    const artistsByKey = new Map();
    let latestInteractionAt = null;
    const thresholds = {
        emergingMaxAccountAgeDays: getValidThreshold(options.emergingMaxAccountAgeDays, fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds.emergingMaxAccountAgeDays),
        emergingMaxTotalListens: getValidThreshold(options.emergingMaxTotalListens, fairnessConfig_1.DEFAULT_FAIRNESS_CONFIG.creatorGroupThresholds.emergingMaxTotalListens)
    };
    for (const interaction of interactions) {
        const artistKey = getArtistKey(interaction);
        if (!artistKey) {
            continue;
        }
        const artistName = normalizeText(interaction.artistName);
        const artistId = normalizeText(interaction.artistId) || null;
        const trackKey = normalizeText(interaction.trackId) ||
            normalizeText(interaction.trackName);
        const stats = artistsByKey.get(artistKey) ??
            {
                artistKey,
                artistId,
                artistName,
                playCount: 0,
                listeners: new Set(),
                tracks: new Set(),
                firstListenedAt: null,
                lastListenedAt: null
            };
        stats.playCount += 1;
        stats.listeners.add(interaction.userId);
        if (trackKey) {
            stats.tracks.add(trackKey);
        }
        updateDateRange(stats, interaction.timestamp);
        if (interaction.timestamp &&
            (!latestInteractionAt || interaction.timestamp > latestInteractionAt)) {
            latestInteractionAt = interaction.timestamp;
        }
        artistsByKey.set(artistKey, stats);
    }
    const referenceDate = options.referenceDate ??
        (latestInteractionAt ? new Date(latestInteractionAt) : new Date());
    const unsegmentedArtists = [...artistsByKey.values()]
        .map((stats) => toArtistStats(stats, "emerging", referenceDate))
        .sort(compareArtistPopularity);
    const allArtists = unsegmentedArtists.map((artist) => ({
        ...artist,
        segment: classifyArtistSegment(artist, {
            ...thresholds,
            referenceDate
        })
    }));
    return {
        emerging: allArtists.filter((artist) => artist.segment === "emerging"),
        established: allArtists.filter((artist) => artist.segment === "established"),
        allArtists,
        thresholds
    };
}
