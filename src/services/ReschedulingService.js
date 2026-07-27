import { DateService } from './DateService.js';
import { QuranRangeService } from './QuranRangeService.js';

export const ReschedulingService = {
    /**
     * Move a single overdue task to the next available compensation day.
     */
    moveToCompensation(state, taskId, options = {}) {
        const asOfDate = options.asOfDate || DateService.getLocalDate();
        const plan = state.plan;
        const task = plan.tasks.find(t => t.id === taskId);
        
        if (!task) throw new Error("TASK_NOT_FOUND");
        if (task.status === 'RESCHEDULED' || task.status === 'COMPLETED') throw new Error("TASK_NOT_RESCHEDULABLE");
        if (task.date >= asOfDate) throw new Error("TASK_NOT_OVERDUE");

        // Prevent duplicates
        const alreadyComp = plan.tasks.some(t => t.sourceTaskId === taskId && t.status === 'PENDING');
        if (alreadyComp) throw new Error("COMPENSATION_ALREADY_EXISTS");

        let searchDate = DateService.addDays(asOfDate, 1);
        let compDate = null;
        let safety = 0;
        
        while (!compDate && safety < 365) {
            const isCompDay = plan.schedule[DateService.getWeekday(searchDate)] === 'comp';
            const isBusy = plan.tasks.some(t => t.date === searchDate && (t.type === 'NEW_MEMORIZATION' || t.type === 'COMPENSATION') && t.status === 'PENDING');
            
            if (isCompDay && !isBusy) {
                compDate = searchDate;
            } else {
                searchDate = DateService.addDays(searchDate, 1);
            }
            safety++;
        }

        if (!compDate) throw new Error("NO_AVAILABLE_COMPENSATION_DAY");

        const newTask = {
            ...task,
            id: `c-${crypto.randomUUID ? crypto.randomUUID().slice(0,8) : Math.random().toString(36).slice(2,9)}`,
            date: compDate,
            type: 'COMPENSATION',
            status: 'PENDING',
            sourceTaskId: task.id
        };

        const updatedTasks = plan.tasks.map(t => t.id === taskId ? { ...t, status: 'RESCHEDULED' } : t);
        return { ...state, plan: { ...plan, tasks: [...updatedTasks, newTask] } };
    },

    /**
     * Rebuild the future plan starting from today.
     */
    distributeRemaining(state, options = {}) {
        const asOfDate = options.asOfDate || DateService.getLocalDate();
        const plan = state.plan;
        
        const pendingTasks = plan.tasks.filter(t => t.status === 'PENDING' && (t.type === 'NEW_MEMORIZATION' || t.type === 'COMPENSATION'));
        if (pendingTasks.length === 0) return state;

        // Collect and sort ayahs by Quranic order
        const ayahKey = a => `${a.s}:${a.a}`;
        const missingAyahs = pendingTasks
            .flatMap(t => QuranRangeService.getAyahsBetween(t.s1, t.a1, t.s2, t.a2))
            .sort((a, b) => QuranRangeService.getAyahOrdinal(a.s, a.a) - QuranRangeService.getAyahOrdinal(b.s, b.a));

        // Deduplicate
        const uniqueAyahs = [];
        const seen = new Set();
        for (const a of missingAyahs) {
            const key = ayahKey(a);
            if (!seen.has(key)) {
                seen.add(key);
                uniqueAyahs.push(a);
            }
        }

        const cleanedTasks = plan.tasks.map(t => 
            (t.status === 'PENDING' && (t.type === 'NEW_MEMORIZATION' || t.type === 'COMPENSATION'))
            ? { ...t, status: 'CANCELLED' } : t
        );

        // Import the generator here to avoid circular dependency
        // In a real app we'd split the logic further
        return { ...state, plan: { ...plan, tasks: [...cleanedTasks] }, _pendingAyahs: uniqueAyahs };
    }
};
