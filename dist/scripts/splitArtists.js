"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const artistSegmentation_1 = require("../domain/artistSegmentation");
const inputPath = "dataset/processed/interactions.json";
const outputPath = "dataset/processed/artistSegments.json";
function readInteractions(filePath) {
    return JSON.parse(fs_1.default.readFileSync(filePath, "utf8"));
}
function run() {
    const interactions = readInteractions(inputPath);
    const result = (0, artistSegmentation_1.splitArtistsBySegment)(interactions);
    fs_1.default.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Saved ${result.allArtists.length} artist segments to ${outputPath}`);
    console.log(`Emerging artists: ${result.emerging.length}`);
    console.log(`Established artists: ${result.established.length}`);
}
run();
