import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { SURAH_NAMES } from "./src/services/QuranData.js";
import { 
    DateService, 
    ValidationService, 
    QuranRangeService, 
    PlanGeneratorService, 
    ReschedulingService,
    ReviewSchedulerService,
    StorageService,
    ActivityService
} from "./src/services/index.js";

/**
 * وِرد - v9.5 SRS Edition
 * Integrated Spaced Repetition & Mastery Tracking.
 */

export default function App() {
    const [state, setState] = useState(null);
    const [ui, setUi] = useState({ tab: "home", snack: null });

    useEffect(() => {
        const saved = StorageService.load();
        setState(saved || { plan: null, units: [], streak: 0, lastActivity: null, logs: [] });
    }, []);

    useEffect(() => { if (state) StorageService.save(state); }, [state]);

    const handleAction = (type, payload, rating) => {
        try {
            const today = DateService.getLocalDate();
            if (type === 'COMPLETE_MEM') {
                const { streak, lastActivity } = ActivityService.recordActivity(state, today);
                const updatedTasks = state.plan.tasks.map(t => t.id === payload.id ? { ...t, status: 'COMPLETED' } : t);
                const newUnit = ReviewSchedulerService.createUnit(payload, rating, state.plan.id);
                setState({ ...state, plan: { ...state.plan, tasks: updatedTasks }, units: [...state.units, newUnit], streak, lastActivity });
            }
            if (type === 'COMPLETE_REV') {
                const { streak, lastActivity } = ActivityService.recordActivity(state, today);
                const { updatedUnit, log } = ReviewSchedulerService.processReview(payload, rating);
                const units = state.units.map(u => u.id === payload.id ? updatedUnit : u);
                setState({ ...state, units, logs: [...(state.logs || []), log], streak, lastActivity });
            }
            if (type === 'REDISTRIBUTE') {
                const intermediate = ReschedulingService.distributeRemaining(state);
                const newTasks = PlanGeneratorService.generate({...intermediate.plan, startDate: today}, {ayahs: intermediate._pendingAyahs});
                setState({ ...intermediate, plan: { ...intermediate.plan, tasks: [...intermediate.plan.tasks, ...newTasks] } });
            }
            if (type === 'SHIFT_TO_COMP') {
                setState(ReschedulingService.moveToCompensation(state, payload));
            }
        } catch (e) {
            setUi({ snack: e.message });
            setTimeout(() => setUi({ snack: null }), 3000);
        }
    };

    if (!state) return <div className="boot">تحميل v9.5...</div>;

    return (
        <div className="app" dir="rtl">
            <style>{CSS}</style>
            <header className="topbar">
                <div className="brand"><h1>وِرد</h1><small>v9.5 SRS Edition</small></div>
                <div className="badge"><b>{state.streak}</b><span>يوم</span></div>
            </header>
            <main className="content">
                {!state.plan ? (
                    <Wizard onComplete={(plan) => setState({ ...state, plan })} />
                ) : (
                    <Dashboard state={state} onAction={handleAction} onReset={() => { StorageService.reset(); location.reload(); }} />
                )}
            </main>
            {ui.snack && <div className="snack">{ui.snack}</div>}
        </div>
    );
}

function Dashboard({ state, onAction, onReset }) {
    const today = DateService.getLocalDate();
    const tasks = state.plan.tasks;
    
    const overdue = tasks.filter(t => t.date < today && t.status === 'PENDING' && t.type === 'NEW_MEMORIZATION');
    const todayMemTasks = tasks.filter(t => t.date === today && t.status === 'PENDING' && t.type === 'NEW_MEMORIZATION');
    const reviewDue = state.units.filter(u => u.nextReviewAt <= today);
    
    const completedAyahs = tasks.filter(t => t.status === 'COMPLETED').reduce((s, t) => s + (t.ayahCount || 0), 0);
    const progress = Math.round((completedAyahs / state.plan.totalAyahs) * 100);

    return (
        <div className="screen">
            <div className="card progress-card">
                <div className="p-head"><h3>إنجاز الختمة</h3><b>{progress}%</b></div>
                <div className="p-bar"><i style={{width: progress + '%'}}></i></div>
                <small>تم حفظ {completedAyahs} آية من {state.plan.totalAyahs}</small>
            </div>

            {overdue.length > 0 && (
                <div className="card overdue-card">
                    <div className="card-header"><h4>مهام متأخرة ({overdue.length}) ⚠️</h4></div>
                    {overdue.slice(0, 1).map(t => (
                        <TaskCard key={t.id} t={t} type="MEM" onDone={(r) => onAction('COMPLETE_MEM', t, r)} onShift={() => onAction('SHIFT_TO_COMP', t.id)} />
                    ))}
                    <button className="btn-text" onClick={() => onAction('REDISTRIBUTE')}>إعادة توزيع كل المتأخر</button>
                </div>
            )}

            <div className="task-list">
                {reviewDue.length > 0 && <div className="section">
                    <h4>مراجعة مستحقة ({reviewDue.length})</h4>
                    {reviewDue.map(u => <TaskCard key={u.id} t={u} type="REV" onDone={(r) => onAction('COMPLETE_REV', u, r)} />)}
                </div>}

                <div className="section">
                    <h4>حفظ اليوم</h4>
                    {todayMemTasks.length === 0 ? <div className="done-all">لا مهام حفظ متبقية اليوم ✨</div> : 
                        todayMemTasks.map(t => <TaskCard key={t.id} t={t} type="MEM" onDone={(r) => onAction('COMPLETE_MEM', t, r)} />)
                    }
                </div>
            </div>
            
            <button className="btn danger ghost" onClick={onReset}>إعادة البدء</button>
        </div>
    );
}

