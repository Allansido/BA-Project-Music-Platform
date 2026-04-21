"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lastfmLoader_1 = require("../data/dataset_modules/lastfmLoader");
const dataPreprocessor_1 = require("../data/dataset_modules/dataPreprocessor");
const filePath = "dataset/raw/userid-timestamp-artid-artname-traid-traname.tsv";
async function run() {
    const interactions = await (0, lastfmLoader_1.loadLastFMDataset)(filePath, 200);
    (0, dataPreprocessor_1.saveInteractionsToJSON)(interactions, "dataset/processed/interactions.json");
}
run();
