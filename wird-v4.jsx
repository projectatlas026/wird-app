import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   وِرد v4 — نظام الخطط المخصصة (Custom Memorization Plans)
   ══════════════════════════════════════════════════════════════ */

/* ─────────────── DOMAIN: بيانات القرآن ─────────────── */
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const JUZ_STARTS = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];

const surahName = (n) => SURAH_NAMES[n - 1] || "";
const ayahCount = (n) => AYAH_COUNTS[n - 1] || 0;

/* ─────────────── DOMAIN: أدوات الزمن ─────────────── */
const ar = (n) => n === null || n === undefined ? "" : String(n);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (s, n) => new Date((Math.floor(Date.parse(s + "T00:00:00Z") / 86400000) + n) * 86400000).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.floor((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
const WEEKDAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const weekdayOf = (ds) => new Date(ds + "T00:00:00Z").getUTCDay();

/* ─────────────── APPLICATION: الحالة الافتراضية ─────────────── */
const emptyState = () => ({
  version: 4,
  plan: null,
  tasks: [], // جدول المهام المولد
  units: [], // المقاطع التي تم حفظها بالفعل وسجل مراجعتها
  sessions: [],
  streak: { current: 0, longest: 0, last: null },
  settings: { mushaf: "مصحف المدينة", reciter: "", debtThreshold: 12, sound: true, highContrast: false, textScale: 1 },
});

/* ─────────────── LOGIC: محرك المراجعة المتباعدة ─────────────── */
// التقييمات: 4: ممتاز، 3: جيد، 2: يحتاج مراجعة، 1: غير محفوظ
export function reviewEngine(unit, rating) {
  const intervals = [1, 3, 7, 14, 30, 60, 90, 180];
  let nextIdx = 0;
  
  if (unit.lastInterval) {
    const curIdx = intervals.indexOf(unit.lastInterval);
    if (rating >= 3) nextIdx = Math.min(intervals.length - 1, curIdx + (rating === 4 ? 1 : 0));
    else if (rating === 2) nextIdx = Math.max(0, curIdx - 1);
    else nextIdx = 0;
  } else {
      nextIdx = rating >= 3 ? 1 : 0;
  }

  const nextInterval = intervals[nextIdx];
  return {
    nextInterval,
    nextReview: addDays(today(), nextInterval),
    mastery: rating * 25 // تقريبي
  };
}

/* ─────────────── LOGIC: خوارزمية إنشاء الخطة ─────────────── */
function generatePlanTasks(params) {
    const tasks = [];
    const { startSurah, startAyah, endSurah, endAyah, startDate, targetEndDate, dailyAmount, mode, schedule } = params;
    
    // 1. حساب إجمالي الآيات
    let totalAyahs = 0;
    const ranges = [];
    for (let s = startSurah; s <= endSurah; s++) {
        const first = s === startSurah ? startAyah : 1;
        const last = s === endSurah ? endAyah : ayahCount(s);
        for (let a = first; a <= last; a++) {
            ranges.push({ s, a });
        }
    }
    totalAyahs = ranges.length;

    // 2. حساب عدد أيام الحفظ المتاحة
    let currentDate = startDate;
    let ayahIdx = 0;
    let daySafety = 0;

    while (ayahIdx < totalAyahs && daySafety < 5000) {
        const dayType = schedule[weekdayOf(currentDate)]; // 'mem', 'rev', 'rest', 'comp'
        
        if (dayType === 'mem') {
            const amount = mode === 'date' 
                ? Math.ceil((totalAyahs - ayahIdx) / Math.max(1, diffDays(targetEndDate, currentDate))) 
                : dailyAmount;
            
            const start = ranges[ayahIdx];
            const endIdx = Math.min(totalAyahs - 1, ayahIdx + amount - 1);
            const end = ranges[endIdx];
            
            tasks.push({
                date: currentDate,
                type: 'NEW_MEMORIZATION',
                startSurah: start.s, startAyah: start.a,
                endSurah: end.s, endAyah: end.a,
                status: 'PENDING'
            });
            ayahIdx += amount;
        } else if (dayType === 'rev') {
            tasks.push({ date: currentDate, type: 'RECENT_REVISION', status: 'PENDING' });
        } else if (dayType === 'comp') {
            tasks.push({ date: currentDate, type: 'COMPENSATION', status: 'PENDING' });
        }

        currentDate = addDays(currentDate, 1);
        daySafety++;
    }

    return tasks;
}

/* ═════════════════════════ UI: المكون الرئيسي ═════════════════════════ */
export default function App() {
  const [st, setSt] = useState(null);
  const [tab, setTab] = useState("home");
  const [wizardStep, setWizardStep] = useState(0);
  const [snack, setSnack] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("wird_v4_data");
    setSt(saved ? { ...emptyState(), ...JSON.parse(saved) } : emptyState());
  }, []);

  useEffect(() => { if (st) localStorage.setItem("wird_v4_data", JSON.stringify(st)); }, [st]);

  const toast = (m) => { setSnack(m); setTimeout(() => setSnack(null), 3000); };

  // استخراج مهام اليوم
  const todayTasks = useMemo(() => {
      if (!st || !st.tasks) return [];
      return st.tasks.filter(t => t.date === today());
  }, [st]);

  // المراجعات المستحقة من الوحدات المحفوظة سابقا (Spaced Repetition)
  const dueReviews = useMemo(() => {
      if (!st || !st.units) return [];
      return st.units.filter(u => u.nextReview <= today());
  }, [st]);

  const handleCompleteTask = (task, rating) => {
      setSt(s => {
          let units = [...s.units];
          if (task.type === 'NEW_MEMORIZATION') {
              const result = reviewEngine({}, rating);
              units.push({
                  id: Date.now(),
                  ...task,
                  lastReview: today(),
                  nextReview: result.nextReview,
                  lastInterval: result.nextInterval,
                  mastery: result.mastery,
                  history: [{ date: today(), rating }]
              });
          }
          
          // تحديث حالة المهمة في الجدول
          const tasks = s.tasks.map(t => t.date === task.date && t.type === task.type ? { ...t, status: 'COMPLETED', rating } : t);
          
          return { ...s, units, tasks };
      });
      toast("تم تسجيل الإنجاز بنجاح");
  };

  if (!st) return <div className="boot">جاري التحميل...</div>;

  return (
    <div className="app" dir="rtl">
      <style>{CSS}</style>
      
      <header className="topbar">
        <div className="brand">
          <span className="rosette">۝</span>
          <div><h1>وِرد</h1><p>رفيقك في رحلة الحفظ</p></div>
        </div>
        <div className="streak-badge">
            <b>{ar(st.streak.current)}</b>
            <span>يوم</span>
        </div>
      </header>

      <main className="content">
        {!st.plan ? (
            <PlanWizard onComplete={(planParams) => {
                const generatedTasks = generatePlanTasks(planParams);
                setSt(s => ({ ...s, plan: planParams, tasks: generatedTasks }));
                toast("تم إنشاء خطتك المخصصة");
            }} />
        ) : (
            <>
                {tab === "home" && <HomeScreen st={st} todayTasks={todayTasks} dueReviews={dueReviews} onComplete={handleCompleteTask} />}
                {tab === "plan" && <PlanDetailsScreen st={st} />}
                {tab === "stats" && <StatsScreen st={st} />}
            </>
        )}
      </main>

      {st.plan && (
        <nav className="bottomnav">
            <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}>اليوم</button>
            <button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}>الخطة</button>
            <button className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}>الإحصاء</button>
        </nav>
      )}

      {snack && <div className="snack">{snack}</div>}
    </div>
  );
}

