import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   وِرد v7 — المحرك الاحترافي (The Pro Engine)
   حلول جذرية للحسابات الزمنية، المراجعة المتباعدة، ودعم الأرباع
   ══════════════════════════════════════════════════════════════ */

/* ─────────────── DATA: حدود القرآن الشاملة ─────────────── */
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

const JUZ_STARTS = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
const HIZB_STARTS = [[1,1],[2,75],[2,142],[2,203],[2,253],[3,15],[3,93],[3,171],[4,24],[4,88],[4,148],[5,27],[5,82],[6,36],[6,111],[7,1],[7,88],[7,171],[8,41],[9,34],[9,93],[10,26],[11,6],[11,84],[12,53],[13,19],[15,1],[16,51],[17,1],[17,100],[18,75],[19,59],[21,1],[22,38],[23,1],[24,21],[25,21],[26,111],[27,56],[29,1],[29,46],[31,22],[33,31],[34,24],[36,28],[38,21],[39,32],[40,41],[41,47],[43,24],[46,1],[48,18],[51,31],[54,9],[58,1],[61,1],[67,1],[72,1],[78,1],[87,1]];

/* ─────────────── UTILS: الزمن والحساب ─────────────── */
const ar = (n) => String(n);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (s, n) => new Date((Math.floor(Date.parse(s + "T00:00:00Z") / 86400000) + n) * 86400000).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.floor((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
const WEEKDAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const weekdayOf = (ds) => new Date(ds + "T00:00:00Z").getUTCDay();

/* ─────────────── SERVICE: QuranGoalResolutionService ─────────────── */
const QuranGoalResolutionService = {
    getAyahRange(s1, a1, s2, a2) {
        const ranges = [];
        for (let s = s1; s <= s2; s++) {
            const first = (s === s1) ? a1 : 1;
            const last = (s === s2) ? a2 : AYAH_COUNTS[s - 1];
            for (let a = first; a <= last; a++) ranges.push({ s, a });
        }
        return ranges;
    },
    resolve(form) {
        let s1, a1, s2, a2;
        if (form.goalType === 'FULL_QURAN') [s1, a1, s2, a2] = [1, 1, 114, 6];
        else if (form.goalType === 'JUZ_RANGE') {
            [s1, a1] = JUZ_STARTS[form.startJuz - 1];
            const end = form.endJuz === 30 ? [114, 7] : JUZ_STARTS[form.endJuz];
            [s2, a2] = this.getPrev(end[0], end[1]);
        } else if (form.goalType === 'HIZB_RANGE') {
            [s1, a1] = HIZB_STARTS[form.startHizb - 1];
            const end = form.endHizb === 60 ? [114, 7] : HIZB_STARTS[form.endHizb];
            [s2, a2] = this.getPrev(end[0], end[1]);
        } else {
            [s1, a1, s2, a2] = [form.startSurah, form.startAyah, form.endSurah, form.endAyah];
        }
        return { s1, a1, s2, a2 };
    },
    getPrev(s, a) {
        if (a > 1) return [s, a - 1];
        return [s - 1, AYAH_COUNTS[s - 2]];
    }
};

/* ─────────────── SERVICE: PlanGenerator ─────────────── */
function generatePlan(p, ayahRanges) {
    const tasks = [];
    let ayahIdx = 0;
    let curDate = p.startDate;
    const total = ayahRanges.length;

    // حساب عدد أيام العمل الفعلية بين البداية والنهاية
    const countWorkDays = (start, end, schedule) => {
        let count = 0;
        let d = start;
        while (diffDays(end, d) >= 0) {
            if (schedule[weekdayOf(d)] === 'mem') count++;
            d = addDays(d, 1);
        }
        return count;
    };

    const workDaysTotal = (p.mode === 'date') ? countWorkDays(p.startDate, p.targetEndDate, p.schedule) : 0;
    let workDayCounter = 0;

    while (ayahIdx < total && tasks.length < 2000) {
        const dayType = p.schedule[weekdayOf(curDate)];
        const id = Math.random().toString(36).slice(2, 9);

        if (dayType === 'mem') {
            workDayCounter++;
            let amt = p.dailyAmount;
            if (p.mode === 'date') {
                const remainingWorkDays = Math.max(1, workDaysTotal - workDayCounter + 1);
                amt = Math.ceil((total - ayahIdx) / remainingWorkDays);
            }
            const st = ayahRanges[ayahIdx];
            const enIdx = Math.min(total - 1, ayahIdx + amt - 1);
            const en = ayahRanges[enIdx];
            tasks.push({ id, date: curDate, type: 'MEM', s1: st.s, a1: st.a, s2: en.s, a2: en.a, status: 'PENDING' });
            ayahIdx = enIdx + 1;
        } else if (dayType === 'rev') {
            tasks.push({ id, date: curDate, type: 'REV', status: 'PENDING' });
        } else if (dayType === 'comp') {
            tasks.push({ id, date: curDate, type: 'COMP', status: 'PENDING' });
        }
        curDate = addDays(curDate, 1);
    }
    return tasks;
}

/* ═════════════════════════ UI: المعالج المطور ═════════════════════════ */
function Wizard({ onComplete }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        goalType: 'JUZ_RANGE', startJuz: 30, endJuz: 30, startHizb: 59, endHizb: 60,
        startSurah: 78, startAyah: 1, endSurah: 114, endAyah: 6,
        startDate: today(), targetEndDate: addDays(today(), 30), dailyAmount: 5, mode: 'date',
        schedule: { 0: 'rev', 1: 'mem', 2: 'mem', 3: 'mem', 4: 'mem', 5: 'mem', 6: 'comp' }
    });

    const error = useMemo(() => {
        if (step === 2) {
            if (form.goalType === 'JUZ_RANGE' && form.endJuz < form.startJuz) return "نهاية الجزء تسبق بدايته";
            if (form.goalType === 'HIZB_RANGE' && form.endHizb < form.startHizb) return "نهاية الحزب تسبق بدايته";
            const maxAyahStart = AYAH_COUNTS[form.startSurah - 1];
            const maxAyahEnd = AYAH_COUNTS[form.endSurah - 1];
            if (form.startAyah < 1 || form.startAyah > maxAyahStart) return `آية البداية غير صحيحة (1-${maxAyahStart})`;
            if (form.endAyah < 1 || form.endAyah > maxAyahEnd) return `آية النهاية غير صحيحة (1-${maxAyahEnd})`;
            if (form.endSurah < form.startSurah || (form.endSurah === form.startSurah && form.endAyah < form.startAyah)) return "نهاية النطاق تسبق بدايته";
        }
        if (step === 3 && form.mode === 'date' && diffDays(form.targetEndDate, form.startDate) <= 0) return "تاريخ الانتهاء يجب أن يكون بعد البداية";
        return null;
    }, [step, form]);

    return (
        <div className="wizard card">
            <div className="wizard-header"><h2>الخطوة {ar(step)} من 4</h2></div>
            <div className="wizard-body">
                {step === 1 && <div className="step-content">
                    <h3>اختر نوع الهدف</h3>
                    {['FULL_QURAN','JUZ_RANGE','HIZB_RANGE','AYAH_RANGE'].map(t => (
                        <button key={t} className={form.goalType===t?'opt on':'opt'} onClick={()=>setForm({...form, goalType:t})}>
                            {t==='FULL_QURAN'?'القرآن كاملاً':t==='JUZ_RANGE'?'بالأجزاء':t==='HIZB_RANGE'?'بالأحزاب':'نطاق آيات'}
                        </button>
                    ))}
                </div>}
                {step === 2 && <div className="step-content">
                    <h3>تحديد النطاق</h3>
                    {form.goalType==='JUZ_RANGE' && <div className="row"><select value={form.startJuz} onChange={e=>setForm({...form, startJuz:+e.target.value})}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>من جزء {ar(i+1)}</option>)}</select><select value={form.endJuz} onChange={e=>setForm({...form, endJuz:+e.target.value})}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>إلى جزء {ar(i+1)}</option>)}</select></div>}
                    {form.goalType==='HIZB_RANGE' && <div className="row"><select value={form.startHizb} onChange={e=>setForm({...form, startHizb:+e.target.value})}>{Array.from({length:60},(_,i)=><option key={i+1} value={i+1}>من حزب {ar(i+1)}</option>)}</select><select value={form.endHizb} onChange={e=>setForm({...form, endHizb:+e.target.value})}>{Array.from({length:60},(_,i)=><option key={i+1} value={i+1}>إلى حزب {ar(i+1)}</option>)}</select></div>}
                    {form.goalType==='AYAH_RANGE' && <>
                        <div className="row"><select value={form.startSurah} onChange={e=>setForm({...form, startSurah:+e.target.value})}>{SURAH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select><input type="number" value={form.startAyah} onChange={e=>setForm({...form, startAyah:+e.target.value})} /></div>
                        <div className="row"><select value={form.endSurah} onChange={e=>setForm({...form, endSurah:+e.target.value})}>{SURAH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select><input type="number" value={form.endAyah} onChange={e=>setForm({...form, endAyah:+e.target.value})} /></div>
                    </>}
                </div>}
                {step === 3 && <div className="step-content">
                    <h3>الجدول والمدة</h3>
                    <div className="row"><span>تاريخ البدء:</span><input type="date" value={form.startDate} onChange={e=>setForm({...form, startDate:e.target.value})} /></div>
                    <div className="seg-control"><button className={form.mode==='date'?'on':''} onClick={()=>setForm({...form, mode:'date'})}>تاريخ انتهاء</button><button className={form.mode==='amount'?'on':''} onClick={()=>setForm({...form, mode:'amount'})}>مقدار ثابت</button></div>
                    {form.mode==='date'?<input type="date" value={form.targetEndDate} onChange={e=>setForm({...form, targetEndDate:e.target.value})} /> : <input type="number" value={form.dailyAmount} onChange={e=>setForm({...form, dailyAmount:+e.target.value})} />}
                    <div className="schedule-grid">
                        {WEEKDAYS.map((d,i)=><button key={i} className={`day-btn ${form.schedule[i]}`} onClick={()=>{
                            const next = {mem:'rev', rev:'rest', rest:'mem'}[form.schedule[i]];
                            setForm({...form, schedule:{...form.schedule,[i]:next}});
                        }}>{d.slice(0,1)}</button>)}
                    </div>
                </div>}
                {step === 4 && <div className="step-content"><p>جاهز لإنشاء الخطة؟ سيتم توزيع الحفظ على أيام العمل فقط.</p></div>}
                {error && <div className="error">{error}</div>}
            </div>
            <div className="wizard-footer">
                {step > 1 && <button className="btn ghost" onClick={() => setStep(s => s - 1)}>السابق</button>}
                <button className="btn primary" disabled={!!error} onClick={step<4?()=>setStep(s=>s+1):()=>{
                    const res = QuranGoalResolutionService.resolve(form);
                    const range = QuranGoalResolutionService.getAyahRange(res.s1, res.a1, res.s2, res.a2);
                    const tasks = generatePlan(form, range);
                    onComplete({...form, ...res, tasks});
                }}>{step<4?'التالي':'بدء الخطة'}</button>
            </div>
        </div>
    );
}

