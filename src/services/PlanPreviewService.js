import { DateService } from './DateService.js';
import { QuranRangeService } from './QuranRangeService.js';

export const PlanPreviewService = {
    calculate(form) {
        try {
            const memDaysPerWeek = Object.values(form.schedule).filter(v => v === 'mem').length;
            if (memDaysPerWeek === 0) return { valid: false, errorCode: 'NO_MEMORIZATION_DAYS_IN_SCHEDULE' };

            const range = QuranRangeService.resolveGoal(form);
            const totalAyahs = range.totalAyahs;
            
            if (form.mode === 'date') {
                const workDays = this.countWorkDaysInRange(form.startDate, form.targetEndDate, form.schedule);
                const requiredDaily = workDays > 0 ? Math.ceil(totalAyahs / workDays) : totalAyahs;
                return {
                    valid: true,
                    totalAyahs,
                    workDays,
                    requiredDaily,
                    isHeavy: requiredDaily > form.maxDailyAyahs,
                    estimatedEndDate: form.targetEndDate,
                    suggestedEndDate: this.addWorkDays(form.startDate, Math.ceil(totalAyahs / form.maxDailyAyahs), form.schedule)
                };
            } else {
                const totalWorkDaysNeeded = Math.ceil(totalAyahs / form.dailyAmount);
                const estimatedEndDate = this.addWorkDays(form.startDate, totalWorkDaysNeeded, form.schedule);
                return {
                    valid: true,
                    totalAyahs,
                    workDays: totalWorkDaysNeeded,
                    requiredDaily: form.dailyAmount,
                    estimatedEndDate
                };
            }
        } catch (e) {
            return { valid: false, errorCode: e.message };
        }
    },

    countWorkDaysInRange(start, end, schedule) {
        let count = 0, d = start;
        const diff = DateService.diffDays(end, start);
        if (diff < 0) return 0;
        for (let i = 0; i <= diff; i++) {
            if (schedule[DateService.getWeekday(d)] === 'mem') count++;
            d = DateService.addDays(d, 1);
        }
        return count;
    },

    addWorkDays(start, workDaysNeeded, schedule) {
        let d = start;
        let count = 0;
        let safety = 0;
        const MAX_ITERATIONS = 100000; // Allow up to ~270 years for very slow plans

        while (count < workDaysNeeded && safety < MAX_ITERATIONS) {
            if (schedule[DateService.getWeekday(d)] === 'mem') count++;
            if (count < workDaysNeeded) d = DateService.addDays(d, 1);
            safety++;
        }

        if (count < workDaysNeeded) throw new Error('PREVIEW_CALCULATION_LIMIT_EXCEEDED');
        return d;
    }
};
