import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   وِرد v5 — منظومة القراءات والأهداف المخصصة
   (أجزاء، أحزاب، أرباع، روايات)
   ══════════════════════════════════════════════════════════════ */

/* ─────────────── DATA: القراءات والروايات ─────────────── */
const READINGS = [
  { id: 'asim', name: 'عاصم الكوفي', active: true },
  { id: 'nafi', name: 'نافع المدني', active: true },
  { id: 'ibn_kathir', name: 'ابن كثير المكي', active: false },
];

const RIWAYAT = [
  { id: 'hafs', readingId: 'asim', name: 'حفص عن عاصم', mushaf: 'مصحف المدينة (حفص)', active: true },
  { id: 'shuba', readingId: 'asim', name: 'شعبة عن عاصم', mushaf: 'مصحف المدينة (شعبة)', active: true },
  { id: 'warsh', readingId: 'nafi', name: 'ورش عن نافع', mushaf: 'مصحف المدينة (ورش)', active: true },
  { id: 'qalun', readingId: 'nafi', name: 'قالون عن نافع', mushaf: 'مصحف المدينة (قالون)', active: true },
];

/* ─────────────── DATA: حدود القرآن (حسب رواية حفص) ─────────────── */
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

// عينة من حدود الأجزاء (للاختصار، سيتم استكمالها برمجياً)
const JUZ_BOUNDARIES = [
    { n: 1, s: 1, a: 1, es: 2, ea: 141 },
    { n: 2, s: 2, a: 142, es: 2, ea: 252 },
    { n: 30, s: 78, a: 1, es: 114, ea: 6 },
    // سيتم توليد الباقي أو استدعاؤه من قاعدة بيانات كاملة
];

/* ─────────────── SERVICE: QuranGoalResolutionService ─────────────── */
const QuranGoalResolutionService = {
    resolve(type, params) {
        let result = { startSurah: 1, startAyah: 1, endSurah: 1, endAyah: 7 };
        
        switch (type) {
            case 'FULL_QURAN':
                result = { startSurah: 1, startAyah: 1, endSurah: 114, endAyah: 6 };
                break;
            case 'SINGLE_JUZ':
                // بحث في جدول الأجزاء
                const juz = JUZ_BOUNDARIES.find(j => j.n === params.juzNumber);
                if (juz) result = { startSurah: juz.s, startAyah: juz.a, endSurah: juz.es, endAyah: juz.ea };
                break;
            case 'SINGLE_SURAH':
                result = { startSurah: params.surahId, startAyah: 1, endSurah: params.surahId, endAyah: AYAH_COUNTS[params.surahId-1] };
                break;
            case 'AYAH_RANGE':
                result = { ...params };
                break;
            default:
                break;
        }
        return result;
    }
};

/* ─────────────── UTILS ─────────────── */
const ar = (n) => n === null || n === undefined ? "" : String(n);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (s, n) => new Date((Math.floor(Date.parse(s + "T00:00:00Z") / 86400000) + n) * 86400000).toISOString().slice(0, 10);

