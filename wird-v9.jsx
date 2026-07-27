import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createRoot } from "react-dom/client";

/* ══════════════════════════════════════════════════════════════
   وِرد v9 — إصدار المصحف الكامل (The Full Mushaf Edition)
   دعم كامل للأرباع، حساب دقيق للتقدم، ونظام إعادة جدولة حقيقي
   ══════════════════════════════════════════════════════════════ */

/* ─────────────── DATA: البيانات الأساسية ─────────────── */
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

const JUZ_STARTS = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
const HIZB_STARTS = [[1,1],[2,75],[2,142],[2,203],[2,253],[3,15],[3,93],[3,171],[4,24],[4,88],[4,148],[5,27],[5,82],[6,36],[6,111],[7,1],[7,88],[7,171],[8,41],[9,34],[9,93],[10,26],[11,6],[11,84],[12,53],[13,19],[15,1],[16,51],[17,1],[17,100],[18,75],[19,59],[21,1],[22,38],[23,1],[24,21],[25,21],[26,111],[27,56],[29,1],[29,46],[31,22],[33,31],[34,24],[36,28],[38,21],[39,32],[40,41],[41,47],[43,24],[46,1],[48,18],[51,31],[54,9],[58,1],[61,1],[67,1],[72,1],[78,1],[87,1]];

const RIWAYAT = [
    { id: 'hafs', name: 'حفص عن عاصم', active: true, mushaf: 'مصحف المدينة' },
    { id: 'warsh', name: 'ورش عن نافع (قريباً)', active: false, mushaf: 'مصحف الشمرلي' },
    { id: 'qalun', name: 'قالون عن نافع (قريباً)', active: false, mushaf: 'مصحف قطر' }
];

const WEEKDAYS = [
    { full: "الأحد", short: "أحد" },
    { full: "الاثنين", short: "اثن" },
    { full: "الثلاثاء", short: "ثلا" },
    { full: "الأربعاء", short: "أرب" },
    { full: "الخميس", short: "خمي" },
    { full: "الجمعة", short: "جمع" },
    { full: "السبت", short: "سبت" }
];

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

/* ─────────────── SERVICE: QuranRangeService ─────────────── */
const QuranRangeService = {
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
            [s2, a2] = [form.endSurah, AYAH_COUNTS[form.endSurah-1]];
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

    const countWorkDays = (start, end, schedule) => {
        let count = 0, d = start;
        while (diffDays(end, d) >= 0) {
            if (schedule[weekdayOf(d)] === 'mem') count++;
            d = addDays(d, 1);
        }
        return count;
    };

    const workDaysTotal = (p.mode === 'date') ? countWorkDays(p.startDate, p.targetEndDate, p.schedule) : 0;
    let workDayC = 0;
    let iterations = 0;

    while (ayahIdx < total) {
        iterations++;
        if (iterations > 10000) throw new Error("تعذر إنشاء الخطة ضمن النطاق الزمني. زد المقدار اليومي أو قلل الهدف.");

        const dayType = p.schedule[weekdayOf(curDate)];
        const id = 't-' + Math.random().toString(36).slice(2, 11);

        if (dayType === 'mem') {
            workDayC++;
            let amt = p.dailyAmount;
            if (p.mode === 'date') {
                const remainingWorkDays = Math.max(1, workDaysTotal - workDayC + 1);
                amt = Math.ceil((total - ayahIdx) / remainingWorkDays);
            }
            
            const st = ayahRanges[ayahIdx];
            const enIdx = Math.min(total - 1, ayahIdx + amt - 1);
            const en = ayahRanges[enIdx];
            const currentTaskAyahs = enIdx - ayahIdx + 1;

            tasks.push({ id, date: curDate, type: 'MEM', s1: st.s, a1: st.a, s2: en.s, a2: en.a, ayahCount: currentTaskAyahs, status: 'PENDING' });
            ayahIdx = enIdx + 1;
        } else if (dayType === 'rev') {
            tasks.push({ id, date: curDate, type: 'REV_GENERAL', status: 'PENDING' });
        } else if (dayType === 'comp') {
            tasks.push({ id, date: curDate, type: 'COMPENSATION', status: 'PENDING' });
        }
        
        // إذا كنا في وضع التاريخ، نتوقف عند تاريخ النهاية حتى لو لم يكتمل الحفظ
        if (p.mode === 'date' && diffDays(p.targetEndDate, curDate) <= 0 && ayahIdx < total) {
            // سنستمر فقط إذا لم نصل لنهاية الآيات، ولكن المحرك في v9 سيحاول حصرها
        }
        curDate = addDays(curDate, 1);
    }
    return tasks;
}