export default function App() {
  const [st, setSt] = useState(null);
  const [tab, setTab] = useState("home");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wird_v7");
      setSt(saved ? JSON.parse(saved) : { plan: null, units: [], streak: 0, lastActivity: null });
    } catch { setSt({ plan: null, units: [], streak: 0 }); }
  }, []);

  useEffect(() => { if (st) localStorage.setItem("wird_v7", JSON.stringify(st)); }, [st]);

  const handleComplete = (task, rating) => {
    setSt(s => {
        const isMem = task.type === 'MEM';
        const newUnit = isMem ? { ...task, nextReview: addDays(today(), rating === 4 ? 4 : 1) } : null;
        const tasks = s.plan.tasks.map(t => t.id === task.id ? { ...t, status: 'DONE', rating } : t);
        const streak = (s.lastActivity === addDays(today(), -1)) ? s.streak + 1 : (s.lastActivity === today() ? s.streak : 1);
        return { ...s, plan: { ...s.plan, tasks }, units: isMem ? [...s.units, newUnit] : s.units, streak, lastActivity: today() };
    });
  };

  if (!st) return null;

  const todayT = st.plan ? st.plan.tasks.filter(t => t.date === today() && t.status !== 'DONE') : [];
  const reviewT = st.units.filter(u => u.nextReview <= today());
  const progress = st.plan ? Math.round((st.plan.tasks.filter(t => t.status === 'DONE').length / st.plan.tasks.length) * 100) : 0;

  return (
    <div className="app" dir="rtl">
      <style>{CSS}</style>
      <header className="topbar"><h1>وِرد v7</h1><div className="badge"><b>{ar(st.streak)}</b><span>يوم</span></div></header>
      <main className="content">
        {!st.plan ? <Wizard onComplete={p => setSt({ ...st, plan: p })} /> : (
            <div className="screen">
                {tab === 'home' && <>
                    <div className="card"><h3>إنجاز الخطة: {ar(progress)}%</h3><div className="p-bar"><i style={{width: progress+'%'}} /></div></div>
                    <div className="task-list">
                        {reviewT.map((u, i) => <Task key={'r'+i} t={{...u, type:'REV_DUE'}} onDone={r => setSt(s => ({...s, units: s.units.map(x=>x.id===u.id?{...x, nextReview: addDays(today(), r===4?7:2)}:x)}))} />)}
                        {todayT.map(t => <Task key={t.id} t={t} onDone={r => handleComplete(t, r)} />)}
                        {todayT.length === 0 && reviewT.length === 0 && <p className="empty">أتممت مهام اليوم!</p>}
                    </div>
                </>}
                <nav className="bottomnav"><button onClick={() => setTab('home')} className={tab==='home'?'on':''}>اليوم</button><button onClick={() => {if(confirm('إعادة الخطة؟')){localStorage.clear();location.reload();}}}>إعادة</button></nav>
            </div>
        )}
      </main>
    </div>
  );
}