/* ═════════════════════════ UI: المعالج المطور (v5 Wizard) ═════════════════════════ */
function PlanWizardV5({ onComplete }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        readingId: 'asim',
        riwayahId: 'hafs',
        goalType: 'SINGLE_JUZ',
        juzNumber: 30,
        surahId: 1,
        startSurah: 78, startAyah: 1, endSurah: 114, endAyah: 6,
        level: 'beginner',
        dailyCapacity: 5,
        startDate: today(),
        mode: 'date',
        targetEndDate: addDays(today(), 30),
        dailyAmount: 5,
        schedule: { 0: 'rev', 1: 'mem', 2: 'mem', 3: 'mem', 4: 'mem', 5: 'mem', 6: 'comp' }
    });

    const filteredRiwayat = RIWAYAT.filter(r => r.readingId === form.readingId);

    const handleGenerate = () => {
        const resolved = QuranGoalResolutionService.resolve(form.goalType, form);
        onComplete({ ...form, ...resolved });
    };

    return (
        <div className="wizard card">
            <div className="wizard-header">
                <div className="steps-indicator">الخطوة {ar(step)} من 5</div>
                <h2>{
                    step === 1 ? "القراءة والرواية" :
                    step === 2 ? "نوع الهدف" :
                    step === 3 ? "تحديد النطاق" :
                    step === 4 ? "الخطة الزمنية" : "تأكيد البيانات"
                }</h2>
            </div>

            <div className="wizard-body">
                {step === 1 && (
                    <div className="step-content">
                        <label>القراءة</label>
                        <select value={form.readingId} onChange={e => setForm({...form, readingId: e.target.value})}>
                            {READINGS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <label>الرواية</label>
                        <select value={form.riwayahId} onChange={e => setForm({...form, riwayahId: e.target.value})}>
                            {filteredRiwayat.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <div className="info-box">
                            المصحف المعتمد: {RIWAYAT.find(r => r.id === form.riwayahId)?.mushaf}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="step-content">
                        <label>كيف تريد تحديد هدفك؟</label>
                        <div className="options-list">
                            {[
                                { id: 'FULL_QURAN', n: 'القرآن كاملاً' },
                                { id: 'SINGLE_JUZ', n: 'جزء محدد' },
                                { id: 'SINGLE_SURAH', n: 'سورة محددة' },
                                { id: 'AYAH_RANGE', n: 'نطاق آيات مخصص' }
                            ].map(opt => (
                                <button key={opt.id} className={form.goalType === opt.id ? "opt-row active" : "opt-row"} onClick={() => setForm({...form, goalType: opt.id})}>
                                    {opt.n}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="step-content">
                        {form.goalType === 'SINGLE_JUZ' && (
                            <>
                                <label>اختر الجزء</label>
                                <select value={form.juzNumber} onChange={e => setForm({...form, juzNumber: +e.target.value})}>
                                    {Array.from({length: 30}, (_, i) => <option key={i+1} value={i+1}>الجزء {ar(i+1)}</option>)}
                                </select>
                            </>
                        )}
                        {form.goalType === 'SINGLE_SURAH' && (
                            <>
                                <label>اختر السورة</label>
                                <select value={form.surahId} onChange={e => setForm({...form, surahId: +e.target.value})}>
                                    {SURAH_NAMES.map((n, i) => <option key={i+1} value={i+1}>{ar(i+1)}. {n}</option>)}
                                </select>
                            </>
                        )}
                        {form.goalType === 'AYAH_RANGE' && (
                            <>
                                <label>من سورة</label>
                                <select value={form.startSurah} onChange={e => setForm({...form, startSurah: +e.target.value})}>
                                    {SURAH_NAMES.map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
                                </select>
                                <label>إلى سورة</label>
                                <select value={form.endSurah} onChange={e => setForm({...form, endSurah: +e.target.value})}>
                                    {SURAH_NAMES.map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
                                </select>
                            </>
                        )}
                        {form.goalType === 'FULL_QURAN' && <p>لقد اخترت حفظ القرآن الكريم كاملاً. بارك الله لك.</p>}
                    </div>
                )}

                {step === 4 && (
                    <div className="step-content">
                        <div className="seg-control">
                            <button className={form.mode === 'date' ? "active" : ""} onClick={() => setForm({...form, mode: 'date'})}>تحديد تاريخ</button>
                            <button className={form.mode === 'amount' ? "active" : ""} onClick={() => setForm({...form, mode: 'amount'})}>تحديد مقدار</button>
                        </div>
                        {form.mode === 'date' ? (
                            <input type="date" value={form.targetEndDate} onChange={e => setForm({...form, targetEndDate: e.target.value})} />
                        ) : (
                            <input type="number" value={form.dailyAmount} onChange={e => setForm({...form, dailyAmount: +e.target.value})} />
                        )}
                        <p className="hint">اختر أيام الحفظ والمراجعة من الإعدادات لاحقاً.</p>
                    </div>
                )}

                {step === 5 && (
                    <div className="step-content preview">
                        <div className="info-row"><span>الرواية:</span> <b>{RIWAYAT.find(r => r.id === form.riwayahId)?.name}</b></div>
                        <div className="info-row"><span>المصحف:</span> <b>{RIWAYAT.find(r => r.id === form.riwayahId)?.mushaf}</b></div>
                        <div className="info-row"><span>الهدف:</span> <b>{
                            form.goalType === 'FULL_QURAN' ? 'القرآن كاملاً' :
                            form.goalType === 'SINGLE_JUZ' ? `الجزء ${ar(form.juzNumber)}` :
                            form.goalType === 'SINGLE_SURAH' ? `سورة ${SURAH_NAMES[form.surahId-1]}` : 'نطاق مخصص'
                        }</b></div>
                        <div className="info-row"><span>تاريخ البدء:</span> <b>{ar(form.startDate)}</b></div>
                    </div>
                )}
            </div>

            <div className="wizard-footer">
                {step > 1 && <button className="btn ghost" onClick={() => setStep(s => s - 1)}>السابق</button>}
                {step < 5 ? (
                    <button className="btn primary" onClick={() => setStep(s => s + 1)}>التالي</button>
                ) : (
                    <button className="btn primary" onClick={handleGenerate}>تأكيد وإنشاء</button>
                )}
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
    const saved = localStorage.getItem("wird_v5_data");
    if (saved) setSt(JSON.parse(saved));
    else setSt({ plan: null, units: [], tasks: [], streak: { current: 0 } });
  }, []);

  useEffect(() => { if (st) localStorage.setItem("wird_v5_data", JSON.stringify(st)); }, [st]);

  const toast = (m) => { setSnack(m); setTimeout(() => setSnack(null), 3000); };

  if (!st) return <div className="boot">جاري التحميل...</div>;

  return (
    <div className="app" dir="rtl">
      <style>{CSS}</style>
      <header className="topbar">
        <div className="brand"><span className="rosette">۝</span><h1>وِرد v5</h1></div>
        <div className="badge"><b>{ar(st.streak.current)}</b><span>يوم</span></div>
      </header>

      <main className="content">
        {!st.plan ? (
            <PlanWizardV5 onComplete={(plan) => {
                // ملاحظة: هنا سنستخدم خوارزمية التوليد من الإصدار السابق مع النطاقات الجديدة
                setSt({ ...st, plan, tasks: generateTasksStub(plan) });
                toast("تم إنشاء الخطة بنجاح");
            }} />
        ) : (
            <div className="screen">
                <div className="card plan-card">
                    <span className="eyebrow">الخطة النشطة ({RIWAYAT.find(r => r.id === st.plan.riwayahId)?.name})</span>
                    <h3>{st.plan.goalType === 'FULL_QURAN' ? 'ختمة القرآن الكريم' : 'حفظ مقطع محدد'}</h3>
                    <div className="progress-bar"><i style={{width: '10%'}}></i></div>
                </div>
                
                <div className="task-list">
                    <h4>مهام اليوم</h4>
                    {st.tasks.filter(t => t.date === today()).map((t, i) => (
                        <div key={i} className="task-card">
                            <div className="task-main">
                                <b>{SURAH_NAMES[t.startSurah-1]}</b>
                                <span>آية {ar(t.startAyah)} إلى {ar(t.endAyah)}</span>
                            </div>
                            <button className="btn-done">تم</button>
                        </div>
                    ))}
                </div>

                <nav className="bottomnav">
                    <button onClick={() => setTab("home")} className={tab==="home"?"active":""}>اليوم</button>
                    <button onClick={() => setTab("stats")} className={tab==="stats"?"active":""}>الإحصاء</button>
                    <button onClick={() => {localStorage.clear(); location.reload();}}>إعادة</button>
                </nav>
            </div>
        )}
      </main>

      {snack && <div className="snack">{snack}</div>}
    </div>
  );
}

// دالة مؤقتة لتوليد المهام (تعتمد على نفس منطق v4)
function generateTasksStub(p) {
    const tasks = [];
    let d = p.startDate;
    // تبسيط: مهمة واحدة يومياً لمدة 10 أيام للتجربة
    for(let i=0; i<10; i++) {
        tasks.push({
            date: d,
            startSurah: p.startSurah, startAyah: p.startAyah,
            endSurah: p.endSurah, endAyah: p.endAyah,
            type: 'MEM', status: 'PENDING'
        });
        d = addDays(d, 1);
    }
    return tasks;
}

const CSS = `
:root {
  --bg: #0E1726; --surface: #152139; --surface-2: #1D2E4B;
  --primary: #C9A227; --text: #EFE7D5; --text-dim: #A8AEBD;
}
body { margin: 0; background: var(--bg); color: var(--text); font-family: sans-serif; }
.app { min-height: 100vh; padding-bottom: 80px; }
.topbar { display: flex; justify-content: space-between; align-items: center; padding: 20px; }
.brand h1 { margin: 0; font-size: 22px; color: var(--primary); }
.badge { background: var(--surface-2); padding: 5px 15px; border-radius: 15px; text-align: center; }
.card { background: var(--surface); border-radius: 20px; padding: 20px; margin: 15px; border: 1px solid rgba(201,162,39,0.1); }
.wizard-header h2 { font-size: 20px; margin: 10px 0; }
.steps-indicator { font-size: 11px; color: var(--primary); }
.step-content { display: flex; flex-direction: column; gap: 12px; margin: 20px 0; }
.step-content label { font-size: 13px; color: var(--text-dim); }
select, input { background: var(--bg); border: 1px solid var(--surface-2); color: white; padding: 12px; border-radius: 10px; }
.btn { border: none; padding: 12px 25px; border-radius: 12px; font-weight: bold; cursor: pointer; }
.btn.primary { background: var(--primary); color: #1A1206; }
.btn.ghost { background: transparent; color: var(--text); border: 1px solid var(--surface-2); }
.wizard-footer { display: flex; justify-content: space-between; }
.opt-row { background: var(--surface-2); border: 1px solid transparent; color: white; padding: 15px; border-radius: 12px; text-align: right; cursor: pointer; margin-bottom: 8px; width: 100%; }
.opt-row.active { border-color: var(--primary); background: rgba(201,162,39,0.1); }
.info-box { background: rgba(201,162,39,0.05); padding: 10px; border-radius: 10px; font-size: 12px; color: var(--primary); }
.info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed var(--surface-2); }
.task-card { background: var(--surface); padding: 15px; border-radius: 15px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.task-main { display: flex; flex-direction: column; }
.btn-done { background: var(--primary); color: black; border: none; padding: 5px 15px; border-radius: 8px; }
.bottomnav { position: fixed; bottom: 0; left: 0; right: 0; background: var(--surface); display: flex; padding: 15px; border-top: 1px solid var(--surface-2); }
.bottomnav button { flex: 1; background: none; border: none; color: var(--text-dim); font-weight: bold; }
.bottomnav button.active { color: var(--primary); }
.seg-control { display: flex; background: var(--bg); padding: 5px; border-radius: 10px; }
.seg-control button { flex: 1; background: none; border: none; color: white; padding: 8px; border-radius: 8px; }
.seg-control button.active { background: var(--surface-2); color: var(--primary); }
`;
