import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { 
    SURAH_NAMES, 
    AYAH_COUNTS,
    DateService, 
    ValidationService, 
    QuranRangeService, 
    PlanGeneratorService, 
    PlanPreviewService,
    ActivityService,
    StorageService,
    ReschedulingService,
    DiagnosticService
} from "./src/services/index.js";

const BUILD_INFO = {
    version: "0.1.0",
    name: "User Testing Build v0.1",
    date: "2026-07-27",
    schema: 3,
    dataStatus: "UNVERIFIED"
};

const USER_ERROR_MESSAGES = {
    UNSUPPORTED_RIWAYAH: "هذه الرواية غير مدعومة حالياً.",
    INVALID_GOAL_TYPE: "يرجى اختيار نوع هدف صحيح.",
    INVALID_JUZ_RANGE: "نطاق الأجزاء المختار غير صحيح.",
    INVALID_HIZB_RANGE: "نطاق الأحزاب المختار غير صحيح.",
    INVALID_SURAH_RANGE: "نطاق السور المختار غير صحيح.",
    INVALID_AYAH_RANGE: "رقم الآية المختار غير موجود في هذه السورة.",
    INVALID_START_DATE: "يرجى اختيار تاريخ بداية صحيح.",
    INVALID_TARGET_END_DATE: "يرجى اختيار تاريخ انتهاء صحيح.",
    NO_MEMORIZATION_DAYS_IN_SCHEDULE: "يجب اختيار يوم حفظ واحد على الأقل.",
    REQUIRED_DAILY_AMOUNT_EXCEEDS_LIMIT: "المقدار اليومي المطلوب يتجاوز طاقتك المحددة.",
    TARGET_DATE_EXCEEDED_INCOMPLETE: "التاريخ المحدد لا يكفي لإكمال الحفظ.",
    INTEGRITY_SEQUENCE_MISMATCH: "خطأ في تسلسل الآيات الناتجة."
};

const GOAL_LABELS = {
    FULL_QURAN: "القرآن كاملًا",
    JUZ_RANGE: "أجزاء محددة",
    HIZB_RANGE: "أحزاب محددة",
    SURAH_RANGE: "سور محددة",
    AYAH_RANGE: "آيات محددة"
};