function Task({ t, onDone }) {
    const label = t.type==='MEM' ? (t.s1===t.s2 ? `${SURAH_NAMES[t.s1-1]} (${ar(t.a1)}-${ar(t.a2)})` : `من ${SURAH_NAMES[t.s1-1]} (${ar(t.a1)}) إلى ${SURAH_NAMES[t.s2-1]} (${ar(t.a2)})`) : (t.type==='REV_DUE' ? `مراجعة: ${SURAH_NAMES[t.s1-1]}` : 'مهمة مراجعة');
    return (
        <div className={`task-card ${t.type}`}>
            <div className="t-info"><b>{t.type==='MEM'?'حفظ جديد':t.type==='REV_DUE'?'مراجعة مستحقة':'تثبيت'}</b><span>{label}</span></div>
            <div className="t-btns"><button onClick={()=>onDone(4)}>ممتاز</button><button onClick={()=>onDone(2)}>ضعيف</button></div>
        </div>
    );
}

const CSS = `
    :root { --bg:#0E1726; --surface:#152139; --surface-2:#1D2E4B; --primary:#C9A227; --text:#EFE7D5; --text-dim:#A8AEBD; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:sans-serif; }
    .topbar { display:flex; justify-content:space-between; padding:20px; align-items:center; border-bottom:1px solid var(--surface-2); }
    .badge { background:var(--surface-2); padding:5px 15px; border-radius:15px; border:1px solid var(--primary); text-align:center; }
    .card { background:var(--surface); border-radius:20px; padding:20px; margin:15px; border:1px solid rgba(201,162,39,0.1); }
    .wizard { max-width:450px; margin:0 auto; }
    .step-content { display:flex; flex-direction:column; gap:12px; margin:20px 0; }
    select, input { background:var(--bg); color:white; padding:12px; border:1px solid var(--surface-2); border-radius:10px; font-family:inherit; }
    .btn { border:none; padding:12px 20px; border-radius:12px; font-weight:bold; cursor:pointer; }
    .btn.primary { background:var(--primary); color:black; }
    .btn.primary:disabled { opacity:0.5; }
    .btn.ghost { background:none; color:white; border:1px solid var(--surface-2); }
    .opt { background:var(--surface-2); padding:15px; border-radius:12px; text-align:right; border:1px solid transparent; width:100%; color:white; cursor:pointer; margin-bottom:8px; }
    .opt.on { border-color:var(--primary); background:rgba(201,162,39,0.1); }
    .row { display:flex; gap:10px; align-items:center; }
    .row select, .row input { flex:1; }
    .seg-control { display:flex; background:var(--bg); padding:5px; border-radius:10px; }
    .seg-control button { flex:1; background:none; border:none; color:white; padding:10px; border-radius:8px; cursor:pointer; }
    .seg-control button.on { background:var(--surface-2); color:var(--primary); }
    .schedule-grid { display:flex; gap:5px; margin-top:10px; }
    .day-btn { flex:1; height:40px; border-radius:10px; border:none; color:white; font-weight:bold; cursor:pointer; }
    .day-btn.mem { background:#3F8F7E; } .day-btn.rev { background:#5B8FC7; } .day-btn.rest { background:#3B4554; opacity:0.5; }
    .task-card { background:var(--surface); padding:15px; border-radius:15px; margin:10px; display:flex; justify-content:space-between; align-items:center; border-right:4px solid var(--primary); }
    .task-card.REV_DUE { border-right-color:#5B8FC7; }
    .t-info { display:flex; flex-direction:column; gap:4px; }
    .t-info b { font-size:14px; } .t-info span { font-size:11px; color:var(--text-dim); }
    .t-btns { display:flex; gap:5px; }
    .t-btns button { background:var(--surface-2); border:none; color:white; padding:6px 10px; border-radius:8px; font-size:11px; cursor:pointer; }
    .p-bar { height:6px; background:var(--surface-2); border-radius:3px; margin-top:10px; overflow:hidden; }
    .p-bar i { display:block; height:100%; background:var(--primary); }
    .bottomnav { position:fixed; bottom:0; left:0; right:0; background:var(--surface); display:flex; padding:15px; border-top:1px solid var(--surface-2); }
    .bottomnav button { flex:1; background:none; border:none; color:white; font-weight:bold; cursor:pointer; }
    .bottomnav button.on { color:var(--primary); }
    .error { color:#B4574C; font-size:12px; text-align:center; }
`;
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
