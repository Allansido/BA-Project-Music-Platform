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
        const selectedUsers = new Set<string>();

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

                // Step 1: collect users until limit
                if (selectedUsers.size < (sampleSize || 200)) {
                    selectedUsers.add(row.userId);
                }

                // Step 2: only include selected users
                if (!selectedUsers.has(row.userId)) return;

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