export default function App() {
    const [env, setEnv] = useState('test');
    const [state, setState] = useState(null);
    const [testDateOverride, setTestDateOverride] = useState(null);
    const [ui, setUi] = useState({ tab: "home", snack: null, feedback: null, showDiagnostics: false });

    const today = DateService.getLocalDate(testDateOverride);

    // Initial Load
    useEffect(() => {
        const saved = StorageService.load(env);
        setState(saved || { plan: null, units: [], streak: 0, lastActivity: null, logs: [] });
        DiagnosticService.log('APP_START', { env, build: BUILD_INFO.version });
    }, [env]);

    // Persistence
    useEffect(() => {
        if (state) StorageService.save(state, env);
    }, [state, env]);

    const toast = (m) => {
        setUi(prev => ({ ...prev, snack: m }));
        setTimeout(() => setUi(prev => ({ ...prev, snack: null })), 4000);
    };

    const handleAction = (type, payload, rating) => {
        try {
            if (type === 'COMPLETE_MEM') {
                const { streak, lastActivity } = ActivityService.recordActivity(state, today);
                const updatedTasks = state.plan.tasks.map(t => t.id === payload.id ? { ...t, status: 'COMPLETED' } : t);
                const newUnit = { ...payload, id: `u-${Date.now()}`, memorizedAt: today, nextReviewAt: DateService.addDays(today, 3) };
                setState({ ...state, plan: { ...state.plan, tasks: updatedTasks }, units: [...state.units, newUnit], streak, lastActivity });
                toast("تم تسجيل الإنجاز");
            }
            if (type === 'SHIFT_TO_COMP') {
                setState(ReschedulingService.moveToCompensation(state, payload, { asOfDate: today }));
            }
            if (type === 'REDISTRIBUTE') {
                const intermediate = ReschedulingService.distributeRemaining(state, { asOfDate: today });
                const newTasks = PlanGeneratorService.generate({...intermediate.plan, startDate: today}, {ayahs: intermediate._pendingAyahs});
                setState({ ...intermediate, plan: { ...intermediate.plan, tasks: [...intermediate.plan.tasks, ...newTasks] } });
            }
        } catch (e) {
            DiagnosticService.log('ACTION_ERROR', { error: e.message });
            toast(USER_ERROR_MESSAGES[e.message] || e.message);
        }
    };

    if (!state) return <div className="boot">تحميل وِرد...</div>;

    return (
        <div className={`app ${env}-mode`} dir="rtl">
            <style>{CSS}</style>
            
            {env === 'test' && <div className="test-banner">وضع الاختبار نشط (التاريخ: {DateService.formatArabic(today)})</div>}
            
            <header className="topbar">
                <div className="brand"><h1>وِرد</h1><small>{BUILD_INFO.version}</small></div>
                <div className="top-right">
                    <button className="btn-icon" onClick={() => setUi({...ui, tab: ui.tab === 'settings' ? 'home' : 'settings'})}>⚙️</button>
                    <div className="badge"><b>{state.streak}</b><span>يوم</span></div>
                </div>
            </header>

            <main className="content">
                {ui.tab === 'settings' ? (
                    <Settings state={state} env={env} setEnv={setEnv} today={today} onJumpDay={() => setTestDateOverride(DateService.addDays(today, 1))} onReset={() => { StorageService.reset(env); location.reload(); }} showLogs={() => setUi({...ui, showDiagnostics: true})} />
                ) : !state.plan ? (
                    <Wizard onComplete={(p) => setState({ ...state, plan: p })} toast={toast} />
                ) : (
                    <Dashboard state={state} today={today} onAction={handleAction} />
                )}
            </main>

            <button className="feedback-fab" onClick={() => setUi({...ui, feedback: { page: ui.tab }})}>إرسال ملاحظة</button>
            
            {ui.snack && <div className="snack">{ui.snack}</div>}
            {ui.feedback && <FeedbackModal onClose={() => setUi({...ui, feedback: null})} report={ui.feedback} />}
            {ui.showDiagnostics && <DiagnosticsModal logs={DiagnosticService.getLogs()} onClose={() => setUi({...ui, showDiagnostics: false})} />}
        </div>
    );
}

/* ─────────────── UI: Wizard (Full) ─────────────── */
function Wizard({ onComplete, toast }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        riwayahId: 'hafs', goalType: 'JUZ_RANGE',
        startJuz: 30, endJuz: 30, startHizb: 60, endHizb: 60,
        startSurah: 78, startAyah: 1, endSurah: 114, endAyah: 6,
        startDate: DateService.getLocalDate(),
        targetEndDate: DateService.addMonths(DateService.getLocalDate(), 1),
        mode: 'date', dailyAmount: 5, maxDailyAyahs: 20,
        schedule: { 0: 'rev', 1: 'mem', 2: 'mem', 3: 'mem', 4: 'mem', 5: 'mem', 6: 'comp' }
    });

    const preview = useMemo(() => PlanPreviewService.calculate(form), [form]);

    const handleGenerate = () => {
        try {
            ValidationService.validateForm(form);
            const range = QuranRangeService.resolveGoal(form);
            const tasks = PlanGeneratorService.generate(form, range);
            onComplete({ ...form, ...range, tasks });
        } catch (e) {
            toast(USER_ERROR_MESSAGES[e.message] || e.message);
        }
    };

    return (
        <div className="wizard card">
            <div className="wizard-progress"><i style={{width: (step/6)*100 + '%'}}></i></div>
            <div className="wizard-body">
                {step === 1 && <StepRiwayah />}
                {step === 2 && <StepGoalType form={form} setForm={setForm} />}
                {step === 3 && <StepRange form={form} setForm={setForm} preview={preview} />}
                {step === 4 && <StepPace form={form} setForm={setForm} preview={preview} />}
                {step === 5 && <StepSchedule form={form} setForm={setForm} preview={preview} />}
                {step === 6 && <StepPreview form={form} preview={preview} onEdit={setStep} />}
            </div>
            <div className="wizard-footer">
                {step > 1 && <button className="btn ghost" onClick={() => setStep(s => s - 1)}>السابق</button>}
                <button className="btn primary" onClick={step < 6 ? () => setStep(s => s + 1) : handleGenerate}>
                    {step === 6 ? "توليد الخطة" : "التالي"}
                </button>
            </div>
        </div>
    );
}

