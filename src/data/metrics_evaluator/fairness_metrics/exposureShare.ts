import { ArtistSegment } from "../../../domain/fairness_artist_logic/artistSegmentation";
import { ExposureCountSummary } from "../../recommendation_modules/baselineRecommender";

export interface ExposureShareResult {
    totalExposure: number;
    exposureByGroup: ExposureCountSummary;
    shareByGroup: Record<ArtistSegment, number>;
}

function roundMetric(value: number): number {
    return Number(value.toFixed(4));
}

export class ExposureShareMetric {
    evaluate(exposureByGroup: ExposureCountSummary): ExposureShareResult {
        const totalExposure =
            exposureByGroup.emerging + exposureByGroup.established;

        return {
            totalExposure,
            exposureByGroup,
            shareByGroup: {
                emerging: totalExposure > 0
                    ? roundMetric(exposureByGroup.emerging / totalExposure)
                    : 0,
                established: totalExposure > 0
                    ? roundMetric(exposureByGroup.established / totalExposure)
                    : 0
            }
        };
    }
}
