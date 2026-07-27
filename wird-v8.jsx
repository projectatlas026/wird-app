import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createRoot } from "react-dom/client";

/* ══════════════════════════════════════════════════════════════
   وِرد v8 — إصدار المصحف الكامل (The Full Mushaf Edition)
   دعم الروايات، الأرباع، المراجعة المتباعدة، ومعالجة المهام المتأخرة
   ══════════════════════════════════════════════════════════════ */

/* ─────────────── DATA: القراءات والروايات ─────────────── */
const READINGS = [
    { id: 'asim', name: 'عاصم الكوفي' },
    { id: 'nafi', name: 'نافع المدني' }
];

const RIWAYAT = [
    { id: 'hafs', readingId: 'asim', name: 'حفص عن عاصم', mushaf: 'مصحف المدينة' },
    { id: 'shuba', readingId: 'asim', name: 'شعبة عن عاصم', mushaf: 'مصحف المدينة' },
    { id: 'warsh', readingId: 'nafi', name: 'ورش عن نافع', mushaf: 'مصحف الشمرلي' },
    { id: 'qalun', readingId: 'nafi', name: 'قالون عن نافع', mushaf: 'مصحف قطر' }
];

/* ─────────────── DATA: حدود القرآن الشاملة ─────────────── */
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

const JUZ_STARTS = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
const HIZB_STARTS = [[1,1],[2,75],[2,142],[2,203],[2,253],[3,15],[3,93],[3,171],[4,24],[4,88],[4,148],[5,27],[5,82],[6,36],[6,111],[7,1],[7,88],[7,171],[8,41],[9,34],[9,93],[10,26],[11,6],[11,84],[12,53],[13,19],[15,1],[16,51],[17,1],[17,100],[18,75],[19,59],[21,1],[22,38],[23,1],[24,21],[25,21],[26,111],[27,56],[29,1],[29,46],[31,22],[33,31],[34,24],[36,28],[38,21],[39,32],[40,41],[41,47],[43,24],[46,1],[48,18],[51,31],[54,9],[58,1],[61,1],[67,1],[72,1],[78,1],[87,1]];

