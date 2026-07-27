import { AYAH_COUNTS } from './QuranData.js';

export const ValidationService = {
    validateForm(form) {
        // 1. Riwayah Check
        if (form.riwayahId !== 'hafs') throw new Error('UNSUPPORTED_RIWAYAH');

        // 2. Goal Type Check
        const validGoalTypes = ['FULL_QURAN', 'JUZ_RANGE', 'HIZB_RANGE', 'SURAH_RANGE', 'AYAH_RANGE'];
        if (!validGoalTypes.includes(form.goalType)) throw new Error('INVALID_GOAL_TYPE');

        // 3. Goal Range Checks
        if (form.goalType === 'JUZ_RANGE') {
            if (!Number.isInteger(form.startJuz) || form.startJuz < 1 || form.startJuz > 30) throw new Error('INVALID_JUZ_RANGE');
            if (!Number.isInteger(form.endJuz) || form.endJuz < 1 || form.endJuz > 30) throw new Error('INVALID_JUZ_RANGE');
            if (form.endJuz < form.startJuz) throw new Error('INVALID_JUZ_ORDER');
        }

        if (form.goalType === 'HIZB_RANGE') {
            if (!Number.isInteger(form.startHizb) || form.startHizb < 1 || form.startHizb > 60) throw new Error('INVALID_HIZB_RANGE');
            if (!Number.isInteger(form.endHizb) || form.endHizb < 1 || form.endHizb > 60) throw new Error('INVALID_HIZB_RANGE');
            if (form.endHizb < form.startHizb) throw new Error('INVALID_HIZB_ORDER');
        }

        if (form.goalType === 'SURAH_RANGE') {
            if (!Number.isInteger(form.startSurah) || form.startSurah < 1 || form.startSurah > 114) throw new Error('INVALID_SURAH_RANGE');
            if (!Number.isInteger(form.endSurah) || form.endSurah < 1 || form.endSurah > 114) throw new Error('INVALID_SURAH_RANGE');
            if (form.endSurah < form.startSurah) throw new Error('INVALID_SURAH_ORDER');
        }

        if (form.goalType === 'AYAH_RANGE') {
            this.validateAyah(form.startSurah, form.startAyah, 'START');
            this.validateAyah(form.endSurah, form.endAyah, 'END');
            if (form.endSurah < form.startSurah || (form.endSurah === form.startSurah && form.endAyah < form.startAyah)) {
                throw new Error('INVALID_AYAH_ORDER');
            }
        }

        // 4. Schedule Checks
        if (!Object.values(form.schedule).includes('mem')) throw new Error('NO_MEMORIZATION_DAYS');

        // 5. Amount Checks
        if (form.mode === 'amount') {
            if (!Number.isInteger(form.dailyAmount) || form.dailyAmount < 1) throw new Error('INVALID_DAILY_AMOUNT');
        }

        return true;
    },

    validateAyah(s, a, label) {
        if (!Number.isInteger(s) || s < 1 || s > 114) throw new Error(`INVALID_${label}_SURAH`);
        const maxAyahs = AYAH_COUNTS[s - 1];
        if (!Number.isInteger(a) || a < 1 || a > maxAyahs) throw new Error(`INVALID_${label}_AYAH`);
    }
};