/* --- Wizard Steps --- */
function StepRiwayah() {
    return <div className="step"><h3>اختيار الرواية</h3><button className="opt-card on"><b>حفص عن عاصم</b><small>مصحف المدينة</small></button></div>;
}

function StepGoalType({ form, setForm }) {
    const goals = [{ id: 'FULL_QURAN', n: 'القرآن كاملاً', icon: '📖' }, { id: 'JUZ_RANGE', n: 'أجزاء', icon: '📑' }, { id: 'HIZB_RANGE', n: 'أحزاب', icon: '🔖' }, { id: 'SURAH_RANGE', n: 'سور', icon: '📜' }, { id: 'AYAH_RANGE', n: 'آيات', icon: '🔍' }];
    return <div className="step"><h3>ماذا تريد أن تحفظ؟</h3><div className="grid-2">{goals.map(g => (<button key={g.id} className={`opt-box ${form.goalType === g.id ? 'on' : ''}`} onClick={() => setForm({...form, goalType: g.id})}><span>{g.icon}</span><b>{g.n}</b></button>))}</div></div>;
}

function StepRange({ form, setForm, preview }) {
    const update = (patch) => {
        setForm(f => {
            const next = { ...f, ...patch };
            if (next.endSurah < next.startSurah) next.endSurah = next.startSurah;
            if (next.endSurah === next.startSurah && next.endAyah < next.startAyah) next.endAyah = next.startAyah;
            return next;
        });
    };
    return (
        <div className="step">
            <h3>تحديد النطاق</h3>
            {form.goalType === 'JUZ_RANGE' && <div className="row-column">
                <select value={form.startJuz} onChange={e => update({startJuz: +e.target.value, endJuz: Math.max(form.endJuz, +e.target.value)})}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>الجزء {i+1}</option>)}</select>
                <select value={form.endJuz} onChange={e => update({endJuz: +e.target.value})}>{Array.from({length:31 - form.startJuz},(_,i)=><option key={i+form.startJuz} value={i+form.startJuz}>إلى {i+form.startJuz}</option>)}</select>
            </div>}
            {form.goalType === 'HIZB_RANGE' && <div className="row-column">
                <select value={form.startHizb} onChange={e => update({startHizb: +e.target.value, endHizb: Math.max(form.endHizb, +e.target.value)})}>{Array.from({length:60},(_,i)=><option key={i+1} value={i+1}>الحزب {i+1}</option>)}</select>
                <select value={form.endHizb} onChange={e => update({endHizb: +e.target.value})}>{Array.from({length:61 - form.startHizb},(_,i)=><option key={i+form.startHizb} value={i+form.startHizb}>إلى {i+form.startHizb}</option>)}</select>
            </div>}
            {form.goalType === 'SURAH_RANGE' && <div className="row-column">
                <select value={form.startSurah} onChange={e => update({startSurah: +e.target.value, endSurah: Math.max(form.endSurah, +e.target.value)})}>{SURAH_NAMES.map((s,i)=><option key={i+1} value={i+1}>سورة {s}</option>)}</select>
                <select value={form.endSurah} onChange={e => update({endSurah: +e.target.value})}>{SURAH_NAMES.slice(form.startSurah-1).map((s,i)=><option key={i+form.startSurah} value={i+form.startSurah}>إلى {s}</option>)}</select>
            </div>}
            {form.goalType === 'AYAH_RANGE' && <div className="column-gap">
                <div className="row-column">
                    <select value={form.startSurah} onChange={e => update({startSurah: +e.target.value, startAyah: 1})}>{SURAH_NAMES.map((s,i)=><option key={i+1} value={i+1}>{s}</option>)}</select>
                    <select value={form.startAyah} onChange={e => update({startAyah: +e.target.value})}>{Array.from({length: AYAH_COUNTS[form.startSurah-1]}, (_,i)=><option key={i+1} value={i+1}>آية {i+1}</option>)}</select>
                </div>
                <div className="row-column">
                    <select value={form.endSurah} onChange={e => update({endSurah: +e.target.value, endAyah: 1})}>{SURAH_NAMES.slice(form.startSurah-1).map((s,i)=><option key={i+form.startSurah} value={i+form.startSurah}>{s}</option>)}</select>
                    <select value={form.endAyah} onChange={e => update({endAyah: +e.target.value})}>{Array.from({length: AYAH_COUNTS[form.endSurah-1]}, (_,i)=>((form.startSurah === form.endSurah && i+1 < form.startAyah) ? null : <option key={i+1} value={i+1}>آية {i+1}</option>))}</select>
                </div>
            </div>}
            <div className="info-bar">إجمالي: {preview.totalAyahs} آية</div>
        </div>
    );
}

