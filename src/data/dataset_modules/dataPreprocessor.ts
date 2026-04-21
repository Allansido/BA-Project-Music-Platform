import fs from "fs";
import { Interaction } from "./lastfmLoader";

export function saveInteractionsToJSON(
    interactions: Interaction[],
    outputPath: string
) {
    const stream = fs.createWriteStream(outputPath);

    stream.write("[\n");

    interactions.forEach((interaction, index) => {
        const json = JSON.stringify(interaction);

        if (index < interactions.length - 1) {
            stream.write(json + ",\n");
        } else {
            stream.write(json + "\n");
        }
    });

    stream.write("]");
    stream.end();

    console.log(`Saved processed data to ${outputPath}`);
}