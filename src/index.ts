import app from "./server/app";

const filePath = "dataset/raw/userid-timestamp-artid-artname-traid-traname.tsv";

async function run() {
    const interactions = await loadLastFMDataset(filePath, 100);


    const uniqueUsers = new Set(interactions.map(i => i.userId));
    console.log("Unique users:", uniqueUsers.size);


    saveInteractionsToJSON(interactions, "dataset/processed/interactions.json");
}

run();