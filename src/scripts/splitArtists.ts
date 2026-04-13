import fs from "fs";
import { Interaction } from "../data/dataset_modules/lastfmLoader";
import { splitArtistsBySegment } from "../domain/artistSegmentation";

const inputPath = "dataset/processed/interactions.json";
const outputPath = "dataset/processed/artistSegments.json";

function readInteractions(filePath: string): Interaction[] {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Interaction[];
}

function run() {
    const interactions = readInteractions(inputPath);
    const result = splitArtistsBySegment(interactions);

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(
        `Saved ${result.allArtists.length} artist segments to ${outputPath}`
    );
    console.log(`Emerging artists: ${result.emerging.length}`);
    console.log(`Established artists: ${result.established.length}`);
}

run();
