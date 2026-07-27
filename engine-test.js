import { DateService, QuranRangeService, PlanGeneratorService, ActivityService } from './src/services/index.js';

async function runTests() {
    console.log("🛠️ Wird User Testing Build v0.1 - Readiness Verification");
    const results = { passed: 0, failed: 0 };

    const assert = (cond, msg) => {
        if (cond) { console.log(`✅ [PASS]: ${msg}`); results.passed++; }
        else { console.error(`❌ [FAIL]: ${msg}`); results.failed++; }
    };

    // 1. Precise Calendar Month Arithmetic
    assert(DateService.addMonths('2026-01-31', 1) === '2026-02-28', "Jan 31 + 1 month correctly clips to Feb 28");
    
    // 2. Defensive Range Resolver
    try {
        QuranRangeService.resolveGoal({ goalType:'JUZ_RANGE', startJuz: 0, endJuz: 1 });
        assert(false, "Should have rejected Juz 0");
    } catch (e) {
        assert(e.message === 'INVALID_JUZ_RANGE', "Correctly rejected Juz 0");
    }

    // 3. Plan Integrity (Ayah-by-Ayah Sequence)
    const range = QuranRangeService.resolveGoal({ goalType:'JUZ_RANGE', startJuz: 30, endJuz: 30 });
    const p = { startDate:'2026-07-27', schedule:{1:'mem', 2:'mem', 3:'mem', 4:'mem', 5:'mem', 6:'mem', 0:'mem'}, mode:'amount', dailyAmount: 50 };
    const tasks = PlanGeneratorService.generate(p, range);
    assert(tasks.length > 0, "Plan generated successfully under integrity guard");

    // 4. Activity/Streak logic (Local Time Only)
    const mockState = { streak: 5, lastActivity: '2026-07-26' };
    const { streak: newStreak } = ActivityService.recordActivity(mockState, '2026-07-27');
    assert(newStreak === 6, "Streak increments on consecutive day activity");

    const { streak: sameDayStreak } = ActivityService.recordActivity({ streak: 6, lastActivity: '2026-07-27' }, '2026-07-27');
    assert(sameDayStreak === 6, "Streak does not increment twice on the same day");

    console.log(`\n📊 Test Summary: ${results.passed} Passed, ${results.failed} Failed.`);
    process.exit(results.failed > 0 ? 1 : 0);
}
runTests();
