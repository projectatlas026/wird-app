import { JUZ_STARTS, HIZB_STARTS, AYAH_COUNTS } from './QuranData.js';

export const QuranRangeService = {
    getPrevAyah(s, a) {
        if (a > 1) return [s, a - 1];
        if (s > 1) return [s - 1, AYAH_COUNTS[s - 2]];
        return [1, 1];
    },

    resolveGoal(form) {
        let s1, a1, s2, a2;
        switch (form.goalType) {
            case 'FULL_QURAN':
                [s1, a1, s2, a2] = [1, 1, 114, 6];
                break;
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
                s1 = form.startSurah; a1 = 1;
                s2 = form.endSurah; a2 = AYAH_COUNTS[form.endSurah - 1];
                break;
            case 'AYAH_RANGE':
                [s1, a1, s2, a2] = [form.startSurah, form.startAyah, form.endSurah, form.endAyah];
                break;
            default:
                throw new Error('INVALID_GOAL_TYPE');
        }

        const ayahs = [];
        for (let s = s1; s <= s2; s++) {
            const start = (s === s1) ? a1 : 1;
            const end = (s === s2) ? a2 : AYAH_COUNTS[s - 1];
            for (let a = start; a <= end; a++) {
                ayahs.push({ s, a });
            }
        }
        return { s1, a1, s2, a2, ayahs, totalAyahs: ayahs.length };
    }
};
