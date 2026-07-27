import { DateService } from './DateService.js';

export const ActivityService = {
    recordActivity(state, date = DateService.getLocalDate()) {
        const lastActivity = state.lastActivity;
        if (lastActivity === date) return { streak: state.streak, lastActivity };

        const yesterday = DateService.addDays(date, -1);
        const newStreak = (lastActivity === yesterday) ? state.streak + 1 : 1;

        return {
            streak: newStreak,
            lastActivity: date
        };
    }
};