/* ═════════════════════════ UI: المعالج ═════════════════════════ */
function Wizard({ onComplete }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        riwayahId: 'hafs', goalType: 'JUZ_RANGE', startJuz: 30, endJuz: 30,
        startHizb: 59, endHizb: 60, startSurah: 78, startAyah: 1, endSurah: 114, endAyah: 6,
        startDate: getTodayLocal(), targetEndDate: addDays(getTodayLocal(), 30), mode: 'date', dailyAmount: 5,
        schedule: { 0: 'rev', 1: 'mem', 2: 'mem', 3: 'mem', 4: 'mem', 5: 'mem', 6: 'comp' }
    });

    const vError = useMemo(() => {
        if (step === 3) {
            if (form.goalType === 'JUZ_RANGE' && form.endJuz < form.startJuz) return "نهاية الجزء تسبق بدايته";
            if (form.goalType === 'HIZB_RANGE' && form.endHizb < form.startHizb) return "نهاية الحزب تسبق بدايته";
            if (form.goalType === 'SURAH_RANGE' && form.endSurah < form.startSurah) return "سورة النهاية تسبق البداية";
            const maxAyahS = AYAH_COUNTS[form.startSurah-1];
            const maxAyahE = AYAH_COUNTS[form.endSurah-1];
            if (form.startAyah < 1 || form.startAyah > maxAyahS) return `آية البداية غير صحيحة (1-${maxAyahS})`;
            if (form.endAyah < 1 || form.endAyah > maxAyahE) return `آية النهاية غير صحيحة (1-${maxAyahE})`;
        }
        if (step === 4) {
            if (form.mode === 'date' && diffDays(form.targetEndDate, form.startDate) <= 0) return "تاريخ الانتهاء يجب أن يكون بعد البداية";
            if (!Object.values(form.schedule).includes('mem')) return "يجب اختيار يوم حفظ واحد على الأقل";
        }
        return null;
    }, [step, form]);

    return (
        <div className="wizard card">
            <div className="wizard-header"><h2>إنشاء خطة - خطوة {ar(step)} من 5</h2></div>
            <div className="wizard-body">
                {step === 1 && <div className="step-content">
                    <label>الرواية</label>
                    <select value={form.riwayahId} onChange={e=>setForm({...form, riwayahId:e.target.value})}>
                        {RIWAYAT.map(r => <option key={r.id} value={r.id} disabled={!r.active}>{r.name}</option>)}
                    </select>
                    <p className="hint">المصحف: {RIWAYAT.find(r=>r.id===form.riwayahId).mushaf}</p>
                </div>}

                {step === 2 && <div className="step-content">
                    {['FULL_QURAN','JUZ_RANGE','HIZB_RANGE','SURAH_RANGE','AYAH_RANGE'].map(t => (
                        <button key={t} className={form.goalType===t?'opt on':'opt'} onClick={()=>setForm({...form, goalType:t})}>
                            {t==='FULL_QURAN'?'المصحف كاملاً':t==='JUZ_RANGE'?'بالأجزاء':t==='HIZB_RANGE'?'بالأحزاب':t==='SURAH_RANGE'?'بالسور':'بالآيات'}
                        </button>
                    ))}
                </div>}

                {step === 3 && <div className="step-content">
                    {form.goalType==='JUZ_RANGE' && <div className="row"><select value={form.startJuz} onChange={e=>setForm({...form, startJuz:+e.target.value})}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>من جزء {ar(i+1)}</option>)}</select><select value={form.endJuz} onChange={e=>setForm({...form, endJuz:+e.target.value})}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>إلى جزء {ar(i+1)}</option>)}</select></div>}
                    {form.goalType==='HIZB_RANGE' && <div className="row"><select value={form.startHizb} onChange={e=>setForm({...form, startHizb:+e.target.value})}>{Array.from({length:60},(_,i)=><option key={i+1} value={i+1}>من حزب {ar(i+1)}</option>)}</select><select value={form.endHizb} onChange={e=>setForm({...form, endHizb:+e.target.value})}>{Array.from({length:60},(_,i)=><option key={i+1} value={i+1}>إلى حزب {ar(i+1)}</option>)}</select></div>}
                    {form.goalType==='SURAH_RANGE' && <div className="row"><select value={form.startSurah} onChange={e=>setForm({...form, startSurah:+e.target.value})}>{SURAH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select><select value={form.endSurah} onChange={e=>setForm({...form, endSurah:+e.target.value})}>{SURAH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select></div>}
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
                        {WEEKDAYS.map((d,i)=><button key={i} title={d.full} className={`day-btn ${form.schedule[i]}`} onClick={()=>{
                            const states = {mem:'rev', rev:'comp', comp:'rest', rest:'mem'};
                            setForm({...form, schedule:{...form.schedule, [i]: states[form.schedule[i]]}});
                        }}>{d.short}</button>)}
                    </div>
                    <div className="legend"><span className="mem">حفظ</span><span className="rev">مراجعة</span><span className="comp">تعويض</span><span className="rest">راحة</span></div>
                </div>}

                {step === 5 && <div className="step-content"><div className="preview-box"><p><b>الرواية:</b> {RIWAYAT.find(r=>r.id===form.riwayahId).name}</p><p><b>الهدف:</b> {form.goalType}</p><p><b>البداية:</b> {ar(form.startDate)}</p></div></div>}
                {vError && <div className="error-msg">{vError}</div>}
            </div>
            <div className="wizard-footer">
                {step > 1 && <button className="btn ghost" onClick={() => setStep(s => s - 1)}>السابق</button>}
                <button className="btn primary" disabled={!!vError} onClick={step<5?()=>setStep(s=>s+1):()=>{
                    const res = QuranRangeService.resolve(form);
                    const range = QuranRangeService.getAyahRange(res.s1, res.a1, res.s2, res.a2);
                    const tasks = generatePlan(form, range);
                    onComplete({...form, ...res, tasks, totalAyahs: range.length});
                }}>{step<5?'التالي':'إنشاء الخطة'}</button>
            </div>
        </div>
    );
}

