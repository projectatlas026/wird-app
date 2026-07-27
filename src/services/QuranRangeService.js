import { 
    SURAH_NAMES, 
    AYAH_COUNTS, 
    JUZ_STARTS, 
    HIZB_STARTS 
} from './QuranData.js';

export const QuranRangeService = {
    getAyahsBetween(s1, a1, s2, a2) {
        if (!Number.isInteger(s1) || !Number.isInteger(s2) || s1 < 1 || s1 > 114 || s2 < 1 || s2 > 114) {
            throw new Error("INVALID_SURAH_RANGE");
        }
        if (!Number.isInteger(a1) || !Number.isInteger(a2) || a1 < 1 || a1 > AYAH_COUNTS[s1 - 1] || a2 < 1 || a2 > AYAH_COUNTS[s2 - 1]) {
            throw new Error("INVALID_AYAH_RANGE");
        }
        if (s2 < s1 || (s1 === s2 && a2 < a1)) {
            throw new Error("INVALID_AYAH_ORDER");
        }

        const ayahs = [];
        for (let surah = s1; surah <= s2; surah++) {
            const startAyah = surah === s1 ? a1 : 1;
            const endAyah = surah === s2 ? a2 : AYAH_COUNTS[surah - 1];
            for (let ayah = startAyah; ayah <= endAyah; ayah++) {
                ayahs.push({ s: surah, a: ayah });
            }
        }
        return ayahs;
    },

    getAyahOrdinal(s, a) {
        let ordinal = 0;
        for (let i = 0; i < s - 1; i++) ordinal += AYAH_COUNTS[i];
        return ordinal + a;
    },

    getGoalArabicDescription(form) {
        const { goalType, startJuz, endJuz, startHizb, endHizb, startSurah, endSurah, startAyah, endAyah } = form;
        if (goalType === 'FULL_QURAN') return "القرآن كاملًا";
        if (goalType === 'JUZ_RANGE') return startJuz === endJuz ? `الجزء ${startJuz}` : `من الجزء ${startJuz} إلى ${endJuz}`;
        if (goalType === 'HIZB_RANGE') return startHizb === endHizb ? `الحزب ${startHizb}` : `من الحزب ${startHizb} إلى ${endHizb}`;
        if (goalType === 'SURAH_RANGE') return startSurah === endSurah ? `سورة ${SURAH_NAMES[startSurah-1]}` : `من سورة ${SURAH_NAMES[startSurah-1]} إلى ${SURAH_NAMES[endSurah-1]}`;
        if (goalType === 'AYAH_RANGE') {
             const start = `${SURAH_NAMES[startSurah-1]} (${startAyah})`;
             const end = `${SURAH_NAMES[endSurah-1]} (${endAyah})`;
             return start === end ? start : `من ${start} إلى ${end}`;
        }
        return "هدف مخصص";
    },

    getPrevAyah(s, a) {
        if (a > 1) return [s, a - 1];
        if (s > 1) return [s - 1, AYAH_COUNTS[s - 2]];
        return [1, 1];
    },

    resolveGoal(form) {
        if (!form.goalType) throw new Error('INVALID_GOAL_TYPE');
        let s1, a1, s2, a2;
        switch (form.goalType) {
            case 'FULL_QURAN': [s1, a1, s2, a2] = [1, 1, 114, 6]; break;
            case 'JUZ_RANGE':
                if (form.startJuz < 1 || form.endJuz > 30 || form.endJuz < form.startJuz) throw new Error('INVALID_JUZ_RANGE');
                [s1, a1] = JUZ_STARTS[form.startJuz - 1];
                const endJ = form.endJuz === 30 ? [114, 7] : JUZ_STARTS[form.endJuz];
                [s2, a2] = this.getPrevAyah(endJ[0], endJ[1]);
                break;
            case 'HIZB_RANGE':
                if (form.startHizb < 1 || form.endHizb > 60 || form.endHizb < form.startHizb) throw new Error('INVALID_HIZB_RANGE');
                [s1, a1] = HIZB_STARTS[form.startHizb - 1];
                const endH = form.endHizb === 60 ? [114, 7] : HIZB_STARTS[form.endHizb];
                [s2, a2] = this.getPrevAyah(endH[0], endH[1]);
                break;
            case 'SURAH_RANGE':
                if (form.startSurah < 1 || form.endSurah > 114 || form.endSurah < form.startSurah) throw new Error('INVALID_SURAH_RANGE');
                [s1, a1, s2, a2] = [form.startSurah, 1, form.endSurah, AYAH_COUNTS[form.endSurah - 1]];
                break;
            case 'AYAH_RANGE':
                [s1, a1, s2, a2] = [form.startSurah, form.startAyah, form.endSurah, form.endAyah];
                break;
            default: throw new Error('INVALID_GOAL_TYPE');
        }
        const ayahs = this.getAyahsBetween(s1, a1, s2, a2);
        return { s1, a1, s2, a2, ayahs, totalAyahs: ayahs.length };
    }
};
