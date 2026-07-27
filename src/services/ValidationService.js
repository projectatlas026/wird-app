import { AYAH_COUNTS } from './QuranData.js';
import { DateService } from './DateService.js';

export const ValidationService = {
    validateForm(form) {
        if (form.riwayahId !== 'hafs') throw new Error('UNSUPPORTED_RIWAYAH');
        if (!['date', 'amount'].includes(form.mode)) throw new Error('INVALID_PLAN_MODE');

        // Context-aware validation
        switch (form.goalType) {
            case 'FULL_QURAN': break;
            case 'JUZ_RANGE':
                this.checkInt(form.startJuz, 1, 30, 'JUZ');
                this.checkInt(form.endJuz, 1, 30, 'JUZ');
                if (form.endJuz < form.startJuz) throw new Error('INVALID_JUZ_ORDER');
                break;
            case 'HIZB_RANGE':
                this.checkInt(form.startHizb, 1, 60, 'HIZB');
                this.checkInt(form.endHizb, 1, 60, 'HIZB');
                if (form.endHizb < form.startHizb) throw new Error('INVALID_HIZB_ORDER');
                break;
            case 'SURAH_RANGE':
                this.checkInt(form.startSurah, 1, 114, 'SURAH');
                this.checkInt(form.endSurah, 1, 114, 'SURAH');
                if (form.endSurah < form.startSurah) throw new Error('INVALID_SURAH_ORDER');
                break;
            case 'AYAH_RANGE':
                this.checkAyah(form.startSurah, form.startAyah, 'START');
                this.checkAyah(form.endSurah, form.endAyah, 'END');
                if (form.endSurah < form.startSurah || (form.endSurah === form.startSurah && form.endAyah < form.startAyah)) throw new Error('INVALID_AYAH_ORDER');
                break;
            default: throw new Error('INVALID_GOAL_TYPE');
        }

        if (!DateService.isValidDateString(form.startDate)) throw new Error('INVALID_START_DATE');
        
        if (form.mode === 'date') {
            if (!DateService.isValidDateString(form.targetEndDate)) throw new Error('INVALID_TARGET_END_DATE');
            if (DateService.diffDays(form.targetEndDate, form.startDate) < 0) throw new Error('END_DATE_BEFORE_START');
            this.checkInt(form.maxDailyAyahs, 1, 2000, 'MAX_DAILY_AYAHS');
        } else {
            this.checkInt(form.dailyAmount, 1, 2000, 'DAILY_AMOUNT');
        }

        if (!form.schedule || !Object.values(form.schedule).includes('mem')) {
            throw new Error('NO_MEMORIZATION_DAYS_IN_SCHEDULE');
        }

        return true;
    },

    checkInt(val, min, max, label) {
        if (!Number.isInteger(val)) throw new Error(`INVALID_${label}_VALUE_TYPE`);
        if (val < min || val > max) throw new Error(`OUT_OF_RANGE_${label}`);
    },

    checkAyah(s, a, label) {
        this.checkInt(s, 1, 114, `${label}_SURAH`);
        const max = AYAH_COUNTS[s - 1];
        this.checkInt(a, 1, max, `${label}_AYAH`);
    }
};
