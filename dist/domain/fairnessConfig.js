"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FAIRNESS_CONFIG = void 0;
exports.DEFAULT_FAIRNESS_CONFIG = {
    enabled: true,
    creatorGroupThresholds: {
        emergingMaxAccountAgeDays: 730,
        emergingMaxTotalListens: 500
    },
    exposureQuotaRule: {
        topN: 10,
        minimumExposureByGroup: {
            emerging: 4
        },
        prefixCheckpoints: [
            {
                topK: 3,
                minimumExposureByGroup: {
                    emerging: 1
                }
            },
            {
                topK: 5,
                minimumExposureByGroup: {
                    emerging: 2
                }
            },
            {
                topK: 10,
                minimumExposureByGroup: {
                    emerging: 4
                }
            }
        ]
    },
    candidatePoolSize: 5000
};