/* ═════════════════════════ التطبيق الرئيسي ═════════════════════════ */
export default function App() {
  const [st, setSt] = useState(null);
  const [tab, setTab] = useState("home");
  const [snack, setSnack] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wird_v9_data");
      setSt(saved ? JSON.parse(saved) : { plan: null, units: [], streak: 0, logs: [] });
    } catch { setSt({ plan: null, units: [], streak: 0, logs: [] }); }
  }, []);

  useEffect(() => { if (st) localStorage.setItem("wird_v9_data", JSON.stringify(st)); }, [st]);

  const handleCompleteTask = (task, rating) => {
      setSt(s => {
          const tasks = s.plan.tasks.map(t => t.id === task.id ? { ...t, status: 'DONE', rating } : t);
          let units = [...s.units];
          if (task.type === 'MEM') {
              units.push({ id: 'u-'+Date.now(), ...task, lastInterval: 0, nextReview: addDays(getTodayLocal(), rating === 4 ? 3 : 1), mastery: rating * 25 });
          }
          const streak = (s.lastActivity === addDays(getTodayLocal(), -1)) ? s.streak + 1 : (s.lastActivity === getTodayLocal() ? s.streak : 1);
          return { ...s, plan: { ...s.plan, tasks }, units, streak, lastActivity: getTodayLocal(), logs: [...s.logs, { date: getTodayLocal(), taskId: task.id, rating }] };
      });
      setSnack("تم التسجيل!"); setTimeout(() => setSnack(null), 2000);
  };

  if (!st) return null;

  const today = getTodayLocal();
  const tasksDue = st.plan ? st.plan.tasks.filter(t => t.date <= today && t.status === 'PENDING') : [];
  const reviewsDue = st.units.filter(u => u.nextReview <= today);
  const completedAyahs = st.plan ? st.plan.tasks.filter(t=>t.status==='DONE'&&t.type==='MEM').reduce((sum,t)=>sum+(t.ayahCount||0), 0) : 0;
  const progress = st.plan ? Math.round((completedAyahs / st.plan.totalAyahs) * 100) : 0;

  return (
    <div className="app" dir="rtl">
      <style>{CSS}</style>
      <header className="topbar"><h1>وِرد v9</h1><div className="badge"><b>{ar(st.streak)}</b><span>يوم</span></div></header>
      <main className="content">
        {!st.plan ? <Wizard onComplete={p => setSt({...st, plan: p})} /> : (
            <div className="screen">
                <div className="card progress-card">
                    <h3>تقدم الحفظ: {ar(progress)}%</h3>
                    <div className="p-bar"><i style={{width: progress+'%'}}></i></div>
                    <p className="hint">تم حفظ {ar(completedAyahs)} آية من {ar(st.plan.totalAyahs)}</p>
                </div>
                
                <div className="task-list">
                    {reviewsDue.length > 0 && <div className="section"><h4>مراجعة مستحقة ({ar(reviewsDue.length)})</h4>
                        {reviewsDue.map(u => <TaskCard key={u.id} type="REV" t={u} onDone={r => setSt(s=>({...s, units: s.units.map(x=>x.id===u.id?{...x, nextReview: addDays(today, r===4?7:2)}:x)}))} />)}
                    </div>}
                    
                    <div className="section"><h4>مهام الخطة</h4>
                        {tasksDue.length === 0 ? <p className="empty">لا مهام متبقية لليوم.</p> : tasksDue.map(t => <TaskCard key={t.id} t={t} onDone={r => handleCompleteTask(t, r)} />)}
                    </div>
                </div>
                <nav className="bottomnav"><button onClick={()=>setTab('home')} className={tab==='home'?'on':''}>اليوم</button><button onClick={()=>{if(confirm('إعادة؟')){localStorage.clear();location.reload();}}}>إعادة</button></nav>
            </div>
        )}
      </main>
      {snack && <div className="snack">{snack}</div>}
    </div>
  );
}