function StepPace({ form, setForm, preview }) {
    const isDate = form.mode === 'date';
    const update = (patch) => setForm(f => ({ ...f, ...patch }));
    return (
        <div className="step">
            <h3>وتيرة الحفظ</h3>
            <div className="mode-toggle"><button className={isDate?'on':''} onClick={()=>update({mode:'date'})}>بتاريخ انتهاء</button><button className={!isDate?'on':''} onClick={()=>update({mode:'amount'})}>بمقدار ثابت</button></div>
            <div className="inputs-group">
                <label>تاريخ البدء</label><input type="date" value={form.startDate} onChange={e => update({startDate: e.target.value})} />
                {isDate ? (<><label>تاريخ الانتهاء</label><input type="date" min={form.startDate} value={form.targetEndDate} onChange={e => update({targetEndDate: e.target.value})} /><div className="date-presets">{[1, 3, 6].map(m => <button key={m} onClick={()=>update({targetEndDate: DateService.addMonths(form.startDate, m)})}>بعد {m} أشهر</button>)}</div><label>أقصى قدرة (آية/يوم)</label><div className="counter"><button onClick={()=>update({maxDailyAyahs: Math.max(1, form.maxDailyAyahs-1)})}>−</button><b>{form.maxDailyAyahs}</b><button onClick={()=>update({maxDailyAyahs: form.maxDailyAyahs+1})}>+</button></div></>) : (<><label>المقدار اليومي</label><div className="counter"><button onClick={()=>update({dailyAmount: Math.max(1, form.dailyAmount-1)})}>−</button><b>{form.dailyAmount}</b><button onClick={()=>update({dailyAmount: form.dailyAmount+1})}>+</button></div></>)}
                {preview.valid && <div className={`live-hint ${preview.isHeavy?'err':''}`}>{isDate ? (preview.isHeavy ? `تحتاج لـ ${preview.requiredDaily} آية/يوم. مدد لـ ${DateService.formatArabic(preview.suggestedEndDate)}` : `تحتاج لـ ${preview.requiredDaily} آية يومياً.`) : `الانتهاء المتوقع: ${DateService.formatArabic(preview.estimatedEndDate)}`}</div>}
            </div>
        </div>
    );
}

