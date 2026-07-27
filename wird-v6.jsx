import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   وِرد v6 — المحرك الكامل (The Production Engine)
   دعم الأجزاء، الأحزاب، الأرباع، التقسيم الذكي، والمراجعة المتباعدة
   ══════════════════════════════════════════════════════════════ */

/* ─────────────── DATA: حدود القرآن الشاملة (رواية حفص) ─────────────── */
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

// مصفوفة بدايات الأجزاء [سورة، آية]
const JUZ_STARTS = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
// مصفوفة بدايات الأحزاب (60 حزباً)
const HIZB_STARTS = [[1,1],[2,75],[2,142],[2,203],[2,253],[3,15],[3,93],[3,171],[4,24],[4,88],[4,148],[5,27],[5,82],[6,36],[6,111],[7,1],[7,88],[7,171],[8,41],[9,34],[9,93],[10,26],[11,6],[11,84],[12,53],[13,19],[15,1],[16,51],[17,1],[17,100],[18,75],[19,59],[21,1],[22,38],[23,1],[24,21],[25,21],[26,111],[27,56],[29,1],[29,46],[31,22],[33,31],[34,24],[36,28],[38,21],[39,32],[40,41],[41,47],[43,24],[46,1],[48,18],[51,31],[54,9],[58,1],[61,1],[67,1],[72,1],[78,1],[87,1]];

const READINGS = [{ id: 'asim', name: 'عاصم الكوفي' }, { id: 'nafi', name: 'نافع المدني' }];
const RIWAYAT = [
    { id: 'hafs', readingId: 'asim', name: 'حفص عن عاصم', mushaf: 'مصحف المدينة' },
    { id: 'shuba', readingId: 'asim', name: 'شعبة عن عاصم', mushaf: 'مصحف المدينة' },
    { id: 'warsh', readingId: 'nafi', name: 'ورش عن نافع', mushaf: 'مصحف الشمرلي' },
    { id: 'qalun', readingId: 'nafi', name: 'قالون عن نافع', mushaf: 'مصحف قطر' }
];

