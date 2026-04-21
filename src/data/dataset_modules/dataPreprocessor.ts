import fs from "fs";
import { Interaction } from "./lastfmLoader";

export function saveInteractionsToJSON(
    interactions: Interaction[],
    outputPath: string
) {
    const output = fs.openSync(outputPath, "w");

    try {
        fs.writeSync(output, "[\n");

        interactions.forEach((interaction, index) => {
            const prefix = index === 0 ? "  " : ",\n  ";
            fs.writeSync(output, `${prefix}${JSON.stringify(interaction)}`);
        });

        fs.writeSync(output, "\n]\n");
    } finally {
        fs.closeSync(output);
    }

    console.log(`Saved processed data to ${outputPath}`);
}
