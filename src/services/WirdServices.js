/**
 * Wird App - Core Services & Logic
 * Standard: Production-Ready, Validated, Hafs-Only Baseline
 */

/* ─────────────── DATA: Metadata & Boundaries ─────────────── */
export const QURAN_METADATA = {
    riwayah: "حفص عن عاصم",
    source: "Tanzil.net / King Fahd Complex",
    version: "1.0.0",
    lastVerified: "2026-07-27",
    status: "Verified"
};

export const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
export const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

export const JUZ_STARTS = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
export const HIZB_STARTS = [[1,1],[2,75],[2,142],[2,203],[2,253],[3,15],[3,93],[3,171],[4,24],[4,88],[4,148],[5,27],[5,82],[6,36],[6,111],[7,1],[7,88],[7,171],[8,41],[9,34],[9,93],[10,26],[11,6],[11,84],[12,53],[13,19],[15,1],[16,51],[17,1],[17,100],[18,75],[19,59],[21,1],[22,38],[23,1],[24,21],[25,21],[26,111],[27,56],[29,1],[29,46],[31,22],[33,31],[34,24],[36,28],[38,21],[39,32],[40,41],[41,47],[43,24],[46,1],[48,18],[51,31],[54,9],[58,1],[61,1],[67,1],[72,1],[78,1],[87,1]];

/* ─────────────── SERVICE: Validation ─────────────── */
export const ValidationService = {
    validateForm(form) {
        if (form.riwayahId !== 'hafs') throw new Error('UNSUPPORTED_RIWAYAH');
        
        if (form.goalType === 'JUZ_RANGE') {
            if (form.startJuz < 1 || form.startJuz > 30 || form.endJuz < 1 || form.endJuz > 30) throw new Error('INVALID_JUZ_RANGE');
            if (form.endJuz < form.startJuz) throw new Error('INVALID_JUZ_ORDER');
        }

        if (form.goalType === 'HIZB_RANGE') {
            if (form.startHizb < 1 || form.startHizb > 60 || form.endHizb < 1 || form.endHizb > 60) throw new Error('INVALID_HIZB_RANGE');
            if (form.endHizb < form.startHizb) throw new Error('INVALID_HIZB_ORDER');
        }

        if (form.goalType === 'AYAH_RANGE') {
            const maxS = AYAH_COUNTS[form.startSurah - 1];
            const maxE = AYAH_COUNTS[form.endSurah - 1];
            if (form.startAyah < 1 || form.startAyah > maxS) throw new Error('INVALID_START_AYAH');
            if (form.endAyah < 1 || form.endAyah > maxE) throw new Error('INVALID_END_AYAH');
            if (form.endSurah < form.startSurah || (form.endSurah === form.startSurah && form.endAyah < form.startAyah)) {
                throw new Error('INVALID_AYAH_ORDER');
            }
        }

        if (form.mode === 'date') {
            const start = new Date(form.startDate);
            const end = new Date(form.targetEndDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('INVALID_DATE_FORMAT');
            if (end <= start) throw new Error('END_DATE_MUST_BE_AFTER_START');
        }

        if (form.mode === 'amount') {
            if (!Number.isInteger(form.dailyAmount) || form.dailyAmount < 1) throw new Error('INVALID_DAILY_AMOUNT');
        }

        if (!Object.values(form.schedule).includes('mem')) throw new Error('NO_MEMORIZATION_DAYS');
        
        return true;
    }
};

/* ─────────────── SERVICE: QuranRange ─────────────── */
export const QuranRangeService = {
    getPrevAyah(s, a) {
        if (a > 1) return [s, a - 1];
        if (s > 1) return [s - 1, AYAH_COUNTS[s - 2]];
        return [1, 1];
    },
    resolveGoal(form) {
        let s1, a1, s2, a2;
        switch (form.goalType) {
            case 'FULL_QURAN': [s1, a1, s2, a2] = [1, 1, 114, 6]; break;
            case 'JUZ_RANGE':
                [s1, a1] = JUZ_STARTS[form.startJuz - 1];
                const endJ = form.endJuz === 30 ? [114, 7] : JUZ_STARTS[form.endJuz];
                [s2, a2] = this.getPrevAyah(endJ[0], endJ[1]);
                break;
            case 'HIZB_RANGE':
                [s1, a1] = HIZB_STARTS[form.startHizb - 1];
                const endH = form.endHizb === 60 ? [114, 7] : HIZB_STARTS[form.endHizb];
                [s2, a2] = this.getPrevAyah(endH[0], endH[1]);
                break;
            case 'SURAH_RANGE':
                [s1, a1] = [form.startSurah, 1];
                [s2, a2] = [form.endSurah, AYAH_COUNTS[form.endSurah - 1]];
                break;
            default: // AYAH_RANGE
                [s1, a1, s2, a2] = [form.startSurah, form.startAyah, form.endSurah, form.endAyah];
        }

        const ayahs = [];
        for (let s = s1; s <= s2; s++) {
            const start = (s === s1) ? a1 : 1;
            const end = (s === s2) ? a2 : AYAH_COUNTS[s - 1];
            for (let a = start; a <= end; a++) ayahs.push({ s, a });
        }

        if (ayahs.length === 0) throw new Error('EMPTY_RANGE');
        return { s1, a1, s2, a2, ayahs, totalAyahs: ayahs.length };
    }
};

/* ─────────────── SERVICE: PlanGenerator ─────────────── */
export const PlanGeneratorService = {
    countWorkDays(start, end, schedule) {
        let count = 0, d = new Date(start + "T00:00:00Z");
        const endD = new Date(end + "T00:00:00Z");
        while (d <= endD) {
            if (schedule[d.getUTCDay()] === 'mem') count++;
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return count;
    },
    generate(p, range) {
        const tasks = [];
        let ayahIdx = 0;
        let curD = p.startDate;
        const total = range.ayahs.length;
        const workDaysTotal = (p.mode === 'date') ? this.countWorkDays(p.startDate, p.targetEndDate, p.schedule) : 0;
        
        if (p.mode === 'date' && workDaysTotal === 0) throw new Error('NO_WORKDAYS_IN_RANGE');

        let workDayC = 0;
        let dayLimit = 0;

        while (ayahIdx < total && dayLimit < 15000) {
            dayLimit++;
            const d = new Date(curD + "T00:00:00Z");
            const dayType = p.schedule[d.getUTCDay()];
            const taskId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

            if (dayType === 'mem') {
                workDayC++;
                let amt = p.dailyAmount;
                if (p.mode === 'date') {
                    const remainingDays = workDaysTotal - workDayC + 1;
                    amt = Math.ceil((total - ayahIdx) / Math.max(1, remainingDays));
                    // الحماية من تجاوز التاريخ
                    if (new Date(curD + "T00:00:00Z") > new Date(p.targetEndDate + "T00:00:00Z")) {
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
                // مهام غير الحفظ (راحة، مراجعة عامة)
                tasks.push({ id: taskId, date: curD, type: dayType === 'rev' ? 'REV_GENERAL' : 'REST', status: 'PENDING' });
            }

            // تحديث التاريخ لليوم التالي
            d.setUTCDate(d.getUTCDate() + 1);
            curD = d.toISOString().slice(0, 10);
        }

        if (ayahIdx < total) throw new Error('FAILED_TO_COMPLETE_RANGE');
        return tasks;
    }
};