/* ─────────────── UTILS: أدوات الزمن والحساب ─────────────── */
const ar = (n) => String(n); // استخدام الأرقام القياسية بناءً على طلبك السابق
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (s, n) => new Date((Math.floor(Date.parse(s + "T00:00:00Z") / 86400000) + n) * 86400000).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.floor((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
const weekdayOf = (ds) => new Date(ds + "T00:00:00Z").getUTCDay();

/* ─────────────── SERVICE: QuranGoalResolutionService ─────────────── */
const QuranGoalResolutionService = {
    getAyahRange(startSurah, startAyah, endSurah, endAyah) {
        const ranges = [];
        for (let s = startSurah; s <= endSurah; s++) {
            const first = (s === startSurah) ? startAyah : 1;
            const last = (s === endSurah) ? endAyah : AYAH_COUNTS[s - 1];
            for (let a = first; a <= last; a++) {
                ranges.push({ s, a });
            }
        }
        return ranges;
    },
    resolve(form) {
        let startS, startA, endS, endA;
        switch (form.goalType) {
            case 'FULL_QURAN': [startS, startA, endS, endA] = [1, 1, 114, 6]; break;
            case 'JUZ_RANGE':
                const js = JUZ_STARTS[form.startJuz - 1];
                const je = form.endJuz === 30 ? [114, 6] : JUZ_STARTS[form.endJuz];
                [startS, startA] = js;
                // نهاية الجزء هي الآية التي تسبق بداية الجزء التالي
                [endS, endA] = this.getPreviousAyah(je[0], je[1]);
                break;
            case 'HIZB_RANGE':
                const hs = HIZB_STARTS[form.startHizb - 1];
                const he = form.endHizb === 60 ? [114, 6] : HIZB_STARTS[form.endHizb];
                [startS, startA] = hs;
                [endS, endA] = this.getPreviousAyah(he[0], he[1]);
                break;
            case 'SURAH_RANGE':
                [startS, startA, endS, endA] = [form.startSurah, 1, form.endSurah, AYAH_COUNTS[form.endSurah - 1]];
                break;
            case 'AYAH_RANGE':
                [startS, startA, endS, endA] = [form.startSurah, form.startAyah, form.endSurah, form.endAyah];
                break;
            default: [startS, startA, endS, endA] = [78, 1, 114, 6];
        }
        return { startS, startA, endS, endA };
    },
    getPreviousAyah(s, a) {
        if (a > 1) return [s, a - 1];
        if (s > 1) return [s - 1, AYAH_COUNTS[s - 2]];
        return [1, 1];
    }
};

/* ─────────────── SERVICE: PlanGeneratorService ─────────────── */
function generateTasks(p, ranges) {
    const tasks = [];
    let ayahIdx = 0;
    let currentDate = p.startDate;
    const totalAyahs = ranges.length;

    // حساب الأيام المتاحة للحفظ (التي ليست راحة وليست مراجعة فقط)
    const isWorkDay = (date) => {
        const type = p.schedule[weekdayOf(date)];
        return type === 'mem';
    };

    while (ayahIdx < totalAyahs) {
        const type = p.schedule[weekdayOf(currentDate)];
        
        if (type === 'mem') {
            // حساب المقدار اليومي: إما ثابت أو موزع على المدة
            let amount = p.dailyAmount;
            if (p.mode === 'date') {
                const remainingDays = Math.max(1, diffDays(p.targetEndDate, currentDate));
                amount = Math.ceil((totalAyahs - ayahIdx) / remainingDays);
            }

            const start = ranges[ayahIdx];
            const endIdx = Math.min(totalAyahs - 1, ayahIdx + amount - 1);
            const end = ranges[endIdx];

            tasks.push({
                date: currentDate,
                type: 'NEW_MEMORIZATION',
                startS: start.s, startA: start.a,
                endS: end.s, endA: end.a,
                status: 'PENDING'
            });
            ayahIdx = endIdx + 1;
        } else if (type === 'rev' || type === 'comp') {
            tasks.push({ date: currentDate, type: type === 'rev' ? 'RECENT_REVISION' : 'COMPENSATION', status: 'PENDING' });
        }
        currentDate = addDays(currentDate, 1);
        if (tasks.length > 2000) break; // حماية من الحلقات اللا نهائية
    }
    return tasks;
}

/* ═════════════════════════ UI: المعالج والمكونات ═════════════════════════ */
function PlanWizardV6({ onComplete }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        readingId: 'asim', riwayahId: 'hafs', goalType: 'JUZ_RANGE',
        startJuz: 30, endJuz: 30, startHizb: 59, endHizb: 60,
        startSurah: 78, startAyah: 1, endSurah: 114, endAyah: 6,
        startDate: today(), targetEndDate: addDays(today(), 30),
        dailyAmount: 5, mode: 'date',
        schedule: { 0: 'rev', 1: 'mem', 2: 'mem', 3: 'mem', 4: 'mem', 5: 'mem', 6: 'comp' }
    });

    const validationError = useMemo(() => {
        if (step === 3) {
            if (form.goalType === 'JUZ_RANGE' && form.endJuz < form.startJuz) return "نهاية الجزء لا يمكن أن تسبق بدايته";
            if (form.goalType === 'SURAH_RANGE' && form.endSurah < form.startSurah) return "سورة النهاية تسبق سورة البداية";
            if (form.goalType === 'AYAH_RANGE' && (form.endSurah < form.startSurah || (form.endSurah === form.startSurah && form.endAyah < form.startAyah))) return "نطاق الآيات غير صحيح";
        }
        if (step === 4 && form.mode === 'date' && diffDays(form.targetEndDate, form.startDate) <= 0) return "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية";
        return null;
    }, [step, form]);

    const handleNext = () => { if (!validationError) setStep(s => s + 1); };

    return (
        <div className="wizard card">
            <div className="wizard-header">
                <span className="step-tag">الخطوة {ar(step)} من 5</span>
                <h2>{
                    step === 1 ? "اختيار الرواية" :
                    step === 2 ? "تحديد نوع الهدف" :
                    step === 3 ? "نطاق الحفظ" :
                    step === 4 ? "الخطة الزمنية" : "مراجعة الخطة"
                }</h2>
            </div>

            <div className="wizard-body">
                {step === 1 && (
                    <div className="step-content">
                        <label>القراءة</label>
                        <select value={form.readingId} onChange={e => {
                            const rid = e.target.value;
                            setForm({...form, readingId: rid, riwayahId: RIWAYAT.find(r => r.readingId === rid).id});
                        }}>
                            {READINGS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <label>الرواية</label>
                        <select value={form.riwayahId} onChange={e => setForm({...form, riwayahId: e.target.value})}>
                            {RIWAYAT.filter(r => r.readingId === form.readingId).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <div className="info-box">المصحف المعتمد: {RIWAYAT.find(r => r.id === form.riwayahId).mushaf}</div>
                    </div>
                )}

                {step === 2 && (
                    <div className="step-content">
                        {['FULL_QURAN', 'JUZ_RANGE', 'HIZB_RANGE', 'SURAH_RANGE', 'AYAH_RANGE'].map(type => (
                            <button key={type} className={form.goalType === type ? "opt active" : "opt"} onClick={() => setForm({...form, goalType: type})}>
                                {type === 'FULL_QURAN' ? 'القرآن كاملاً' : type === 'JUZ_RANGE' ? 'بالأجزاء' : type === 'HIZB_RANGE' ? 'بالأحزاب' : type === 'SURAH_RANGE' ? 'بالسور' : 'بالآيات'}
                            </button>
                        ))}
                    </div>
                )}

                {step === 3 && (
                    <div className="step-content">
                        {form.goalType === 'JUZ_RANGE' && <div className="row"><select value={form.startJuz} onChange={e=>setForm({...form, startJuz:+e.target.value})}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>من جزء {ar(i+1)}</option>)}</select><select value={form.endJuz} onChange={e=>setForm({...form, endJuz:+e.target.value})}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>إلى جزء {ar(i+1)}</option>)}</select></div>}
                        {form.goalType === 'HIZB_RANGE' && <div className="row"><select value={form.startHizb} onChange={e=>setForm({...form, startHizb:+e.target.value})}>{Array.from({length:60},(_,i)=><option key={i+1} value={i+1}>من حزب {ar(i+1)}</option>)}</select><select value={form.endHizb} onChange={e=>setForm({...form, endHizb:+e.target.value})}>{Array.from({length:60},(_,i)=><option key={i+1} value={i+1}>إلى حزب {ar(i+1)}</option>)}</select></div>}
                        {form.goalType === 'SURAH_RANGE' && <div className="row"><select value={form.startSurah} onChange={e=>setForm({...form, startSurah:+e.target.value})}>{SURAH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select><select value={form.endSurah} onChange={e=>setForm({...form, endSurah:+e.target.value})}>{SURAH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select></div>}
                        {form.goalType === 'AYAH_RANGE' && <>
                            <div className="row"><select value={form.startSurah} onChange={e=>setForm({...form, startSurah:+e.target.value})}>{SURAH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select><input type="number" value={form.startAyah} onChange={e=>setForm({...form, startAyah:+e.target.value})} /></div>
                            <div className="row"><select value={form.endSurah} onChange={e=>setForm({...form, endSurah:+e.target.value})}>{SURAH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select><input type="number" value={form.endAyah} onChange={e=>setForm({...form, endAyah:+e.target.value})} /></div>
                        </>}
                    </div>
                )}

                {step === 4 && (
                    <div className="step-content">
                        <div className="seg-control">
                            <button className={form.mode === 'date' ? "active" : ""} onClick={() => setForm({...form, mode: 'date'})}>تاريخ انتهاء</button>
                            <button className={form.mode === 'amount' ? "active" : ""} onClick={() => setForm({...form, mode: 'amount'})}>مقدار يومي</button>
                        </div>
                        {form.mode === 'date' ? (
                            <input type="date" value={form.targetEndDate} onChange={e => setForm({...form, targetEndDate: e.target.value})} />
                        ) : (
                            <div className="row"><span>آية/يوم:</span><input type="number" value={form.dailyAmount} onChange={e => setForm({...form, dailyAmount: +e.target.value})} /></div>
                        )}
                    </div>
                )}

                {step === 5 && (
                    <div className="step-content">
                        <div className="preview-card">
                            <p><b>الرواية:</b> {RIWAYAT.find(r=>r.id===form.riwayahId).name}</p>
                            <p><b>الهدف:</b> {form.goalType}</p>
                            <p><b>البداية:</b> {ar(form.startDate)}</p>
                            {form.mode === 'date' && <p><b>الانتهاء:</b> {ar(form.targetEndDate)}</p>}
                        </div>
                    </div>
                )}

                {validationError && <div className="error-msg">{validationError}</div>}
            </div>

            <div className="wizard-footer">
                {step > 1 && <button className="btn ghost" onClick={() => setStep(s => s - 1)}>السابق</button>}
                {step < 5 ? (
                    <button className="btn primary" disabled={!!validationError} onClick={handleNext}>التالي</button>
                ) : (
                    <button className="btn primary" onClick={() => {
                        const res = QuranGoalResolutionService.resolve(form);
                        const ranges = QuranGoalResolutionService.getAyahRange(res.startS, res.startA, res.endS, res.endA);
                        const tasks = generateTasks(form, ranges);
                        onComplete({ ...form, ...res, tasks });
                    }}>اعتماد الخطة</button>
                )}
            </div>
        </div>
    );
}

export default function App() {
  const [st, setSt] = useState(null);
  const [tab, setTab] = useState("home");
  const [snack, setSnack] = useState(null);

  useEffect(() => {
      const saved = localStorage.getItem("wird_v6_data");
      setSt(saved ? JSON.parse(saved) : { plan: null, units: [], streak: 0, sessions: [] });
  }, []);

  useEffect(() => { if (st) localStorage.setItem("wird_v6_data", JSON.stringify(st)); }, [st]);

  const handleComplete = (task, rating) => {
      setSt(s => {
          const isNew = task.type === 'NEW_MEMORIZATION';
          const units = isNew ? [...s.units, { ...task, id: Date.now(), nextReview: addDays(today(), rating === 4 ? 3 : 1) }] : s.units;
          const tasks = s.plan.tasks.map(t => (t.date === task.date && t.type === task.type) ? { ...t, status: 'COMPLETED', rating } : t);
          const streak = (s.lastActivity === addDays(today(), -1)) ? s.streak + 1 : (s.lastActivity === today() ? s.streak : 1);
          return { ...s, plan: { ...s.plan, tasks }, units, streak, lastActivity: today() };
      });
      setSnack("تم تسجيل الإنجاز!");
      setTimeout(() => setSnack(null), 2000);
  };

  if (!st) return null;

  const todayTasks = st.plan ? st.plan.tasks.filter(t => t.date === today() && t.status !== 'COMPLETED') : [];
  const completedToday = st.plan ? st.plan.tasks.filter(t => t.date === today() && t.status === 'COMPLETED').length : 0;
  const progress = st.plan ? Math.round((st.plan.tasks.filter(t => t.status === 'COMPLETED').length / st.plan.tasks.length) * 100) : 0;

  return (
    <div className="app" dir="rtl">
      <style>{CSS}</style>
      <header className="topbar">
        <h1>وِرد v6</h1>
        <div className="badge"><b>{ar(st.streak)}</b><span>يوم</span></div>
      </header>

      <main className="content">
        {!st.plan ? (
            <PlanWizardV6 onComplete={p => setSt({ ...st, plan: p })} />
        ) : (
            <div className="screen">
                {tab === 'home' && (
                    <>
                        <div className="card welcome">
                            <h3>السلام عليكم</h3>
                            <p>أنجزت اليوم {ar(completedToday)} مهام. استمر!</p>
                            <div className="p-bar"><i style={{width: `${progress}%`}}></i></div>
                            <span className="p-text">إنجاز الخطة: {ar(progress)}%</span>
                        </div>
                        <div className="task-list">
                            {todayTasks.length === 0 ? <p className="empty">لا توجد مهام متبقية لليوم.</p> : todayTasks.map((t, i) => (
                                <div key={i} className={`task-card ${t.type}`}>
                                    <div className="t-info">
                                        <b>{t.type === 'NEW_MEMORIZATION' ? 'حفظ جديد' : 'مراجعة'}</b>
                                        <span>{t.type === 'NEW_MEMORIZATION' ? `${SURAH_NAMES[t.startS-1]} (${ar(t.startA)}-${ar(t.endA)})` : 'تثبيت المحفوظ'}</span>
                                    </div>
                                    <div className="t-actions">
                                        <button onClick={() => handleComplete(t, 4)}>ممتاز</button>
                                        <button onClick={() => handleComplete(t, 2)}>ضعيف</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                {tab === 'stats' && (
                    <div className="card">
                        <h3>إحصائياتك</h3>
                        <div className="stat-grid">
                            <div className="s-item"><b>{ar(st.units.length)}</b><span>مقاطع محفوظة</span></div>
                            <div className="s-item"><b>{ar(st.streak)}</b><span>سلسلة الالتزام</span></div>
                        </div>
                    </div>
                )}
                <nav className="bottomnav">
                    <button className={tab==='home'?'on':''} onClick={() => setTab('home')}>اليوم</button>
                    <button className={tab==='stats'?'on':''} onClick={() => setTab('stats')}>الإحصاء</button>
                    <button onClick={() => {if(confirm('سيتم حذف الخطة الحالية؟')) {localStorage.clear(); location.reload();}}}>إعادة</button>
                </nav>
            </div>
        )}
      </main>
      {snack && <div className="snack">{snack}</div>}
    </div>
  );
}

const CSS = `
    :root { --bg:#0E1726; --surface:#152139; --surface-2:#1D2E4B; --primary:#C9A227; --text:#EFE7D5; --text-dim:#A8AEBD; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:sans-serif; }
    .topbar { display:flex; justify-content:space-between; padding:20px; align-items:center; }
    .badge { background:var(--surface-2); padding:5px 15px; border-radius:15px; border:1px solid var(--primary); text-align:center; }
    .badge b { display:block; font-size:18px; }
    .card { background:var(--surface); border-radius:20px; padding:20px; margin:15px; border:1px solid rgba(201,162,39,0.1); }
    .wizard { max-width:500px; margin:0 auto; }
    .step-content { display:flex; flex-direction:column; gap:12px; margin:20px 0; }
    label { font-size:12px; color:var(--text-dim); }
    select, input { background:var(--bg); border:1px solid var(--surface-2); color:white; padding:12px; border-radius:10px; }
    .btn { border:none; padding:12px 20px; border-radius:12px; font-weight:bold; cursor:pointer; }
    .btn.primary { background:var(--primary); color:black; }
    .btn.primary:disabled { opacity:0.5; cursor:not-allowed; }
    .btn.ghost { background:none; color:white; border:1px solid var(--surface-2); }
    .opt { background:var(--surface-2); padding:15px; border-radius:12px; text-align:right; border:1px solid transparent; cursor:pointer; margin-bottom:5px; width:100%; color:white; }
    .opt.active { border-color:var(--primary); background:rgba(201,162,39,0.1); }
    .row { display:flex; gap:10px; align-items:center; }
    .row select, .row input { flex:1; }
    .seg-control { display:flex; background:var(--bg); padding:5px; border-radius:10px; }
    .seg-control button { flex:1; background:none; border:none; color:white; padding:10px; border-radius:8px; cursor:pointer; }
    .seg-control button.active { background:var(--surface-2); color:var(--primary); }
    .error-msg { color:#B4574C; font-size:12px; text-align:center; }
    .task-card { background:var(--surface); padding:15px; border-radius:15px; margin-bottom:10px; display:flex; justify-content:space-between; border-right:4px solid var(--primary); }
    .task-card.RECENT_REVISION { border-right-color:#5B8FC7; }
    .t-info { display:flex; flex-direction:column; }
    .t-info b { font-size:14px; }
    .t-info span { font-size:11px; color:var(--text-dim); }
    .t-actions { display:flex; gap:5px; }
    .t-actions button { background:var(--surface-2); border:none; color:white; padding:5px 10px; border-radius:8px; font-size:11px; cursor:pointer; }
    .p-bar { height:6px; background:var(--surface-2); border-radius:3px; margin:10px 0; overflow:hidden; }
    .p-bar i { display:block; height:100%; background:var(--primary); }
    .p-text { font-size:10px; color:var(--text-dim); }
    .bottomnav { position:fixed; bottom:0; left:0; right:0; background:var(--surface); display:flex; padding:15px; border-top:1px solid var(--surface-2); }
    .bottomnav button { flex:1; background:none; border:none; color:var(--text-dim); font-weight:bold; cursor:pointer; }
    .bottomnav button.on { color:var(--primary); }
    .snack { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:var(--primary); color:black; padding:10px 20px; border-radius:20px; font-weight:bold; }
`;
