import { loadLastFMDataset } from "./data/lastfmLoader";
import { saveInteractionsToJSON } from "./data/dataPreprocessor";

const filePath =
    "dataset/raw/userid-timestamp-artid-artname-traid-traname.tsv";

async function run() {
    const interactions = await loadLastFMDataset(filePath, 100);

    saveInteractionsToJSON(interactions, "dataset/processed/interactions.json");
}

run();