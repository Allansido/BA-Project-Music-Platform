import fs from "fs";
import { Interaction } from "./lastfmLoader";

export function saveInteractionsToJSON(
    interactions: Interaction[],
    outputPath: string
) {
    fs.writeFileSync(outputPath, JSON.stringify(interactions, null, 2));
    console.log(`Saved processed data to ${outputPath}`);
}