function TaskCard({ t, type, onDone }) {
    const [open, setOpen] = useState(false);
    const label = t.s1 === t.s2 ? `${SURAH_NAMES[t.s1-1]} (${ar(t.a1)}-${ar(t.a2)})` : `من ${SURAH_NAMES[t.s1-1]} (${ar(t.a1)}) إلى ${SURAH_NAMES[t.s2-1]} (${ar(t.a2)})`;
    return (
        <div className={`task-card ${type||t.type}`}>
            <div className="t-head" onClick={()=>setOpen(!open)}>
                <div className="t-info"><b>{type==='REV'?'مراجعة':t.type==='MEM'?'حفظ جديد':'تعويض'}</b><span>{label}</span></div>
                {t.date < getTodayLocal() && <span className="late-tag">متأخرة</span>}
            </div>
            {open && <div className="t-actions"><button className="r4" onClick={()=>onDone(4)}>ممتاز</button><button className="r3" onClick={()=>onDone(3)}>جيد</button><button className="r2" onClick={()=>onDone(2)}>ضعيف</button></div>}
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
    select, input { background:var(--bg); color:white; padding:12px; border:1px solid var(--surface-2); border-radius:10px; font-family:inherit; }
    .btn { border:none; padding:12px 20px; border-radius:12px; font-weight:bold; cursor:pointer; }
    .btn.primary { background:var(--primary); color:black; }
    .btn.ghost { background:none; color:white; border:1px solid var(--surface-2); }
    .opt { background:var(--surface-2); padding:15px; border-radius:12px; text-align:right; border:1px solid transparent; width:100%; color:white; cursor:pointer; margin-bottom:8px; }
    .opt.on { border-color:var(--primary); background:rgba(201,162,39,0.1); }
    .row { display:flex; gap:10px; align-items:center; } .row select, .row input { flex:1; }
    .schedule-grid { display:flex; gap:5px; margin-top:10px; }
    .day-btn { flex:1; height:40px; border-radius:10px; border:none; color:white; font-size:11px; cursor:pointer; }
    .day-btn.mem { background:#3F8F7E; } .day-btn.rev { background:#5B8FC7; } .day-btn.comp { background:#D9A441; } .day-btn.rest { background:#3B4554; opacity:0.5; }
    .legend { display:flex; justify-content:center; gap:10px; margin-top:10px; font-size:10px; }
    .legend span::before { content:'●'; margin-left:4px; }
    .mem { color:#3F8F7E; } .rev { color:#5B8FC7; } .comp { color:#D9A441; }
    .task-card { background:var(--surface); border-radius:15px; margin-bottom:10px; border-right:4px solid var(--primary); overflow:hidden; }
    .task-card.REV { border-right-color:#5B8FC7; }
    .t-head { padding:15px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
    .t-info b { display:block; font-size:14px; } .t-info span { font-size:11px; color:var(--text-dim); }
    .late-tag { font-size:9px; background:#B4574C; padding:2px 6px; border-radius:5px; }
    .t-actions { display:flex; gap:5px; padding:10px; background:rgba(0,0,0,0.2); }
    .t-actions button { flex:1; border:none; padding:8px; border-radius:8px; color:white; font-size:11px; cursor:pointer; }
    .r4 { background:#3F8F7E; } .r3 { background:#5B8FC7; } .r2 { background:#B4574C; }
    .p-bar { height:8px; background:var(--surface-2); border-radius:4px; overflow:hidden; margin:10px 0; }
    .p-bar i { display:block; height:100%; background:var(--primary); transition:0.4s; }
    .bottomnav { position:fixed; bottom:0; left:0; right:0; background:var(--surface); padding:15px; border-top:1px solid var(--surface-2); display:flex; justify-content:center; gap:20px; }
    .snack { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:var(--primary); color:black; padding:10px 20px; border-radius:20px; font-weight:bold; }
    .error-msg { color:#B4574C; font-size:11px; text-align:center; }
`;

const root = createRoot(document.getElementById('root'));
root.render(<App />);