function TaskCard({ t, type, onDone, onShift }) {
    const [open, setOpen] = useState(false);
    const label = t.s1 === t.s2 ? `${SURAH_NAMES[t.s1-1]} (${t.a1}-${t.a2})` : `${SURAH_NAMES[t.s1-1]} إلى ${SURAH_NAMES[t.s2-1]}`;
    return (
        <div className={`task-card ${type}`}>
            <div className="t-head" onClick={()=>setOpen(!open)}>
                <div className="t-info"><b>{type==='MEM'?'حفظ جديد':'مراجعة'}</b><span>{label}</span></div>
                <div className="t-meta">{type==='REV' && <span className="mastery-dot" style={{opacity: t.masteryLevel/100}}></span>}</div>
            </div>
            {open && (
                <div className="t-actions">
                    <button className="r4" onClick={()=>onDone(4)}>ممتاز</button>
                    <button className="r3" onClick={()=>onDone(3)}>جيد</button>
                    <button className="r2" onClick={()=>onDone(2)}>ضعيف</button>
                    {onShift && <button className="r-shift" onClick={onShift}>تأجيل</button>}
                </div>
            )}
        </div>
    );
}

function Wizard({ onComplete }) {
    // Basic setup for v9.5 testing
    return (
        <div className="wizard card center">
            <h2>بدء خطة وِرد v9.5</h2>
            <button className="btn primary" onClick={() => {
                const today = DateService.getLocalDate();
                const form = { 
                    id: 'p-' + Date.now(),
                    riwayahId: 'hafs', goalType: 'JUZ_RANGE', startJuz: 30, endJuz: 30, 
                    startDate: today, targetEndDate: DateService.addDays(today, 10),
                    mode: 'amount', dailyAmount: 50, maxDailyAyahs: 100,
                    schedule: { 0:'mem', 1:'mem', 2:'mem', 3:'mem', 4:'mem', 5:'mem', 6:'comp' }
                };
                const range = QuranRangeService.resolveGoal(form);
                const tasks = PlanGeneratorService.generate(form, range);
                onComplete({ ...form, ...range, tasks });
            }}>إنشاء خطة اختبار SRS</button>
        </div>
    );
}

const CSS = `
    :root { --bg:#0E1726; --surface:#152139; --surface-2:#1D2E4B; --primary:#C9A227; --text:#EFE7D5; --text-dim:#A8AEBD; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:sans-serif; }
    .topbar { display:flex; justify-content:space-between; padding:20px; align-items:center; }
    .badge { background:var(--surface-2); padding:5px 15px; border-radius:15px; border:1px solid var(--primary); text-align:center; }
    .card { background:var(--surface); border-radius:24px; padding:20px; margin:15px; border:1px solid rgba(201,162,39,0.1); }
    .progress-card small { font-size:11px; color:var(--text-dim); }
    .p-bar { height:8px; background:var(--surface-2); border-radius:4px; overflow:hidden; margin:8px 0; }
    .p-bar i { display:block; height:100%; background:var(--primary); transition:0.4s; }
    .overdue-card { border-right:4px solid #B4574C; background:rgba(180, 87, 76, 0.05); }
    .section h4 { font-size:13px; color:var(--primary); margin:20px 15px 10px; }
    .task-card { background:var(--surface); border-radius:16px; margin:10px; overflow:hidden; border-right:4px solid var(--primary); }
    .task-card.REV { border-right-color: #5B8FC7; }
    .t-head { padding:15px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
    .t-info b { display:block; font-size:14px; } .t-info span { font-size:11px; color:var(--text-dim); }
    .t-actions { display:flex; gap:5px; padding:10px; background:rgba(0,0,0,0.2); }
    .t-actions button { flex:1; border:none; padding:10px; border-radius:8px; color:white; font-size:11px; cursor:pointer; }
    .r4 { background:#3F8F7E; } .r3 { background:#5B8FC7; } .r2 { background:#B4574C; } .r-shift { background:var(--surface-2); }
    .mastery-dot { width:8px; height:8px; background:var(--primary); border-radius:50%; }
    .btn { border:none; padding:12px 24px; border-radius:16px; font-weight:bold; cursor:pointer; }
    .btn.primary { background:var(--primary); color:black; }
    .btn.ghost { background:none; color:white; border:1px solid var(--surface-2); }
    .btn-text { background:none; border:none; color:var(--primary); font-size:11px; text-decoration:underline; cursor:pointer; margin-top:10px; }
    .done-all { text-align:center; padding:20px; font-size:13px; color:var(--text-dim); }
`;

const root = createRoot(document.getElementById('root'));
root.render(<App />);
