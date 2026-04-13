import { loadLastFMDataset } from "../data/dataset_modules/lastfmLoader";
import { saveInteractionsToJSON } from "../data/dataset_modules/dataPreprocessor";

const filePath =
    "dataset/raw/userid-timestamp-artid-artname-traid-traname.tsv";

async function run() {
    const interactions = await loadLastFMDataset(filePath, 1000);

    saveInteractionsToJSON(interactions, "dataset/processed/interactions.json");
}

run();