function StepSchedule({ form, setForm, preview }) {
    const days = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
    const states = { mem: 'حفظ', rev: 'مراجعة', comp: 'تعويض', rest: 'راحة' };
    return (
        <div className="step">
            <h3>جدول الأسبوع</h3>
            <div className="schedule-box">{days.map((d, i) => (<div key={i} className="sched-row"><span>{d}</span><div className="btns-grp">{Object.entries(states).map(([k, v]) => (<button key={k} className={`${k} ${form.schedule[i] === k ? 'on' : ''}`} onClick={() => setForm({...form, schedule: {...form.schedule, [i]: k}})}>{v}</button>))}</div></div>))}</div>
        </div>
    );
}

function StepPreview({ form, preview, onEdit }) {
    const desc = QuranRangeService.getGoalArabicDescription(form);
    return (
        <div className="step preview-final">
            <h3>معاينة الخطة</h3>
            <div className="p-card">
                <div className="p-row"><span>الهدف:</span> <b>{desc}</b><button onClick={()=>onEdit(2)}>تعديل</button></div>
                <div className="p-row"><span>النطاق:</span> <b>{preview.totalAyahs} آية</b></div>
                <div className="p-row"><span>البداية:</span> <b>{DateService.formatArabic(form.startDate)}</b></div>
                <div className="p-row"><span>النهاية:</span> <b>{DateService.formatArabic(form.mode==='date'?form.targetEndDate:preview.estimatedEndDate)}</b><button onClick={()=>onEdit(4)}>تعديل</button></div>
            </div>
        </div>
    );
}

