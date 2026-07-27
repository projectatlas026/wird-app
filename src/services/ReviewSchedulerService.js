import { DateService } from './DateService.js';

export const SRS_INTERVALS = [1, 3, 7, 14, 30, 60, 90, 180];

export const ReviewSchedulerService = {
    /**
     * Create a new memorization unit from a completed task
     */
    createUnit(task, rating, planId) {
        const intervalIndex = (rating >= 4) ? 1 : 0; // Excellent starts at 3 days, others at 1
        const nextReviewAt = DateService.addDays(DateService.getLocalDate(), SRS_INTERVALS[intervalIndex]);

        return {
            id: `u-${crypto.randomUUID ? crypto.randomUUID().slice(0,8) : Math.random().toString(36).slice(2,9)}`,
            planId,
            sourceTaskId: task.id,
            s1: task.s1, a1: task.a1, s2: task.s2, a2: task.a2,
            ayahCount: task.ayahCount,
            memorizedAt: DateService.getLocalDate(),
            masteryLevel: rating * 25,
            currentIntervalIndex: intervalIndex,
            reviewCount: 0,
            successfulReviewCount: 0,
            lastReviewedAt: null,
            nextReviewAt: nextReviewAt,
            lastRating: rating
        };
    },

    /**
     * Process a review session and return updated unit and a log entry
     */
    processReview(unit, rating) {
        const prevInterval = SRS_INTERVALS[unit.currentIntervalIndex];
        let nextIdx = unit.currentIntervalIndex;

        if (rating === 4) { // Excellent
            nextIdx = Math.min(SRS_INTERVALS.length - 1, nextIdx + 1);
        } else if (rating === 3) { // Good
            // Stay at same interval to solidify
        } else if (rating === 2) { // Weak
            nextIdx = Math.max(0, nextIdx - 1);
        } else { // Not memorized
            nextIdx = 0;
        }

        const nextInterval = SRS_INTERVALS[nextIdx];
        const nextReviewAt = DateService.addDays(DateService.getLocalDate(), nextInterval);

        const updatedUnit = {
            ...unit,
            currentIntervalIndex: nextIdx,
            reviewCount: unit.reviewCount + 1,
            successfulReviewCount: unit.successfulReviewCount + (rating >= 3 ? 1 : 0),
            lastReviewedAt: DateService.getLocalDate(),
            nextReviewAt: nextReviewAt,
            lastRating: rating,
            masteryLevel: this.calculateMastery(unit.masteryLevel, rating)
        };

        const log = {
            id: `l-${Date.now()}`,
            unitId: unit.id,
            reviewedAt: DateService.getLocalDate(),
            rating,
            previousInterval: prevInterval,
            nextInterval: nextInterval
        };

        return { updatedUnit, log };
    },

    calculateMastery(current, rating) {
        const delta = (rating - 2.5) * 15; // 4 -> +22.5, 3 -> +7.5, 2 -> -7.5, 1 -> -22.5
        return Math.max(0, Math.min(100, Math.round(current + delta)));
    }
};
