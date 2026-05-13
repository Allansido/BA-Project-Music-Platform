import { ArtistSegment } from "../../../domain/artistSegmentation";
import { ExposureShareResult } from "./exposureShare";

export interface ExposureDisparityResult {
    disparity: number;
    dominantGroup: ArtistSegment | "balanced";
}

function roundMetric(value: number): number {
    return Number(value.toFixed(4));
}

export class ExposureDisparityMetric {
    evaluate(exposureShare: ExposureShareResult): ExposureDisparityResult {
        const emergingShare = exposureShare.shareByGroup.emerging;
        const establishedShare = exposureShare.shareByGroup.established;
        const disparity = roundMetric(Math.abs(establishedShare - emergingShare));

        let dominantGroup: ExposureDisparityResult["dominantGroup"] = "balanced";

        if (establishedShare > emergingShare) {
            dominantGroup = "established";
        }

        if (emergingShare > establishedShare) {
            dominantGroup = "emerging";
        }

        return {
            disparity,
            dominantGroup
        };
    }
}