/* ─────────────── Dashboard ─────────────── */
function Dashboard({ state, today, onAction }) {
    const overdue = state.plan.tasks.filter(t => t.date < today && t.status === 'PENDING' && t.type === 'NEW_MEMORIZATION');
    const todayTasks = state.plan.tasks.filter(t => t.date === today && t.status === 'PENDING');
    const completed = state.plan.tasks.filter(t => t.status === 'COMPLETED').reduce((s,t)=>s+(t.ayahCount||0), 0);
    const progress = Math.round((completed / state.plan.totalAyahs) * 100);

    return (
        <div className="dashboard screen">
            <div className="card progress-card">
                <div className="p-info"><h3>إنجاز الختمة</h3><b>{progress}%</b></div>
                <div className="p-bar"><i style={{width: progress+'%'}}></i></div>
                <small>حفظ {completed} من {state.plan.totalAyahs} آية</small>
            </div>
            {overdue.length > 0 && (
                <div className="card overdue-card">
                    <h4>متأخرة ({overdue.length}) ⚠️</h4>
                    {overdue.slice(0,1).map(t => (
                        <div key={t.id} className="overdue-item">
                            <span>{SURAH_NAMES[t.s1-1]} ({t.a1}-{t.a2})</span>
                            <div className="actions">
                                <button onClick={()=>onAction('COMPLETE_MEM', t, 4)}>تم الآن</button>
                                <button onClick={()=>onAction('SHIFT_TO_COMP', t.id)}>يوم تعويض</button>
                            </div>
                        </div>
                    ))}
                    <button className="btn-text" onClick={()=>onAction('REDISTRIBUTE')}>إعادة توزيع المتبقي</button>
                </div>
            )}
            <div className="task-list">
                <h4>مهام اليوم</h4>
                {todayTasks.length === 0 ? <div className="done-all">أتممت مهام اليوم! ✨</div> : todayTasks.map(t => (
                    <div key={t.id} className="task-card">
                        <div className="t-main"><b>حفظ جديد</b><span>{SURAH_NAMES[t.s1-1]} ({t.a1}) إلى {t.s1===t.s2 ? t.a2 : `${SURAH_NAMES[t.s2-1]} (${t.a2})`}</span></div>
                        <button className="btn-done" onClick={() => onAction('COMPLETE_MEM', t, 4)}>تم</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─────────────── Shared UI components (Settings, Modals, CSS) ─────────────── */
function Settings({ env, setEnv, today, onJumpDay, onReset, showLogs }) {
    return (
        <div className="screen settings">
            <section className="card"><h3>إعدادات الاختبار</h3>
                <button className="btn ghost" onClick={()=>setEnv(env==='test'?'production':'test')}>البيئة: {env}</button>
                <button className="btn ghost" onClick={onJumpDay}>⏩ تقديم التاريخ يوماً</button>
                <button className="btn ghost danger" onClick={onReset}>🧹 تصفير بيانات الاختبار</button>
                <button className="btn ghost" onClick={showLogs}>📋 سجل التشخيص</button>
            </section>
        </div>
    );
}

function FeedbackModal({ onClose, report }) {
    const [desc, setDesc] = useState("");
    const finalReport = `إصدار: v0.1\nالصفحة: ${report.page}\nالملاحظة: ${desc}\nالوقت: ${new Date().toLocaleString()}`;
    return (<div className="modal-overlay"><div className="modal card"><h3>إرسال ملاحظة</h3><textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="صف المشكلة..."></textarea><div className="modal-footer"><button className="btn ghost" onClick={onClose}>إلغاء</button><button className="btn primary" onClick={() => { navigator.clipboard.writeText(finalReport); alert("تم النسخ."); onClose(); }}>نسخ وإغلاق</button></div></div></div>);
}

function DiagnosticsModal({ logs, onClose }) {
    return (<div className="modal-overlay"><div className="modal card wide"><h3>سجل التشخيص</h3><pre className="diagnostic-log">{JSON.stringify(logs, null, 2)}</pre><button className="btn primary" onClick={onClose}>إغلاق</button></div></div>);
}

const CSS = `
    :root { --bg:#0E1726; --surface:#152139; --surface-2:#1D2E4B; --primary:#C9A227; --text:#EFE7D5; --text-dim:#A8AEBD; --mem:#3F8F7E; --rev:#5B8FC7; --comp:#D9A441; --rest:#3B4554; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:sans-serif; -webkit-tap-highlight-color: transparent; }
    .app { max-width:500px; margin:0 auto; min-height:100vh; }
    .test-banner { background:#D9A441; color:black; text-align:center; padding:5px; font-size:11px; font-weight:bold; }
    .topbar { display:flex; justify-content:space-between; padding:20px; align-items:center; }
    .badge { background:var(--surface-2); padding:5px 15px; border-radius:15px; border:1px solid var(--primary); text-align:center; }
    .card { background:var(--surface); border-radius:24px; padding:20px; margin:10px; border:1px solid rgba(255,255,255,0.05); }
    .wizard-progress { height:4px; background:var(--surface-2); border-radius:2px; margin-bottom:10px; overflow:hidden; }
    .wizard-progress i { display:block; height:100%; background:var(--primary); transition:0.3s; }
    .step-title { font-size:12px; color:var(--primary); text-align:center; margin-bottom:15px; outline:none; }
    .opt-card { width:100%; text-align:right; background:var(--surface-2); padding:15px; border-radius:16px; margin-bottom:10px; border:1px solid transparent; color:white; }
    .opt-card.on { border-color:var(--primary); background:rgba(201,162,39,0.1); }
    .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .opt-box { background:var(--surface-2); border:2px solid transparent; color:white; padding:20px; border-radius:20px; display:flex; flex-direction:column; align-items:center; gap:10px; cursor:pointer; }
    .opt-box.on { border-color:var(--primary); background:rgba(201,162,39,0.1); }
    .row-column { display:flex; gap:10px; margin-bottom:10px; }
    select, input, textarea { width:100%; background:var(--bg); color:white; padding:12px; border:1px solid var(--surface-2); border-radius:12px; font-size:15px; box-sizing: border-box; }
    .mode-toggle { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px; }
    .mode-toggle button { background:var(--surface-2); border:1px solid transparent; color:white; padding:15px; border-radius:16px; cursor:pointer; }
    .mode-toggle button.on { border-color:var(--primary); background:rgba(201,162,39,0.1); }
    .counter { display:flex; justify-content:center; align-items:center; gap:20px; background:var(--bg); padding:10px; border-radius:16px; margin-bottom:10px; }
    .counter button { width:40px; height:40px; border-radius:50%; border:none; background:var(--surface-2); color:white; font-size:20px; }
    .sched-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--surface-2); }
    .btns-grp { display:flex; background:var(--bg); padding:3px; border-radius:10px; gap:2px; }
    .btns-grp button { padding:6px 10px; border-radius:8px; border:none; color:white; font-size:11px; opacity:0.3; cursor:pointer; }
    .btns-grp button.on { opacity:1; }
    .btns-grp button.mem.on { background:var(--mem); }
    .btns-grp button.rev.on { background:var(--rev); }
    .btns-grp button.comp.on { background:var(--comp); color:black; }
    .live-hint { font-size:12px; margin-top:10px; text-align:center; color:var(--primary); }
    .live-hint.err { color:#B4574C; }
    .p-card { background:var(--surface-2); padding:15px; border-radius:16px; }
    .p-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed rgba(255,255,255,0.1); font-size:13px; }
    .p-row button { color:var(--primary); background:none; border:none; text-decoration:underline; cursor:pointer; font-size:11px; }
    .wizard-footer { display:flex; justify-content:space-between; padding:20px; position:sticky; bottom:0; background:var(--bg); }
    .btn { border:none; padding:14px 28px; border-radius:16px; font-weight:bold; cursor:pointer; font-size:16px; }
    .btn.primary { background:var(--primary); color:black; }
    .btn.ghost { background:none; color:white; border:1px solid var(--surface-2); }
    .btn-done { background:var(--primary); border:none; padding:8px 20px; border-radius:10px; font-weight:bold; cursor:pointer; }
    .btn-text { background:none; border:none; color:var(--primary); text-decoration:underline; font-size:11px; margin-top:10px; cursor:pointer; }
    .task-card { background:var(--surface); padding:18px; border-radius:24px; margin:10px; display:flex; justify-content:space-between; align-items:center; border-right:4px solid var(--primary); }
    .overdue-card { border-right-color:#B4574C; background:rgba(180, 87, 76, 0.05); }
    .overdue-item .actions { display:flex; gap:5px; margin-top:10px; }
    .overdue-item .actions button { flex:1; background:var(--surface-2); color:white; border:1px solid var(--primary); padding:8px; border-radius:10px; font-size:11px; }
    .fab-feedback { position:fixed; bottom:20px; left:20px; background:var(--primary); color:black; border:none; padding:10px 20px; border-radius:30px; font-weight:bold; z-index:100; box-shadow:0 4px 12px rgba(0,0,0,0.4); }
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:1000; padding:20px; }
    .diagnostic-log { background:black; color:#0f0; padding:10px; border-radius:10px; max-height:300px; overflow:auto; font-size:10px; text-align:left; direction:ltr; }
    .step-err-inline { color:#B4574C; font-size:12px; text-align:center; margin:10px 0; }
    .date-presets { display:flex; gap:5px; margin:10px 0; overflow-x:auto; padding-bottom:5px; }
    .date-presets button { font-size:11px; background:var(--surface-2); color:white; border:none; padding:8px 12px; border-radius:10px; white-space:nowrap; cursor:pointer; }

    @media (max-width: 480px) {
        .row-column { flex-direction: column; }
        .sched-row { flex-direction: column; align-items: stretch; gap:10px; }
        .btns-grp { display: grid; grid-template-columns: 1fr 1fr; }
    }
`;

const root = createRoot(document.getElementById('root'));
root.render(<App />);
