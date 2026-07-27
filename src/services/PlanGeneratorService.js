import { DateService } from './DateService.js';
import { QuranRangeService } from './QuranRangeService.js';

export const PlanGeneratorService = {
    countWorkDays(start, end, schedule) {
        let count = 0, d = start;
        while (DateService.diffDays(end, d) >= 0) {
            if (schedule[DateService.getWeekday(d)] === 'mem') count++;
            d = DateService.addDays(d, 1);
        }
        return count;
    },

    generate(p, range) {
        // 1. Strict Service Self-Defense
        if (!p.schedule || !Object.values(p.schedule).includes('mem')) throw new Error('NO_MEMORIZATION_DAYS_IN_SCHEDULE');
        if (!['date', 'amount'].includes(p.mode)) throw new Error('INVALID_PLAN_MODE');
        if (!DateService.isValidDateString(p.startDate)) throw new Error('INVALID_START_DATE');
        if (p.mode === 'amount' && (!Number.isInteger(p.dailyAmount) || p.dailyAmount < 1)) throw new Error('INVALID_DAILY_AMOUNT');
        if (p.mode === 'date' && (!Number.isInteger(p.maxDailyAyahs) || p.maxDailyAyahs < 1)) throw new Error('INVALID_MAX_DAILY_AYAHS');
        if (!range || !range.ayahs || range.ayahs.length === 0) throw new Error('EMPTY_RANGE');

        const tasks = [];
        let ayahIdx = 0;
        let curD = p.startDate;
        const total = range.ayahs.length;
        const workDaysTotal = (p.mode === 'date') ? this.countWorkDays(p.startDate, p.targetEndDate, p.schedule) : 0;
        
        if (p.mode === 'date' && workDaysTotal === 0) throw new Error('NO_WORKDAYS_IN_DATE_RANGE');

        let workDayC = 0;
        let daySafety = 0;
        const ABSOLUTE_DAY_LIMIT = 50000; 

        while (ayahIdx < total) {
            daySafety++;
            if (daySafety > ABSOLUTE_DAY_LIMIT) throw new Error('GENERATION_LIMIT_EXCEEDED');

            const dayType = p.schedule[DateService.getWeekday(curD)];
            const taskId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

            if (dayType === 'mem') {
                workDayC++;
                let amt = p.dailyAmount;
                if (p.mode === 'date') {
                    const remainingDays = workDaysTotal - workDayC + 1;
                    amt = Math.ceil((total - ayahIdx) / Math.max(1, remainingDays));
                    
                    if (p.maxDailyAyahs && amt > p.maxDailyAyahs) throw new Error('REQUIRED_DAILY_AMOUNT_EXCEEDS_LIMIT');
                    if (DateService.diffDays(curD, p.targetEndDate) > 0) throw new Error('TARGET_DATE_EXCEEDED_INCOMPLETE');
                }

                const st = range.ayahs[ayahIdx];
                const enIdx = Math.min(total - 1, ayahIdx + amt - 1);
                const en = range.ayahs[enIdx];

                tasks.push({
                    id: taskId, date: curD, type: 'NEW_MEMORIZATION',
                    s1: st.s, a1: st.a, s2: en.s, a2: en.a,
                    ayahCount: enIdx - ayahIdx + 1, status: 'PENDING'
                });
                ayahIdx = enIdx + 1;
            } else if (dayType === 'rev') {
                tasks.push({ id: taskId, date: curD, type: 'REV_GENERAL', status: 'PENDING' });
            }
            curD = DateService.addDays(curD, 1);
        }

        // 2. REAL INTEGRITY CHECK
        const ayahKey = ({ s, a }) => `${s}:${a}`;
        const goalKeys = range.ayahs.map(ayahKey);
        
        const generatedKeys = tasks
            .filter(task => task.type === "NEW_MEMORIZATION")
            .flatMap(task =>
                QuranRangeService.getAyahsBetween(task.s1, task.a1, task.s2, task.a2).map(ayahKey)
            );

        if (generatedKeys.length !== goalKeys.length) {
            throw new Error("INTEGRITY_LENGTH_MISMATCH");
        }
        if (new Set(generatedKeys).size !== generatedKeys.length) {
            throw new Error("INTEGRITY_DUPLICATED_AYAHS");
        }
        if (!generatedKeys.every((key, index) => key === goalKeys[index])) {
            throw new Error("INTEGRITY_SEQUENCE_MISMATCH");
        }

        return tasks;
    }
};
