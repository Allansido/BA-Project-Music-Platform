import { ArtistSegment } from "../../../domain/fairness_artist_logic/artistSegmentation";
import { ExposureQuotaRule } from "../../../domain/fairness_artist_logic/fairnessConfig";
import { ExposureCountSummary } from "../../recommendation_modules/baselineRecommender";

export interface FairnessDeviationResult {
    targetExposureByGroup: ExposureCountSummary;
    actualExposureByGroup: ExposureCountSummary;
    missingExposureByGroup: ExposureCountSummary;
    totalMissingExposure: number;
    deviationShare: number;
    quotaSatisfied: boolean;
}

function roundMetric(value: number): number {
    return Number(value.toFixed(4));
}

function getTargetCount(
    group: ArtistSegment,
    rule: ExposureQuotaRule,
    evaluatedLists: number
): number {
    return (rule.minimumExposureByGroup[group] ?? 0) * evaluatedLists;
}

export class FairnessDeviationMetric {
    evaluate(input: {
        exposureByGroup: ExposureCountSummary;
        rule: ExposureQuotaRule;
        evaluatedLists: number;
    }): FairnessDeviationResult {
        const targetExposureByGroup: ExposureCountSummary = {
            emerging: getTargetCount("emerging", input.rule, input.evaluatedLists),
            established: getTargetCount(
                "established",
                input.rule,
                input.evaluatedLists
            )
        };
        const missingExposureByGroup: ExposureCountSummary = {
            emerging: Math.max(
                0,
                targetExposureByGroup.emerging - input.exposureByGroup.emerging
            ),
            established: Math.max(
                0,
                targetExposureByGroup.established -
                    input.exposureByGroup.established
            )
        };
        const totalMissingExposure =
            missingExposureByGroup.emerging + missingExposureByGroup.established;
        const totalTargetExposure =
            targetExposureByGroup.emerging + targetExposureByGroup.established;

        return {
            targetExposureByGroup,
            actualExposureByGroup: input.exposureByGroup,
            missingExposureByGroup,
            totalMissingExposure,
            deviationShare: totalTargetExposure > 0
                ? roundMetric(totalMissingExposure / totalTargetExposure)
                : 0,
            quotaSatisfied: totalMissingExposure === 0
        };
    }
}
