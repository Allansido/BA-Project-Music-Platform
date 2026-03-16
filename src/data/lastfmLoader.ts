import fs from "fs";
import csv from "csv-parser";

export interface Interaction {
    userId: string;
    artistId: string;
    artistName: string;
    trackId: string;
    trackName: string;
    timestamp: string;
}

export function loadLastFMDataset(
    filePath: string,
    sampleSize?: number
): Promise<Interaction[]> {
    return new Promise((resolve, reject) => {
        const interactions: Interaction[] = [];

        fs.createReadStream(filePath)
            .pipe(
                csv({
                    separator: "\t",
                    headers: [
                        "userId",
                        "timestamp",
                        "artistId",
                        "artistName",
                        "trackId",
                        "trackName"
                    ]
                })
            )
            .on("data", (row) => {
                if (sampleSize && interactions.length >= sampleSize) return;

                interactions.push({
                    userId: row.userId,
                    artistId: row.artistId,
                    artistName: row.artistName,
                    trackId: row.trackId,
                    trackName: row.trackName,
                    timestamp: row.timestamp
                });
            })
            .on("end", () => {
                console.log(`Loaded ${interactions.length} interactions`);
                resolve(interactions);
            })
            .on("error", reject);
    });
}