/* ─────────────── UTILS ─────────────── */
const ar = (n) => String(n);
const getTodayLocal = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 10);
};
const addDays = (s, n) => {
    const d = new Date(s + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
const diffDays = (a, b) => Math.floor((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
const weekdayOf = (ds) => new Date(ds + "T00:00:00Z").getUTCDay();

/* ─────────────── SRS ENGINE ─────────────── */
const SRS_INTERVALS = [1, 3, 7, 14, 30, 60, 90, 180];
function getNextInterval(currentInterval, rating) {
    const idx = SRS_INTERVALS.indexOf(currentInterval);
    if (rating >= 4) return SRS_INTERVALS[Math.min(SRS_INTERVALS.length - 1, (idx === -1 ? 0 : idx) + 1)];
    if (rating === 3) return currentInterval || 1;
    return 1; // إعادة المراجعة من البداية عند الضعف
}

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
        } else if (form.goalType === 'SURAH_RANGE') {
            [s1, a1] = [form.startSurah, 1];
            [s2, a2] = [form.endSurah, AYAH_COUNTS[form.endSurah - 1]];
        } else [s1, a1, s2, a2] = [form.startSurah, form.startAyah, form.endSurah, form.endAyah];
        return { s1, a1, s2, a2 };
    },
    getPrev(s, a) {
        if (a > 1) return [s, a - 1];
        return [s - 1, AYAH_COUNTS[s - 2]];
    }
};

/* ─────────────── SERVICE: PlanGenerator ─────────────── */
function generatePlan(p, ranges) {
    const tasks = [];
    let ayahIdx = 0;
    let curDate = p.startDate;
    const total = ranges.length;

    const countWorkDays = (start, end, sch) => {
        let c = 0, d = start;
        while (diffDays(end, d) >= 0) {
            if (sch[weekdayOf(d)] === 'mem') c++;
            d = addDays(d, 1);
        }
        return c;
    };

    const workDaysTotal = (p.mode === 'date') ? countWorkDays(p.startDate, p.targetEndDate, p.schedule) : 0;
    let workDayC = 0;

    while (ayahIdx < total) {
        const type = p.schedule[weekdayOf(curDate)];
        const id = 't-' + Math.random().toString(36).slice(2, 11);

        if (type === 'mem') {
            workDayC++;
            let amt = p.dailyAmount;
            if (p.mode === 'date') amt = Math.ceil((total - ayahIdx) / Math.max(1, workDaysTotal - workDayC + 1));
            
            const st = ranges[ayahIdx];
            const enIdx = Math.min(total - 1, ayahIdx + amt - 1);
            const en = ranges[enIdx];
            tasks.push({ id, date: curDate, type: 'MEM', s1: st.s, a1: st.a, s2: en.s, a2: en.a, status: 'PENDING' });
            ayahIdx = enIdx + 1;
        } else if (type === 'rev') {
            tasks.push({ id, date: curDate, type: 'REV_GENERAL', status: 'PENDING' });
        } else if (type === 'comp') {
            tasks.push({ id, date: curDate, type: 'COMP', status: 'PENDING' });
        }
        curDate = addDays(curDate, 1);
        if (tasks.length > 5000) break; 
    }
    return tasks;
}

/* ═════════════════════════ UI: المكونات ═════════════════════════ */
function Wizard({ onComplete }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        readingId: 'asim', riwayahId: 'hafs',
        goalType: 'JUZ_RANGE', startJuz: 30, endJuz: 30, startHizb: 59, endHizb: 60,
        startSurah: 78, startAyah: 1, endSurah: 114, endAyah: 6,
        startDate: getTodayLocal(), targetEndDate: addDays(getTodayLocal(), 30), mode: 'date', dailyAmount: 5,
        schedule: { 0: 'rev', 1: 'mem', 2: 'mem', 3: 'mem', 4: 'mem', 5: 'mem', 6: 'comp' }
    });

    const validationError = useMemo(() => {
        if (step === 1) {
            if (!form.readingId || !form.riwayahId) return "يرجى اختيار القراءة والرواية";
        }
        if (step === 3) {
            if (form.goalType === 'JUZ_RANGE' && form.endJuz < form.startJuz) return "نهاية النطاق تسبق بدايته";
            if (form.goalType === 'HIZB_RANGE' && form.endHizb < form.startHizb) return "نهاية الحزب تسبق بدايته";
            const maxAyahS = AYAH_COUNTS[form.startSurah-1];
            if (form.startAyah < 1 || form.startAyah > maxAyahS) return "آية البداية غير موجودة في هذه السورة";
            if (form.endSurah < form.startSurah) return "سورة النهاية تسبق سورة البداية";
        }
        if (step === 4) {
            if (form.mode === 'date' && diffDays(form.targetEndDate, form.startDate) <= 0) return "تاريخ الانتهاء يجب أن يكون بعد البداية";
            if (form.mode === 'amount' && (form.dailyAmount < 1)) return "المقدار اليومي يجب أن يكون 1 على الأقل";
            if (!Object.values(form.schedule).includes('mem')) return "يجب اختيار يوم حفظ واحد على الأقل في الأسبوع";
        }
        return null;
    }, [step, form]);

    return (
        <div className="wizard card">
            <div className="wizard-header"><h2>إنشاء خطة - خطوة {ar(step)} من 5</h2></div>
            <div className="wizard-body">
                {step === 1 && <div className="step-content">
                    <label>القراءة</label>
                    <select value={form.readingId} onChange={e => setForm({...form, readingId: e.target.value, riwayahId: RIWAYAT.find(r=>r.readingId===e.target.value).id})}>
                        {READINGS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <label>الرواية</label>
                    <select value={form.riwayahId} onChange={e => setForm({...form, riwayahId: e.target.value})}>
                        {RIWAYAT.filter(r => r.readingId === form.readingId).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <p className="hint">المصحف: {RIWAYAT.find(r=>r.id===form.riwayahId)?.mushaf}</p>
                </div>}
                {step === 2 && <div className="step-content">
                    {['FULL_QURAN','JUZ_RANGE','HIZB_RANGE','SURAH_RANGE','AYAH_RANGE'].map(t => (
                        <button key={t} className={form.goalType===t?'opt on':'opt'} onClick={()=>setForm({...form, goalType:t})}>
                            {t==='FULL_QURAN'?'القرآن كاملاً':t==='JUZ_RANGE'?'بالأجزاء':t==='HIZB_RANGE'?'بالأحزاب':t==='SURAH_RANGE'?'بالسور':'آيات محددة'}
                        </button>
                    ))}
                </div>}
                {step === 3 && <div className="step-content">
                    {form.goalType==='JUZ_RANGE' && <div className="row"><select value={form.startJuz} onChange={e=>setForm({...form, startJuz:+e.target.value})}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>جزء {ar(i+1)}</option>)}</select><select value={form.endJuz} onChange={e=>setForm({...form, endJuz:+e.target.value})}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>إلى جزء {ar(i+1)}</option>)}</select></div>}
                    {form.goalType==='AYAH_RANGE' && <>
                        <div className="row"><select value={form.startSurah} onChange={e=>setForm({...form, startSurah:+e.target.value})}>{SURAH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select><input type="number" value={form.startAyah} onChange={e=>setForm({...form, startAyah:+e.target.value})} /></div>
                        <div className="row"><select value={form.endSurah} onChange={e=>setForm({...form, endSurah:+e.target.value})}>{SURAH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select><input type="number" value={form.endAyah} onChange={e=>setForm({...form, endAyah:+e.target.value})} /></div>
                    </>}
                </div>}
                {step === 4 && <div className="step-content">
                    <div className="row"><span>تاريخ البدء:</span><input type="date" value={form.startDate} onChange={e=>setForm({...form, startDate:e.target.value})} /></div>
                    <div className="seg-control"><button className={form.mode==='date'?'on':''} onClick={()=>setForm({...form, mode:'date'})}>تاريخ انتهاء</button><button className={form.mode==='amount'?'on':''} onClick={()=>setForm({...form, mode:'amount'})}>مقدار ثابت</button></div>
                    {form.mode==='date'?<input type="date" value={form.targetEndDate} onChange={e=>setForm({...form, targetEndDate:e.target.value})} /> : <input type="number" value={form.dailyAmount} onChange={e=>setForm({...form, dailyAmount:+e.target.value})} />}
                    <div className="schedule-grid">
                        {WEEKDAYS.map((d,i)=><button key={i} className={`day-btn ${form.schedule[i]}`} onClick={()=>{
                            const states = {mem:'rev', rev:'comp', comp:'rest', rest:'mem'};
                            setForm({...form, schedule:{...form.schedule, [i]: states[form.schedule[i]]}});
                        }}>{d.slice(0,1)}</button>)}
                    </div>
                </div>}
                {step === 5 && <div className="step-content">
                    <div className="preview-box">
                        <p><b>الرواية:</b> {RIWAYAT.find(r=>r.id===form.riwayahId).name}</p>
                        <p><b>الهدف:</b> {form.goalType}</p>
                        <p><b>الموعد:</b> من {ar(form.startDate)}</p>
                    </div>
                </div>}
                {validationError && <div className="error">{validationError}</div>}
            </div>
            <div className="wizard-footer">
                {step > 1 && <button className="btn ghost" onClick={() => setStep(s => s - 1)}>السابق</button>}
                <button className="btn primary" disabled={!!validationError} onClick={step<5?()=>setStep(s=>s+1):()=>{
                    const res = QuranGoalResolutionService.resolve(form);
                    const range = QuranGoalResolutionService.getAyahRange(res.s1, res.a1, res.s2, res.a2);
                    const tasks = generatePlan(form, range);
                    onComplete({...form, ...res, tasks, totalAyahs: range.length});
                }}>{step<5?'التالي':'إنشاء الخطة'}</button>
            </div>
        </div>
    );
}