/* ═════════════════════════ شاشة إنشاء الخطة ═════════════════════════ */
function PlanWizard({ onComplete }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        goal: 'part', startSurah: 78, startAyah: 1, endSurah: 114, endAyah: 6,
        level: 'beginner', dailyCapacity: 5,
        mode: 'date', startDate: today(), targetEndDate: addDays(today(), 90),
        dailyAmount: 5,
        schedule: { 0: 'rev', 1: 'mem', 2: 'mem', 3: 'mem', 4: 'mem', 5: 'mem', 6: 'comp' },
        timePerDay: 30
    });

    const next = () => setStep(s => s + 1);
    const prev = () => setStep(s => s - 1);

    return (
        <div className="wizard card">
            <div className="wizard-header">
                <div className="steps-indicator">الخطوة {ar(step)} من 5</div>
                <h2>{
                    step === 1 ? "ماذا تريد أن تحفظ؟" :
                    step === 2 ? "ما هو مستواك؟" :
                    step === 3 ? "مدة الخطة" :
                    step === 4 ? "جدولك الأسبوعي" : "الوقت المتاح"
                }</h2>
            </div>

            <div className="wizard-body">
                {step === 1 && (
                    <div className="step-content">
                        <label>من سورة</label>
                        <select value={form.startSurah} onChange={e => setForm({...form, startSurah: +e.target.value})}>
                            {SURAH_NAMES.map((n, i) => <option key={i} value={i+1}>{ar(i+1)}. {n}</option>)}
                        </select>
                        <label>إلى سورة</label>
                        <select value={form.endSurah} onChange={e => setForm({...form, endSurah: +e.target.value})}>
                            {SURAH_NAMES.map((n, i) => <option key={i} value={i+1}>{ar(i+1)}. {n}</option>)}
                        </select>
                        <p className="hint">اختر النطاق الذي تنوي الالتزام بحفظه في هذه الخطة.</p>
                    </div>
                )}

                {step === 2 && (
                    <div className="step-content">
                        <div className="options-grid">
                            {['beginner', 'intermediate', 'advanced'].map(l => (
                                <button key={l} className={form.level === l ? "opt-btn active" : "opt-btn"} onClick={() => setForm({...form, level: l})}>
                                    {l === 'beginner' ? "مبتدئ" : l === 'intermediate' ? "متوسط" : "متقدم"}
                                </button>
                            ))}
                        </div>
                        <label>كم آية تحفظ عادةً في الجلسة الواحدة؟</label>
                        <input type="number" value={form.dailyCapacity} onChange={e => setForm({...form, dailyCapacity: +e.target.value})} />
                    </div>
                )}

                {step === 3 && (
                    <div className="step-content">
                        <div className="seg-control">
                            <button className={form.mode === 'date' ? "active" : ""} onClick={() => setForm({...form, mode: 'date'})}>تحديد تاريخ الانتهاء</button>
                            <button className={form.mode === 'amount' ? "active" : ""} onClick={() => setForm({...form, mode: 'amount'})}>تحديد مقدار يومي</button>
                        </div>
                        {form.mode === 'date' ? (
                            <>
                                <label>تاريخ الانتهاء المطلوب</label>
                                <input type="date" value={form.targetEndDate} onChange={e => setForm({...form, targetEndDate: e.target.value})} />
                            </>
                        ) : (
                            <>
                                <label>عدد الآيات يومياً</label>
                                <input type="number" value={form.dailyAmount} onChange={e => setForm({...form, dailyAmount: +e.target.value})} />
                            </>
                        )}
                    </div>
                )}

                {step === 4 && (
                    <div className="step-content">
                        <p className="hint">خصص نوع النشاط لكل يوم من أيام الأسبوع:</p>
                        {WEEKDAYS.map((d, i) => (
                            <div key={i} className="day-config">
                                <span>{d}</span>
                                <select value={form.schedule[i]} onChange={e => setForm({...form, schedule: {...form.schedule, [i]: e.target.value}})}>
                                    <option value="mem">حفظ جديد</option>
                                    <option value="rev">مراجعة فقط</option>
                                    <option value="comp">تعويض / تثبيت</option>
                                    <option value="rest">راحة</option>
                                </select>
                            </div>
                        ))}
                    </div>
                )}

                {step === 5 && (
                    <div className="step-content">
                        <label>كم دقيقة تستطيع تخصيصها يومياً؟</label>
                        <select value={form.timePerDay} onChange={e => setForm({...form, timePerDay: +e.target.value})}>
                            <option value={15}>15 دقيقة</option>
                            <option value={30}>30 دقيقة</option>
                            <option value={45}>45 دقيقة</option>
                            <option value={60}>ساعة كاملة</option>
                        </select>
                        <div className="summary-box">
                            <p>سيقوم التطبيق بتقسيم هذه المدة بين الحفظ الجديد والمراجعة.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="wizard-footer">
                {step > 1 && <button className="btn ghost" onClick={prev}>السابق</button>}
                {step < 5 ? (
                    <button className="btn primary" onClick={next}>التالي</button>
                ) : (
                    <button className="btn primary" onClick={() => onComplete(form)}>إنشاء الخطة</button>
                )}
            </div>
        </div>
    );
}

/* ═════════════════════════ شاشة اليوم ═════════════════════════ */
function HomeScreen({ st, todayTasks, dueReviews, onComplete }) {
    return (
        <div className="home-screen">
            <section className="welcome">
                <h2>السلام عليكم،</h2>
                <p>إليك مهامك المقترحة لليوم:</p>
            </section>

            <div className="task-stack">
                {/* 1. المراجعة القريبة والقديمة أولاً */}
                {dueReviews.length > 0 && (
                    <div className="task-group">
                        <h3><span className="dot rev"></span> مراجعة وتثبيت</h3>
                        {dueReviews.slice(0, 3).map(u => (
                            <TaskCard key={u.id} title={unitLabel(u)} subtitle="مراجعة متباعدة" type="rev" onComplete={(r) => onComplete(u, r)} />
                        ))}
                    </div>
                )}

                {/* 2. الحفظ الجديد */}
                {todayTasks.filter(t => t.type === 'NEW_MEMORIZATION').map((t, i) => (
                    <div className="task-group" key={i}>
                        <h3><span className="dot mem"></span> حفظ جديد</h3>
                        <TaskCard 
                            title={`${surahName(t.startSurah)}`} 
                            subtitle={`من آية ${ar(t.startAyah)} إلى ${ar(t.endAyah)}`}
                            type="mem"
                            onComplete={(r) => onComplete(t, r)}
                        />
                    </div>
                ))}

                {todayTasks.length === 0 && dueReviews.length === 0 && (
                    <div className="empty-state">
                        <p>لا توجد مهام مجدولة لليوم. استمتع براحتك أو راجع ما شئت!</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function TaskCard({ title, subtitle, type, onComplete }) {
    const [showActions, setShowActions] = useState(false);
    
    return (
        <div className={`task-card ${type}`}>
            <div className="task-info">
                <h4>{title}</h4>
                <p>{subtitle}</p>
            </div>
            {!showActions ? (
                <button className="btn-start" onClick={() => setShowActions(true)}>ابدأ</button>
            ) : (
                <div className="rating-actions">
                    <button onClick={() => onComplete(4)}>ممتاز</button>
                    <button onClick={() => onComplete(3)}>جيد</button>
                    <button onClick={() => onComplete(2)}>ضعيف</button>
                </div>
            )}
        </div>
    );
}

const unitLabel = (u) => `${surahName(u.surah)} (${ar(u.startAyah)} - ${ar(u.endAyah)})`;

/* ═════════════════════════ شاشة الإحصاء ═════════════════════════ */
function StatsScreen({ st }) {
    const memorizedCount = st.units.length;
    const totalCount = st.tasks.filter(t => t.type === 'NEW_MEMORIZATION').length;
    const progress = Math.round((memorizedCount / Math.max(1, totalCount)) * 100);

    return (
        <div className="stats-screen">
            <div className="card progress-card">
                <h3>إنجاز الخطة</h3>
                <div className="progress-circle">
                    <svg viewBox="0 0 36 36" className="circular-chart">
                        <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="circle" strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <text x="18" y="20.35" className="percentage">{ar(progress)}%</text>
                    </svg>
                </div>
                <div className="stats-summary">
                    <div className="stat-item"><b>{ar(memorizedCount)}</b><span>وحدات تم حفظها</span></div>
                    <div className="stat-item"><b>{ar(totalCount - memorizedCount)}</b><span>متبقي</span></div>
                </div>
            </div>
        </div>
    );
}

/* ═════════════════════════ شاشة تفاصيل الخطة ═════════════════════════ */
function PlanDetailsScreen({ st }) {
    const p = st.plan;
    return (
        <div className="plan-details screen">
            <section className="card">
                <h3>معلومات الخطة</h3>
                <div className="info-row"><span>النطاق:</span> <b>{surahName(p.startSurah)} إلى {surahName(p.endSurah)}</b></div>
                <div className="info-row"><span>تاريخ البداية:</span> <b>{ar(p.startDate)}</b></div>
                <div className="info-row"><span>تاريخ الانتهاء:</span> <b>{ar(p.targetEndDate)}</b></div>
                <div className="info-row"><span>المستوى:</span> <b>{p.level === 'beginner' ? 'مبتدئ' : 'متقدم'}</b></div>
            </section>

            <section className="timeline">
                <h3>الجدول الزمني</h3>
                <div className="task-list-mini">
                    {st.tasks.slice(0, 15).map((t, i) => (
                        <div key={i} className={`mini-task ${t.status}`}>
                            <span className="date">{ar(t.date.split('-').slice(1).join('/'))}</span>
                            <span className="desc">
                                {t.type === 'NEW_MEMORIZATION' ? `حفظ: ${surahName(t.startSurah)}` : 
                                 t.type === 'RECENT_REVISION' ? 'مراجعة قريبة' : 'يوم تعويض'}
                            </span>
                        </div>
                    ))}
                    <p className="hint">... سيتم عرض باقي المهام تباعاً</p>
                </div>
            </section>
        </div>
    );
}

/* ═════════════════════════ التصميم (CSS) ═════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap');

:root {
  --bg: #0E1726;
  --surface: #152139;
  --surface-2: #1D2E4B;
  --primary: #C9A227;
  --primary-soft: #E0C25E;
  --text: #EFE7D5;
  --text-dim: #A8AEBD;
  --mem: #3F8F7E;
  --rev: #5B8FC7;
  --err: #B4574C;
}

body { margin: 0; background: var(--bg); color: var(--text); font-family: 'IBM Plex Sans Arabic', sans-serif; }
.app { min-height: 100vh; padding-bottom: 80px; }

.topbar { display: flex; justify-content: space-between; align-items: center; padding: 20px; }
.brand h1 { font-family: 'Amiri', serif; margin: 0; font-size: 26px; color: var(--primary); }
.rosette { font-size: 32px; margin-left: 10px; color: var(--primary); }
.streak-badge { background: var(--surface-2); padding: 5px 15px; border-radius: 20px; text-align: center; border: 1px solid var(--primary); }
.streak-badge b { display: block; font-size: 18px; line-height: 1; }
.streak-badge span { font-size: 10px; opacity: 0.7; }

.card { background: var(--surface); border-radius: 20px; padding: 20px; border: 1px solid rgba(201,162,39,0.1); }

.wizard-header { margin-bottom: 25px; }
.wizard-header h2 { font-family: 'Amiri', serif; font-size: 24px; margin: 10px 0; }
.steps-indicator { font-size: 12px; color: var(--primary); font-weight: bold; }
.step-content { display: flex; flex-direction: column; gap: 15px; }
.step-content label { font-size: 14px; color: var(--text-dim); }
.step-content select, .step-content input { background: var(--bg); border: 1px solid var(--surface-2); color: white; padding: 12px; border-radius: 10px; font-size: 16px; }

.btn { border: none; padding: 12px 25px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.3s; }
.btn.primary { background: var(--primary); color: #1A1206; }
.btn.ghost { background: transparent; color: var(--text); border: 1px solid var(--surface-2); }
.wizard-footer { display: flex; justify-content: space-between; margin-top: 30px; }

.home-screen { padding: 0 20px; }
.welcome h2 { font-family: 'Amiri', serif; margin-bottom: 5px; }
.task-group h3 { font-size: 14px; color: var(--text-dim); margin: 20px 0 10px; display: flex; align-items: center; gap: 8px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.mem { background: var(--mem); }
.dot.rev { background: var(--rev); }

.task-card { background: var(--surface); border-radius: 15px; padding: 15px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-right: 4px solid var(--primary); }
.task-card.mem { border-right-color: var(--mem); }
.task-card.rev { border-right-color: var(--rev); }
.task-info h4 { margin: 0; font-size: 16px; }
.task-info p { margin: 5px 0 0; font-size: 12px; color: var(--text-dim); }

.btn-start { background: var(--surface-2); border: 1px solid var(--primary); color: var(--primary); padding: 8px 20px; border-radius: 10px; }
.rating-actions { display: flex; gap: 5px; }
.rating-actions button { background: var(--surface-2); border: none; color: white; padding: 8px 10px; border-radius: 8px; font-size: 11px; }

.bottomnav { position: fixed; bottom: 0; left: 0; right: 0; background: var(--surface); display: flex; padding: 15px; border-top: 1px solid var(--surface-2); }
.bottomnav button { flex: 1; background: none; border: none; color: var(--text-dim); font-weight: 600; font-size: 14px; }
.bottomnav button.active { color: var(--primary); }

.circular-chart { display: block; margin: 20px auto; max-width: 150px; }
.circle-bg { fill: none; stroke: var(--surface-2); stroke-width: 2.8; }
.circle { fill: none; stroke: var(--primary); stroke-width: 2.8; stroke-linecap: round; transition: stroke-dasharray 0.3s ease; }
.percentage { fill: white; font-family: 'Amiri', serif; font-size: 0.5em; text-anchor: middle; }

.stats-summary { display: flex; justify-content: space-around; text-align: center; margin-top: 20px; }
.stat-item b { font-size: 22px; color: var(--primary); display: block; }
.stat-item span { font-size: 11px; color: var(--text-dim); }

.snack { position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); background: var(--primary); color: #000; padding: 10px 25px; border-radius: 30px; font-weight: bold; z-index: 1000; }

.day-config { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--surface-2); }
.mini-task { display: flex; gap: 15px; padding: 8px 0; border-bottom: 1px dashed var(--surface-2); font-size: 13px; }
.mini-task.COMPLETED { opacity: 0.5; text-decoration: line-through; }
.mini-task .date { color: var(--primary); font-weight: bold; width: 45px; }

.seg-control { display: flex; background: var(--bg); padding: 5px; border-radius: 12px; margin-bottom: 20px; }
.seg-control button { flex: 1; background: none; border: none; color: var(--text-dim); padding: 10px; border-radius: 8px; font-size: 12px; }
.seg-control button.active { background: var(--surface-2); color: var(--primary); }
`;
