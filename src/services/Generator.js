export const PlanGeneratorService = {
    countWorkDays(start, end, schedule) {
        let count = 0;
        let d = new Date(start + "T00:00:00Z");
        const endD = new Date(end + "T00:00:00Z");
        while (d <= endD) {
            if (schedule[d.getUTCDay()] === 'mem') count++;
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return count;
    },

    generate(p, range) {
        // Defensive Checks
        if (!Object.values(p.schedule).includes('mem')) throw new Error('NO_MEMORIZATION_DAYS');
        if (p.mode === 'amount' && p.dailyAmount < 1) throw new Error('INVALID_DAILY_AMOUNT');
        if (!range || !range.ayahs || range.ayahs.length === 0) throw new Error('EMPTY_RANGE');

        const tasks = [];
        let ayahIdx = 0;
        let curD = p.startDate;
        const total = range.ayahs.length;
        const workDaysTotal = (p.mode === 'date') ? this.countWorkDays(p.startDate, p.targetEndDate, p.schedule) : 0;
        
        if (p.mode === 'date' && workDaysTotal === 0) throw new Error('NO_WORKDAYS_IN_RANGE');

        let workDayC = 0;
        let iterations = 0;
        const MAX_DAYS = 60000; // Increased to allow ~164 years for low pace (Full Quran @ 1 ayah/workday)

        while (ayahIdx < total) {
            iterations++;
            if (iterations > MAX_DAYS) throw new Error('GENERATION_LIMIT_EXCEEDED');

            const d = new Date(curD + "T00:00:00Z");
            const dayType = p.schedule[d.getUTCDay()];
            const taskId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

            if (dayType === 'mem') {
                workDayC++;
                let amt = p.dailyAmount;
                if (p.mode === 'date') {
                    const remainingDays = workDaysTotal - workDayC + 1;
                    amt = Math.ceil((total - ayahIdx) / Math.max(1, remainingDays));
                    
                    if (d > new Date(p.targetEndDate + "T00:00:00Z")) {
                        throw new Error('TARGET_DATE_EXCEEDED_INCOMPLETE');
                    }
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
            } else {
                // Keep compensation days as placeholders (Not as REST)
                tasks.push({ 
                    id: taskId, date: curD, 
                    type: dayType === 'rev' ? 'REV_GENERAL' : dayType === 'comp' ? 'COMPENSATION_SLOT' : 'REST', 
                    status: 'PENDING' 
                });
            }

            d.setUTCDate(d.getUTCDate() + 1);
            curD = d.toISOString().slice(0, 10);
        }

        // Integrity Checks
        const generatedAyahCount = tasks.filter(t => t.type === 'NEW_MEMORIZATION').reduce((s, t) => s + t.ayahCount, 0);
        if (generatedAyahCount !== total) throw new Error('INTEGRITY_CHECK_FAILED_AYAH_COUNT');

        return tasks;
    }
};