export default function App() {
  const [st, setSt] = useState(null);
  const [tab, setTab] = useState("home");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wird_v8");
      if (saved) {
          const parsed = JSON.parse(saved);
          setSt(parsed);
      } else setSt({ plan: null, units: [], streak: 0, lastActivity: null });
    } catch { setSt({ plan: null, units: [], streak: 0 }); }
  }, []);

  useEffect(() => { if (st) localStorage.setItem("wird_v8", JSON.stringify(st)); }, [st]);

  const handleCompleteTask = (task, rating) => {
      setSt(s => {
          const isMem = task.type === 'MEM';
          const tasks = s.plan.tasks.map(t => t.id === task.id ? { ...t, status: 'DONE', rating } : t);
          
          let units = [...s.units];
          if (isMem) {
              units.push({
                  id: 'u-' + Date.now(),
                  ...task,
                  lastInterval: 0,
                  nextReview: addDays(getTodayLocal(), rating === 4 ? 3 : 1),
                  mastery: rating * 25
              });
          }

          const yesterday = addDays(getTodayLocal(), -1);
          const streak = (s.lastActivity === yesterday) ? s.streak + 1 : (s.lastActivity === getTodayLocal() ? s.streak : 1);
          
          return { ...s, plan: { ...s.plan, tasks }, units, streak, lastActivity: getTodayLocal() };
      });
  };

  const handleCompleteReview = (unit, rating) => {
      setSt(s => {
          const nextInt = getNextInterval(unit.lastInterval || 1, rating);
          const units = s.units.map(u => u.id === unit.id ? { 
              ...u, 
              lastInterval: nextInt, 
              nextReview: addDays(getTodayLocal(), nextInt),
              mastery: Math.min(100, (u.mastery || 0) + (rating-2)*10)
          } : u);
          return { ...s, units };
      });
  };

  if (!st) return null;

  const localToday = getTodayLocal();
  const todayTasks = st.plan ? st.plan.tasks.filter(t => t.date <= localToday && t.status === 'PENDING') : [];
  const reviewDue = st.units.filter(u => u.nextReview <= localToday);
  
  const completedCount = st.plan ? st.plan.tasks.filter(t => t.status === 'DONE' && t.type === 'MEM').length : 0;
  const totalMemTasks = st.plan ? st.plan.tasks.filter(t => t.type === 'MEM').length : 1;
  const progress = Math.round((completedCount / totalMemTasks) * 100);

  return (
    <div className="app" dir="rtl">
      <style>{CSS}</style>
      <header className="topbar">
          <h1>وِرد v8</h1>
          <div className="badge"><b>{ar(st.streak)}</b><span>يوم</span></div>
      </header>

      <main className="content">
        {!st.plan ? <Wizard onComplete={p => setSt({...st, plan: p})} /> : (
            <div className="screen">
                {tab === 'home' && (
                    <>
                        <div className="card progress-card">
                            <h3>إنجاز الحفظ: {ar(progress)}%</h3>
                            <div className="p-bar"><i style={{width: progress+'%'}} /></div>
                            <p className="hint">تم حفظ {ar(completedCount)} وحدة من أصل {ar(totalMemTasks)}</p>
                        </div>
                        
                        <div className="task-list">
                            {reviewDue.length > 0 && <div className="task-section">
                                <h4>مراجعة متباعدة ({ar(reviewDue.length)})</h4>
                                {reviewDue.map(u => <TaskRow key={u.id} type="REV" title={SURAH_NAMES[u.s1-1]} subtitle={`آية ${ar(u.a1)} إلى ${ar(u.a2)}`} onDone={r => handleCompleteReview(u, r)} />)}
                            </div>}

                            <div className="task-section">
                                <h4>مهام الحفظ اليومية</h4>
                                {todayTasks.length === 0 ? <p className="empty">لا توجد مهام حُفظ حالياً.</p> : todayTasks.map(t => (
                                    <TaskRow 
                                        key={t.id} 
                                        type={t.type} 
                                        title={t.type === 'MEM' ? (t.s1 === t.s2 ? SURAH_NAMES[t.s1-1] : `من ${SURAH_NAMES[t.s1-1]}`) : 'تعويض/مراجعة'} 
                                        subtitle={t.type === 'MEM' ? `آية ${ar(t.a1)} إلى ${ar(t.a2)}` : 'تثبيت المحفوظ'} 
                                        onDone={r => handleCompleteTask(t, r)} 
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                )}
                <nav className="bottomnav">
                    <button className={tab==='home'?'on':''} onClick={()=>setTab('home')}>اليوم</button>
                    <button onClick={()=>{if(confirm('سيتم مسح الخطة؟')){localStorage.clear();location.reload();}}}>إعادة الخطة</button>
                </nav>
            </div>
        )}
      </main>
    </div>
  );
}

function TaskRow({ type, title, subtitle, onDone }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className={`task-card ${type}`}>
            <div className="t-head" onClick={()=>setExpanded(!expanded)}>
                <div className="t-info"><b>{title}</b><span>{subtitle}</span></div>
                <div className="t-type">{type === 'MEM' ? 'حفظ' : 'مراجعة'}</div>
            </div>
            {expanded && (
                <div className="t-actions">
                    <button className="rate-4" onClick={()=>onDone(4)}>ممتاز</button>
                    <button className="rate-3" onClick={()=>onDone(3)}>جيد</button>
                    <button className="rate-2" onClick={()=>onDone(2)}>ضعيف</button>
                </div>
            )}
        </div>
    );
}

const CSS = `
    :root { --bg:#0E1726; --surface:#152139; --surface-2:#1D2E4B; --primary:#C9A227; --text:#EFE7D5; --text-dim:#A8AEBD; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:sans-serif; }
    .topbar { display:flex; justify-content:space-between; padding:15px 20px; align-items:center; border-bottom:1px solid var(--surface-2); }
    .badge { background:var(--surface-2); padding:5px 15px; border-radius:15px; border:1px solid var(--primary); text-align:center; }
    .card { background:var(--surface); border-radius:20px; padding:20px; margin:15px; border:1px solid rgba(201,162,39,0.1); }
    .wizard { max-width:450px; margin:0 auto; }
    .step-content { display:flex; flex-direction:column; gap:12px; margin:20px 0; }
    select, input { background:var(--bg); border:1px solid var(--surface-2); color:white; padding:12px; border-radius:10px; font-family:inherit; }
    .btn { border:none; padding:12px 20px; border-radius:12px; font-weight:bold; cursor:pointer; }
    .btn.primary { background:var(--primary); color:black; }
    .btn.ghost { background:none; color:white; border:1px solid var(--surface-2); }
    .opt { background:var(--surface-2); padding:15px; border-radius:12px; text-align:right; border:1px solid transparent; width:100%; color:white; cursor:pointer; margin-bottom:8px; }
    .opt.on { border-color:var(--primary); background:rgba(201,162,39,0.1); }
    .row { display:flex; gap:10px; align-items:center; }
    .row select, .row input { flex:1; }
    .schedule-grid { display:flex; gap:5px; margin-top:10px; }
    .day-btn { flex:1; height:40px; border-radius:10px; border:none; color:white; font-weight:bold; cursor:pointer; }
    .day-btn.mem { background:#3F8F7E; } .day-btn.rev { background:#5B8FC7; } .day-btn.comp { background:#D9A441; } .day-btn.rest { background:#3B4554; opacity:0.5; }
    .task-section h4 { font-size:14px; color:var(--primary); margin:20px 10px 10px; }
    .task-card { background:var(--surface); border-radius:15px; margin:10px; overflow:hidden; border-right:4px solid var(--primary); }
    .task-card.REV { border-right-color:#5B8FC7; }
    .t-head { padding:15px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
    .t-info b { display:block; font-size:15px; } .t-info span { font-size:11px; color:var(--text-dim); }
    .t-type { font-size:10px; background:var(--surface-2); padding:2px 8px; border-radius:10px; }
    .t-actions { display:flex; padding:10px; gap:5px; background:rgba(0,0,0,0.2); }
    .t-actions button { flex:1; border:none; padding:8px; border-radius:8px; color:white; font-size:11px; cursor:pointer; }
    .rate-4 { background:#3F8F7E; } .rate-3 { background:#5B8FC7; } .rate-2 { background:#B4574C; }
    .p-bar { height:8px; background:var(--surface-2); border-radius:4px; overflow:hidden; margin:10px 0; }
    .p-bar i { display:block; height:100%; background:var(--primary); transition:0.4s; }
    .bottomnav { position:fixed; bottom:0; left:0; right:0; background:var(--surface); padding:15px; border-top:1px solid var(--surface-2); display:flex; justify-content:center; gap:20px; }
    .bottomnav button { background:none; border:none; color:white; font-weight:bold; cursor:pointer; }
    .bottomnav button.on { color:var(--primary); }
    .error { color:#B4574C; font-size:12px; text-align:center; }
    .hint { font-size:11px; color:var(--text-dim); }
`;

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
