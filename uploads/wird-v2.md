import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   وِرد v2 — مطابق لمواصفة PRD (الوثائق 00–25)
   الطبقات: Domain (بيانات ومحركات نقية) · Application (الحالة)
            · UI (الشاشات) — بحسب 24_Developer_Guide
   ══════════════════════════════════════════════════════════════ */

/* ─────────────── DOMAIN: بيانات القرآن ─────────────── */
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]; // 6236 آية
// أول سورة في كل جزء (سورة، آية) — لحساب نسبة إتمام الأجزاء
const JUZ_STARTS = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];

const surahName = (n) => SURAH_NAMES[n - 1] || "";
const ayahCount = (n) => AYAH_COUNTS[n - 1] || 0;

function juzOfAyah(surah, ayah) {
  let j = 1;
  for (let i = 0; i < 30; i++) {
    const [s, a] = JUZ_STARTS[i];
    if (surah > s || (surah === s && ayah >= a)) j = i + 1; else break;
  }
  return j;
}

/* ─────────────── DOMAIN: أدوات الزمن ─────────────── */
const AR = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
const ar = (n) => String(n).replace(/\d/g, (d) => AR[+d]);
const clamp = (lo, hi, v) => Math.max(lo, Math.min(hi, v));
const today = () => new Date().toISOString().slice(0, 10);
const dnum = (s) => Math.floor(Date.parse(s + "T00:00:00Z") / 86400000);
const addDays = (s, n) => new Date((dnum(s) + n) * 86400000).toISOString().slice(0, 10);
const diffDays = (a, b) => dnum(a) - dnum(b);
const nowISO = () => new Date().toISOString();
const WEEKDAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const weekdayOf = (ds) => new Date(ds + "T00:00:00Z").getUTCDay();

/* ─────────────── DOMAIN: الحالات (23_State_Machine) ─────────────── */
const STATES = {
  NEW:        { id: "NEW",        ar: "جديدة",     tone: "idle" },
  LEARNING:   { id: "LEARNING",   ar: "قيد الحفظ", tone: "warn" },
  REVIEW:     { id: "REVIEW",     ar: "مراجعة",    tone: "info" },
  STRONG:     { id: "STRONG",     ar: "قوية",      tone: "good" },
  MASTERED:   { id: "MASTERED",   ar: "متقنة",     tone: "best" },
  WEAK:       { id: "WEAK",       ar: "ضعُفت",     tone: "err"  },
  RELEARNING: { id: "RELEARNING", ar: "إعادة",     tone: "err"  },
};

/* ─────────────── DOMAIN: محرك المراجعة (05_Review_Algorithm) ───────────────
   نقي: لا يقرأ حالة عامة ولا يكتبها. المدخلات والمخرجات كما في الوثيقة. */
export function reviewEngine(unit, input, cfg) {
  const { mistakes = 0, confidence = 3, hintUsed = false, elapsedDays = 0 } = input;
  const maxInterval = cfg?.maxInterval ?? 180;

  // 1) الأخطاء أعلى العوامل وزناً
  let q = mistakes === 0 ? 5 : mistakes <= 2 ? 4 : mistakes <= 5 ? 3 : mistakes <= 9 ? 2 : 1;
  if (hintUsed) q -= 1;
  q = clamp(0, 5, q);
  const success = q >= 3;

  const prev = unit.interval || 0;
  // 2) النجاح المتكرر يرفع معامل الثبات · الفشل يخفضه فوراً (12_Business_Rules)
  const stability = success
    ? Math.min(2.8, (unit.stability ?? 1.9) + 0.06 + 0.08 * (q - 3))
    : Math.max(1.3, (unit.stability ?? 1.9) - 0.3);

  // 3) انخفاض الثقة يمنع القفزات الكبيرة
  const growthCap = confidence <= 2 ? 1.3 : confidence === 3 ? 1.8 : 2.6;

  let nextInterval;
  if (!success) nextInterval = 1;
  else if (!unit.reps || prev === 0) nextInterval = 1;
  else {
    let f = Math.min(stability, growthCap);
    if (elapsedDays > prev) f *= 1 + Math.min(0.25, (elapsedDays - prev) / (prev * 6)); // مراجعة متأخرة ونجحت
    nextInterval = Math.max(1, Math.round(prev * f));
  }
  nextInterval = Math.min(maxInterval, nextInterval); // 5) لا يتجاوز حد الخطة

  // المراجعة المبكرة لا تُنقص الإتقان أبداً
  const early = prev > 0 && elapsedDays < prev * 0.6;
  let delta = success ? 5 + q * 2 : -(16 + Math.min(20, mistakes * 2));
  if (early) delta = delta < 0 ? 0 : Math.round(delta * 0.5);
  const mastery = clamp(0, 100, Math.round((unit.mastery || 0) + delta));

  return { success, quality: q, nextInterval, nextReview: addDays(today(), nextInterval), mastery, stability, early };
}

/* ─────────────── DOMAIN: محرك الحالة (04 + 23) — منفصل عن محرك المراجعة (ADR-003) ─────────────── */
export function stateEngine(unit, r) {
  const s = unit.state || "NEW";
  const reps = (unit.reps || 0) + 1;
  if (!r.success) {
    if (s === "MASTERED") return "WEAK";
    if (s === "STRONG") return "WEAK";
    if (s === "WEAK") return "RELEARNING";
    return "RELEARNING";
  }
  if (s === "NEW") return "LEARNING";
  if (s === "LEARNING") return reps >= 2 ? "REVIEW" : "LEARNING";
  if (s === "WEAK" || s === "RELEARNING") return "REVIEW";
  if (s === "REVIEW") return r.mastery >= 60 && r.nextInterval >= 14 ? "STRONG" : "REVIEW";
  if (s === "STRONG") return r.mastery >= 85 && r.nextInterval >= 45 ? "MASTERED" : "STRONG";
  return s; // MASTERED يبقى حتى يقع خطأ
}

/* ─────────────── DOMAIN: الخطة ووحدات الحفظ (03_Domain_Model) ─────────────── */
function buildUnits(surahFrom, surahTo, unitSize) {
  const units = [];
  for (let s = surahFrom; s <= surahTo; s++) {
    const total = ayahCount(s);
    for (let a = 1; a <= total; a += unitSize) {
      const end = Math.min(total, a + unitSize - 1);
      units.push({
        id: `${s}:${a}-${end}`,
        surah: s, startAyah: a, endAyah: end,
        state: "NEW", mastery: 0, stability: 1.9,
        interval: 0, reps: 0, lapses: 0,
        nextReview: null, lastReview: null,
        createdAt: nowISO(), updatedAt: nowISO(),
        attempts: [],
      });
    }
  }
  return units;
}

const unitLabel = (u) => `${surahName(u.surah)} ${ar(u.startAyah)}–${ar(u.endAyah)}`;
const unitAyat = (u) => u.endAyah - u.startAyah + 1;

function workDaysBetween(from, to, restDays) {
  let n = 0;
  for (let d = from; diffDays(to, d) >= 0; d = addDays(d, 1)) if (!restDays.includes(weekdayOf(d))) n++;
  return n;
}

// إعادة حساب الخطة بعد الأيام الفائتة (12_Business_Rules)
function recalcPlan(plan, units) {
  const remaining = units.filter((u) => u.state === "NEW").length;
  if (!plan.targetDate || remaining === 0) return { ...plan, dailyUnits: plan.dailyUnits || 1, remaining };
  const days = Math.max(1, workDaysBetween(today(), plan.targetDate, plan.restDays));
  return { ...plan, dailyUnits: Math.max(1, Math.ceil(remaining / days)), remaining, workDaysLeft: days };
}

/* ─────────────── APPLICATION: الحالة والتخزين ─────────────── */
const KEY = "wird:v2";
const EVENTS_CAP = 300;

const emptyState = () => ({
  version: 2,
  plan: null,
  units: [],
  sessions: [],
  activeSession: null,
  streak: { current: 0, longest: 0, last: null },
  events: [],
  settings: {
    mushaf: "مصحف المدينة", reciter: "",
    debtThreshold: 12, maxInterval: 180,
    sound: true, highContrast: false, textScale: 1,
  },
});

const logEvent = (st, type, payload) => ({
  ...st,
  events: [...st.events, { type, at: nowISO(), payload: payload || null }].slice(-EVENTS_CAP),
});

/* ═════════════════════════ UI: الجذر ═════════════════════════ */
export default function App() {
  const [st, setSt] = useState(null);
  const [tab, setTab] = useState("home");
  const [snack, setSnack] = useState(null);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(KEY);
        setSt(r ? { ...emptyState(), ...JSON.parse(r.value) } : emptyState());
      } catch { setSt(emptyState()); }
    })();
  }, []);

  const timer = useRef(null);
  useEffect(() => {
    if (!st) return;
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await window.storage.set(KEY, JSON.stringify(st)); setSaved(true); }
      catch { setSaved(false); }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [st]);

  const toast = useCallback((m) => { setSnack(m); setTimeout(() => setSnack(null), 2600); }, []);

  const units = st?.units || [];
  const due = useMemo(
    () => units.filter((u) => u.nextReview && diffDays(today(), u.nextReview) >= 0)
               .sort((a, b) => dnum(a.nextReview) - dnum(b.nextReview)),
    [units]
  );
  const debt = due.filter((u) => diffDays(today(), u.nextReview) > 0).length;
  const blocked = due.length > (st?.settings.debtThreshold ?? 12); // 12_Business_Rules

  /* — العمليات — */
  const submitReview = (unitId, input, note) => {
    setSt((s) => {
      const i = s.units.findIndex((u) => u.id === unitId);
      if (i < 0) return s;
      const u = s.units[i];
      const elapsed = u.lastReview ? diffDays(today(), u.lastReview) : 0;
      const r = reviewEngine(u, { ...input, elapsedDays: elapsed }, s.settings);
      const nextState = stateEngine(u, r);
      const upd = {
        ...u,
        state: nextState, mastery: r.mastery, stability: r.stability,
        interval: r.nextInterval, nextReview: r.nextReview, lastReview: today(),
        reps: u.reps + 1, lapses: u.lapses + (r.success ? 0 : 1),
        updatedAt: nowISO(),
        attempts: [...u.attempts, {
          at: nowISO(), mistakes: input.mistakes, confidence: input.confidence,
          hintUsed: input.hintUsed, elapsedDays: elapsed, quality: r.quality,
          intervalBefore: u.interval, intervalAfter: r.nextInterval,
          masteryBefore: u.mastery, masteryAfter: r.mastery,
          stateBefore: u.state, stateAfter: nextState, note: note || "",
        }].slice(-30),
      };
      const units2 = [...s.units]; units2[i] = upd;
      let s2 = { ...s, units: units2 };
      s2 = logEvent(s2, "ReviewSubmitted", { unitId, quality: r.quality, state: nextState });
      if (s2.activeSession) s2 = { ...s2, activeSession: { ...s2.activeSession, reviewed: [...new Set([...s2.activeSession.reviewed, unitId])] } };
      return s2;
    });
  };

  const startSession = () => setSt((s) => logEvent({
    ...s,
    activeSession: { startedAt: nowISO(), date: today(), stage: 0, secsLeft: STAGES[0].min * 60, reviewed: [], learned: [], notes: "" },
  }, "SessionStarted"));

  const patchSession = (patch) => setSt((s) => s.activeSession ? { ...s, activeSession: { ...s.activeSession, ...patch } } : s);

  const advanceStage = () => setSt((s) => {
    if (!s.activeSession) return s;
    const n = s.activeSession.stage + 1;
    const s2 = logEvent(s, "StageCompleted", { stage: STAGES[s.activeSession.stage].id });
    return { ...s2, activeSession: { ...s2.activeSession, stage: n, secsLeft: (STAGES[n]?.min || 0) * 60 } };
  });

  const endSession = (completed) => setSt((s) => {
    if (!s.activeSession) return s;
    const a = s.activeSession;
    let str = s.streak;
    if (completed && str.last !== a.date) {
      const cur = str.last && diffDays(a.date, str.last) === 1 ? str.current + 1 : 1;
      str = { current: cur, longest: Math.max(str.longest, cur), last: a.date };
    }
    const s2 = logEvent({
      ...s, streak: str, activeSession: null,
      sessions: [...s.sessions, { date: a.date, startedAt: a.startedAt, endedAt: nowISO(), completed, reviewed: a.reviewed.length, learned: a.learned.length, notes: a.notes }].slice(-500),
    }, completed ? "SessionCompleted" : "SessionSkipped");
    return s2;
  });

  const createPlan = (p) => setSt((s) => {
    const units = buildUnits(p.surahFrom, p.surahTo, p.unitSize);
    return logEvent({ ...s, plan: recalcPlan({ ...p, createdAt: nowISO() }, units), units }, "PlanCreated", { units: units.length });
  });

  if (!st) return <div className="boot">…يُفتح المصحف</div>;

  const scaleStyle = { fontSize: `${st.settings.textScale * 100}%` };
  const cls = "app" + (st.settings.highContrast ? " hc" : "");

  return (
    <div className={cls} dir="rtl" style={scaleStyle}>
      <style>{CSS}</style>

      <header className="topbar">
        <div className="brand">
          <span className="rosette" aria-hidden="true">۝</span>
          <div>
            <h1>وِرد</h1>
            <p>{WEEKDAYS[new Date().getDay()]} · {saved ? "محفوظ" : "يُحفظ…"}</p>
          </div>
        </div>
        <div className="badge-streak" title="أيام متتالية"><b>{ar(st.streak.current)}</b><span>يوم</span></div>
      </header>

      <main>
        {st.activeSession ? (
          <SessionScreen
            st={st} due={due} onPatch={patchSession} onAdvance={advanceStage}
            onEnd={endSession} onSubmit={submitReview} toast={toast}
            onLearn={(id) => setSt((s) => ({ ...s, activeSession: { ...s.activeSession, learned: [...new Set([...s.activeSession.learned, id])] } }))}
          />
        ) : !st.plan ? (
          <PlanWizard onCreate={createPlan} />
        ) : (
          <>
            {tab === "home" && <Home st={st} due={due} debt={debt} blocked={blocked} onStart={startSession} onSubmit={submitReview} toast={toast} />}
            {tab === "review" && <ReviewScreen st={st} due={due} onSubmit={submitReview} toast={toast} />}
            {tab === "stats" && <Stats st={st} due={due} />}
            {tab === "plan" && <PlanScreen st={st} setSt={setSt} toast={toast} />}
            {tab === "settings" && <SettingsScreen st={st} setSt={setSt} toast={toast} />}
          </>
        )}
      </main>

      {!st.activeSession && st.plan && (
        <nav className="bottomnav" aria-label="التنقل الرئيسي">
          {[["home","اليوم"],["review","المراجعة"],["stats","الإحصاء"],["plan","الخطة"],["settings","الإعدادات"]].map(([id, l]) => (
            <button key={id} className={"navbtn" + (tab === id ? " on" : "")} aria-current={tab === id} onClick={() => setTab(id)}>
              {l}{id === "review" && due.length > 0 && <i className="pill">{ar(due.length)}</i>}
            </button>
          ))}
        </nav>
      )}

      {snack && <div className="snackwrap"><span className="snack" role="status">{snack}</span></div>}
    </div>
  );
}

/* ═════════════════════════ الجلسة (01 §Daily Session) ═════════════════════════ */
const STAGES = [
  { id: "review",   ar: "المراجعة", min: 15, hint: "سمّع المستحق من حفظك قبل أن تفتح المصحف." },
  { id: "read",     ar: "القراءة",  min: 5,  hint: "اقرأ وحدة اليوم بتدبر: المعنى، الوقف، المتشابهات." },
  { id: "memorize", ar: "الحفظ",    min: 15, hint: "كرر المقطع حتى يثبت، ثم اربط المقاطع." },
  { id: "recall",   ar: "الاستدعاء", min: 5, hint: "أغلق المصحف وسمّع. هذه الخطوة هي التي تُثبّت." },
  { id: "link",     ar: "الربط",    min: 5,  hint: "صِل وحدة اليوم بما قبلها دون توقف." },
];

function SessionScreen({ st, due, onPatch, onAdvance, onEnd, onSubmit, onLearn, toast }) {
  const a = st.activeSession;
  const stage = STAGES[a.stage];
  const [running, setRunning] = useState(true);
  const newUnits = useMemo(() => st.units.filter((u) => u.state === "NEW").slice(0, st.plan.dailyUnits || 1), [st.units, st.plan]);
  const blocked = due.length > st.settings.debtThreshold;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => onPatch({ secsLeft: Math.max(0, (a.secsLeft || 0) - 1) }), 1000);
    return () => clearInterval(t);
  }, [running, a.secsLeft]);

  useEffect(() => { if (a.secsLeft === 0 && running) { setRunning(false); if (st.settings.sound) chime(); } }, [a.secsLeft]);

  if (!stage) {
    return (
      <div className="screen center">
        <h2 className="display">تمت الجلسة</h2>
        <p className="muted">راجعت {ar(a.reviewed.length)} وحدة، وأضفت {ar(a.learned.length)} وحدة جديدة.</p>
        <button className="btn primary" onClick={() => { onEnd(true); toast("سُجّلت جلسة اليوم"); }}>احفظ وأغلق</button>
      </div>
    );
  }

  const total = stage.min * 60;
  return (
    <div className="screen">
      <div className="stagerail" role="progressbar" aria-valuenow={a.stage + 1} aria-valuemax={STAGES.length}>
        {STAGES.map((s, i) => <span key={s.id} className={"rail " + (i < a.stage ? "past" : i === a.stage ? "now" : "")} />)}
      </div>

      <header>
        <span className="eyebrow">المرحلة {ar(a.stage + 1)} من {ar(STAGES.length)}</span>
        <h2 className="display">{stage.ar}</h2>
        <p className="muted">{stage.hint}</p>
      </header>

      <Ring secs={a.secsLeft} total={total} running={running}
            onToggle={() => setRunning((r) => !r)} onReset={() => onPatch({ secsLeft: total })} />

      <div className="stagebody">
        {stage.id === "review" && (
          due.length === 0
            ? <p className="muted center">لا مراجعة مستحقة. اقرأ آخر ما حفظت في نافلة.</p>
            : <ul className="unitlist">{due.slice(0, 8).map((u) => <UnitRow key={u.id} u={u} onSubmit={onSubmit} toast={toast} />)}</ul>
        )}

        {(stage.id === "read" || stage.id === "memorize") && (
          blocked
            ? <div className="callout err">دين المراجعة {ar(due.length)} وحدة، وحدّك {ar(st.settings.debtThreshold)}. الحفظ الجديد موقوف حتى تصفّي المراجعة.</div>
            : <div className="center">
                {newUnits.map((u) => (
                  <div key={u.id} className="focus">
                    <h3 className="display">{surahName(u.surah)}</h3>
                    <p className="muted">الآيات {ar(u.startAyah)}–{ar(u.endAyah)} · الجزء {ar(juzOfAyah(u.surah, u.startAyah))} · {st.settings.mushaf}</p>
                  </div>
                ))}
                {st.settings.reciter && <p className="muted">القارئ: {st.settings.reciter}</p>}
              </div>
        )}

        {stage.id === "recall" && (
          blocked ? <div className="callout err">الحفظ الجديد موقوف. عد إلى المراجعة.</div>
          : newUnits.length === 0 ? <p className="muted center">لا وحدات جديدة في الخطة.</p>
          : <ul className="unitlist">
              {newUnits.map((u) => (
                <UnitRow key={u.id} u={u} openDefault firstTime
                         onSubmit={(id, inp, note) => { onSubmit(id, inp, note); onLearn(id); toast(`دخلت ${unitLabel(u)} الجدول`); }} />
              ))}
            </ul>
        )}

        {stage.id === "link" && (
          <div className="center">
            <p className="muted">اقرأ ما حفظته اليوم موصولاً بما قبله دون توقف، ثم أعده من حفظك.</p>
            <textarea className="input" rows="3" placeholder="ملاحظات الجلسة (اختياري)"
                      value={a.notes} onChange={(e) => onPatch({ notes: e.target.value })} />
          </div>
        )}
      </div>

      <div className="stagenav">
        <button className="btn ghost" onClick={() => { onEnd(false); toast("حُفظت الجلسة — تكملها متى شئت"); }}>أوقف مؤقتاً</button>
        <button className="btn primary" onClick={onAdvance}>
          {a.stage === STAGES.length - 1 ? "أنهِ الجلسة" : "المرحلة التالية"}
        </button>
      </div>
    </div>
  );
}

function Ring({ secs, total, running, onToggle, onReset }) {
  const R = 62, C = 2 * Math.PI * R;
  const pct = total ? 1 - secs / total : 0;
  const m = String(Math.floor(secs / 60)).padStart(2, "0"), s = String(secs % 60).padStart(2, "0");
  return (
    <div className="ringwrap">
      <svg viewBox="0 0 150 150" className="ring" aria-hidden="true">
        <circle cx="75" cy="75" r={R} className="ringbg" />
        <circle cx="75" cy="75" r={R} className="ringfg" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
      </svg>
      <div className="ringmid">
        <b aria-label={`بقي ${m} دقيقة و${s} ثانية`}>{ar(`${m}:${s}`)}</b>
        <div className="ringbtns">
          <button onClick={onToggle}>{running ? "إيقاف" : "تشغيل"}</button>
          <button onClick={onReset}>إعادة</button>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════ صف الوحدة + نموذج التسميع ═════════════════════════ */
function UnitRow({ u, onSubmit, toast, openDefault, firstTime }) {
  const [open, setOpen] = useState(!!openDefault);
  const late = u.nextReview ? diffDays(today(), u.nextReview) : 0;
  const stt = STATES[u.state];
  return (
    <li className={"unit" + (late > 0 ? " late" : "")}>
      <button className="unithead" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="mastery" aria-label={`الإتقان ${u.mastery} بالمئة`}>
          <b>{ar(u.mastery)}</b>
        </span>
        <span className="unitmeta">
          <b>{unitLabel(u)}</b>
          <span>
            <i className={"chip " + stt.tone}>{stt.ar}</i>
            {u.nextReview ? (late > 0 ? ` متأخرة ${ar(late)} يوم` : late === 0 ? " مستحقة اليوم" : ` بعد ${ar(-late)} يوم`) : " لم تُسمَّع بعد"}
          </span>
        </span>
        <span className="cta-sm">{open ? "−" : firstTime ? "سمّع" : "راجع"}</span>
      </button>
      {open && <RecallForm u={u} firstTime={firstTime} onSubmit={(inp, note) => { onSubmit(u.id, inp, note); setOpen(false); toast && toast(`سُجّل تسميع ${unitLabel(u)}`); }} />}
    </li>
  );
}

function RecallForm({ u, onSubmit, firstTime }) {
  const [mistakes, setMistakes] = useState(0);
  const [confidence, setConfidence] = useState(4);
  const [hintUsed, setHint] = useState(false);
  const [note, setNote] = useState("");
  const elapsed = u.lastReview ? diffDays(today(), u.lastReview) : 0;
  const preview = reviewEngine(u, { mistakes, confidence, hintUsed, elapsedDays: elapsed }, { maxInterval: 180 });
  const nextState = stateEngine(u, preview);

  return (
    <div className="recall">
      <p className="muted">{firstTime ? "أغلق المصحف وسمّع الوحدة كاملة." : "سمّع من حفظك، ثم صحّح."}</p>

      <label className="lbl">عدد الأخطاء</label>
      <div className="counter">
        <button onClick={() => setMistakes((m) => m + 1)} aria-label="زيادة">+</button>
        <b>{ar(mistakes)}</b>
        <button onClick={() => setMistakes((m) => Math.max(0, m - 1))} aria-label="إنقاص">−</button>
      </div>
      <div className="chipsrow">{[0,1,2,3,5,8,12].map((n) => (
        <button key={n} className={"chipbtn" + (mistakes === n ? " on" : "")} onClick={() => setMistakes(n)}>{ar(n)}</button>
      ))}</div>

      <label className="lbl">درجة الثقة</label>
      <div className="chipsrow">{[1,2,3,4,5].map((c) => (
        <button key={c} className={"chipbtn" + (confidence === c ? " on" : "")} onClick={() => setConfidence(c)}
                aria-pressed={confidence === c}>{ar(c)}</button>
      ))}</div>

      <label className="switch">
        <input type="checkbox" checked={hintUsed} onChange={(e) => setHint(e.target.checked)} />
        <span>احتجت تلقيناً أو نظرة في المصحف</span>
      </label>

      <div className={"verdict " + (preview.success ? "ok" : "no")}>
        {preview.success ? "استدعاء ناجح" : "استدعاء غير ناجح"} · الإتقان {ar(u.mastery)} ← {ar(preview.mastery)} ·
        الحالة {STATES[nextState].ar} · المراجعة القادمة بعد {ar(preview.nextInterval)} يوم
        {preview.early && " · مراجعة مبكرة، لا تُنقص الإتقان"}
      </div>

      <input className="input" value={note} onChange={(e) => setNote(e.target.value)}
             placeholder="أين وقع الخطأ؟ (متشابه، رأس آية، وقف…)" />
      <button className="btn primary wide" onClick={() => onSubmit({ mistakes, confidence, hintUsed }, note)}>سجّل النتيجة</button>

      {u.attempts.length > 0 && (
        <details className="history">
          <summary>السجل ({ar(u.attempts.length)})</summary>
          <ul>{[...u.attempts].reverse().slice(0, 8).map((h, i) => (
            <li key={i}>{ar(h.at.slice(0, 10))} · {ar(h.mistakes)} خطأ · ثقة {ar(h.confidence)} · {STATES[h.stateAfter]?.ar}{h.note ? ` — ${h.note}` : ""}</li>
          ))}</ul>
        </details>
      )}
    </div>
  );
}

/* ═════════════════════════ الرئيسية (08_UI_UX §Home) ═════════════════════════ */
function Home({ st, due, debt, blocked, onStart, onSubmit, toast }) {
  const newUnits = st.units.filter((u) => u.state === "NEW");
  const done = st.units.length - newUnits.length;
  const todayUnits = newUnits.slice(0, st.plan.dailyUnits || 1);
  const restToday = st.plan.restDays.includes(new Date().getDay());

  return (
    <div className="screen">
      <section className="card hero">
        <span className="eyebrow">مهمة اليوم</span>
        {restToday ? (
          <p className="big">يوم راحة في خطتك. المراجعة فقط إن أحببت.</p>
        ) : todayUnits.length === 0 ? (
          <p className="big">أتممت وحدات الخطة كلها. ما بقي إلا الصيانة.</p>
        ) : (
          <ul className="tasklist">{todayUnits.map((u) => (
            <li key={u.id}><b>{surahName(u.surah)}</b> <span>{ar(u.startAyah)}–{ar(u.endAyah)}</span></li>
          ))}</ul>
        )}
        {blocked && <div className="callout err">دين المراجعة {ar(due.length)} وحدة — تجاوز حدّك ({ar(st.settings.debtThreshold)}). الحفظ الجديد موقوف اليوم.</div>}
        <button className="btn primary wide" onClick={onStart}>
          ابدأ جلسة اليوم<span className="sub">{ar(STAGES.reduce((a, s) => a + s.min, 0))} دقيقة · خمس مراحل</span>
        </button>
      </section>

      <section className="statrow">
        <Stat v={ar(due.length)} l="مستحق اليوم" tone={blocked ? "err" : due.length ? "warn" : "good"} />
        <Stat v={ar(debt)} l="متأخر" tone={debt ? "err" : "good"} />
        <Stat v={ar(done)} l="وحدة محفوظة" />
      </section>

      <section className="card">
        <h3>التقدم</h3>
        <Bar value={done} max={st.units.length} />
        <p className="muted">{ar(done)} من {ar(st.units.length)} وحدة · {ar(Math.round((done / Math.max(1, st.units.length)) * 100))}٪</p>
      </section>

      {due.length > 0 && (
        <section className="card">
          <h3>أقرب ما يستحق المراجعة</h3>
          <ul className="unitlist">{due.slice(0, 4).map((u) => <UnitRow key={u.id} u={u} onSubmit={onSubmit} toast={toast} />)}</ul>
        </section>
      )}
    </div>
  );
}

const Stat = ({ v, l, tone }) => <div className={"stat " + (tone || "")}><b>{v}</b><span>{l}</span></div>;
const Bar = ({ value, max }) => (
  <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
    <i style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
  </div>
);

/* ═════════════════════════ المراجعة ═════════════════════════ */
function ReviewScreen({ st, due, onSubmit, toast }) {
  const [f, setF] = useState("due");
  const active = st.units.filter((u) => u.state !== "NEW");
  const shown = f === "due" ? due : f === "weak" ? active.filter((u) => ["WEAK", "RELEARNING"].includes(u.state)).sort((a, b) => a.mastery - b.mastery) : active;

  const dist = Object.keys(STATES).map((k) => ({ k, n: st.units.filter((u) => u.state === k).length }));

  return (
    <div className="screen">
      <div className="seg" role="tablist">
        {[["due", `المستحق ${ar(due.length)}`], ["weak", "الضعيف"], ["all", `الكل ${ar(active.length)}`]].map(([id, l]) => (
          <button key={id} role="tab" aria-selected={f === id} className={f === id ? "on" : ""} onClick={() => setF(id)}>{l}</button>
        ))}
      </div>

      <section className="dist">
        {dist.filter((d) => d.n > 0).map((d) => (
          <span key={d.k} className={"chip " + STATES[d.k].tone}>{STATES[d.k].ar} {ar(d.n)}</span>
        ))}
      </section>

      {shown.length === 0
        ? <div className="card center"><h3>لا شيء هنا الآن</h3><p className="muted">اجعل وقت فراغك نافلةً تقرأ فيها ما حفظت.</p></div>
        : <ul className="unitlist">{shown.slice(0, 60).map((u) => <UnitRow key={u.id} u={u} onSubmit={onSubmit} toast={toast} />)}</ul>}
      {shown.length > 60 && <p className="muted center">عُرضت ٦٠ وحدة من {ar(shown.length)}.</p>}
    </div>
  );
}

/* ═════════════════════════ الإحصاء (13_Analytics) ═════════════════════════ */
function Stats({ st, due }) {
  const active = st.units.filter((u) => u.state !== "NEW");
  const attempts = active.flatMap((u) => u.attempts);
  const avgMistakes = attempts.length ? (attempts.reduce((a, x) => a + x.mistakes, 0) / attempts.length) : 0;
  const retention = attempts.length ? Math.round((attempts.filter((a) => a.quality >= 3).length / attempts.length) * 100) : 0;
  const weakest = [...active].sort((a, b) => a.mastery - b.mastery).slice(0, 5);

  // خريطة حرارية لآخر ١٢ أسبوعاً
  const cells = useMemo(() => {
    const byDate = {};
    st.sessions.forEach((s) => { byDate[s.date] = (byDate[s.date] || 0) + (s.completed ? 1 : 0); });
    const out = [];
    for (let i = 83; i >= 0; i--) {
      const d = addDays(today(), -i);
      out.push({ d, n: byDate[d] || 0 });
    }
    return out;
  }, [st.sessions]);

  const juz = useMemo(() => {
    const tot = {}, don = {};
    st.units.forEach((u) => {
      const j = juzOfAyah(u.surah, u.startAyah);
      tot[j] = (tot[j] || 0) + 1;
      if (u.state !== "NEW") don[j] = (don[j] || 0) + 1;
    });
    return Array.from({ length: 30 }, (_, i) => ({ j: i + 1, t: tot[i + 1] || 0, d: don[i + 1] || 0 }));
  }, [st.units]);

  const completion = st.sessions.length ? Math.round((st.sessions.filter((s) => s.completed).length / st.sessions.length) * 100) : 0;

  return (
    <div className="screen">
      <section className="statrow">
        <Stat v={ar(retention) + "٪"} l="نجاح الاستدعاء" tone={retention >= 80 ? "good" : "warn"} />
        <Stat v={ar(st.streak.longest)} l="أطول تتابع" />
        <Stat v={ar(avgMistakes.toFixed(1))} l="متوسط الأخطاء" />
      </section>

      <section className="card">
        <h3>الالتزام — آخر اثني عشر أسبوعاً</h3>
        <div className="heat" aria-label="خريطة الالتزام اليومي">
          {cells.map((c) => <i key={c.d} className={"hcell l" + Math.min(3, c.n)} title={`${c.d}: ${c.n} جلسة`} />)}
        </div>
        <p className="muted">إتمام الجلسات {ar(completion)}٪ · دين المراجعة {ar(due.length)} وحدة</p>
      </section>

      <section className="card">
        <h3>توزيع الإتقان</h3>
        <div className="masterybars">
          {[["MASTERED","متقنة"],["STRONG","قوية"],["REVIEW","مراجعة"],["LEARNING","قيد الحفظ"],["WEAK","ضعُفت"],["RELEARNING","إعادة"]].map(([k, l]) => {
            const n = st.units.filter((u) => u.state === k).length;
            return (
              <div key={k} className="mrow">
                <span>{l}</span>
                <Bar value={n} max={Math.max(1, active.length)} />
                <b>{ar(n)}</b>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h3>إتمام الأجزاء</h3>
        <div className="juzgrid">
          {juz.map((x) => (
            <div key={x.j} className="juzcell" title={`الجزء ${x.j}: ${x.d}/${x.t}`}>
              <i style={{ height: `${x.t ? (x.d / x.t) * 100 : 0}%` }} />
              <span>{ar(x.j)}</span>
            </div>
          ))}
        </div>
      </section>

      {weakest.length > 0 && (
        <section className="card">
          <h3>أضعف الوحدات</h3>
          <ul className="weaklist">
            {weakest.map((u) => (
              <li key={u.id}>
                <b>{unitLabel(u)}</b>
                <span className="muted">إتقان {ar(u.mastery)} · تعثّر {ar(u.lapses)} مرة</span>
                {u.attempts.filter((a) => a.note).slice(-1).map((a, i) => <em key={i}>{a.note}</em>)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ═════════════════════════ الخطة ═════════════════════════ */
function PlanWizard({ onCreate }) {
  const [surahFrom, setFrom] = useState(78);
  const [surahTo, setTo] = useState(114);
  const [unitSize, setSize] = useState(8);
  const [targetDate, setDate] = useState(addDays(today(), 120));
  const [restDays, setRest] = useState([5]);
  const count = useMemo(() => {
    let n = 0;
    for (let s = Math.min(surahFrom, surahTo); s <= Math.max(surahFrom, surahTo); s++) n += Math.ceil(ayahCount(s) / unitSize);
    return n;
  }, [surahFrom, surahTo, unitSize]);
  const days = Math.max(1, workDaysBetween(today(), targetDate, restDays));

  return (
    <div className="screen">
      <section className="card hero">
        <span className="eyebrow">الخطوة الأولى</span>
        <h2 className="display">أنشئ خطتك</h2>
        <p className="muted">الخطة تحدد ماذا تحفظ، ومتى تنتهي، وكم وحدة في اليوم. تُعاد الحسبة تلقائياً كلما فاتك يوم.</p>

        <label className="field"><span>من سورة</span>
          <select value={surahFrom} onChange={(e) => setFrom(+e.target.value)}>
            {SURAH_NAMES.map((n, i) => <option key={i} value={i + 1}>{ar(i + 1)}. {n}</option>)}
          </select>
        </label>
        <label className="field"><span>إلى سورة</span>
          <select value={surahTo} onChange={(e) => setTo(+e.target.value)}>
            {SURAH_NAMES.map((n, i) => <option key={i} value={i + 1}>{ar(i + 1)}. {n}</option>)}
          </select>
        </label>
        <label className="field"><span>حجم الوحدة (آيات)</span>
          <input type="number" min="1" max="30" value={unitSize} onChange={(e) => setSize(clamp(1, 30, +e.target.value || 1))} />
        </label>
        <label className="field"><span>تاريخ الانتهاء المستهدف</span>
          <input type="date" value={targetDate} min={today()} onChange={(e) => setDate(e.target.value)} />
        </label>

        <span className="lbl">أيام الراحة</span>
        <div className="chipsrow">
          {WEEKDAYS.map((d, i) => (
            <button key={i} className={"chipbtn" + (restDays.includes(i) ? " on" : "")}
                    onClick={() => setRest((r) => r.includes(i) ? r.filter((x) => x !== i) : [...r, i])}>{d}</button>
          ))}
        </div>

        <div className="callout">
          {ar(count)} وحدة · {ar(days)} يوم عمل · <b>{ar(Math.max(1, Math.ceil(count / days)))} وحدة يومياً</b>
        </div>

        <button className="btn primary wide" disabled={surahTo < surahFrom || diffDays(targetDate, today()) <= 0}
                onClick={() => onCreate({ surahFrom: Math.min(surahFrom, surahTo), surahTo: Math.max(surahFrom, surahTo), unitSize, targetDate, restDays })}>
          أنشئ الخطة
        </button>
        {diffDays(targetDate, today()) <= 0 && <p className="muted err-text">اختر تاريخاً بعد اليوم.</p>}
      </section>
    </div>
  );
}

function PlanScreen({ st, setSt, toast }) {
  const p = st.plan;
  const newUnits = st.units.filter((u) => u.state === "NEW").length;
  const days = p.targetDate ? Math.max(0, diffDays(p.targetDate, today())) : 0;
  const [confirm, setConfirm] = useState(false);

  const recalc = () => setSt((s) => logEvent({ ...s, plan: recalcPlan(s.plan, s.units) }, "PlanUpdated"));
  const setTarget = (d) => setSt((s) => logEvent({ ...s, plan: recalcPlan({ ...s.plan, targetDate: d }, s.units) }, "PlanUpdated", { targetDate: d }));

  return (
    <div className="screen">
      <section className="card">
        <h3>خطتك الحالية</h3>
        <dl className="kv">
          <div><dt>النطاق</dt><dd>{surahName(p.surahFrom)} ← {surahName(p.surahTo)}</dd></div>
          <div><dt>حجم الوحدة</dt><dd>{ar(p.unitSize)} آيات</dd></div>
          <div><dt>الوحدات المتبقية</dt><dd>{ar(newUnits)} من {ar(st.units.length)}</dd></div>
          <div><dt>الوِرد اليومي</dt><dd>{ar(p.dailyUnits || 1)} وحدة</dd></div>
          <div><dt>المتبقي</dt><dd>{ar(days)} يوماً</dd></div>
          <div><dt>أيام الراحة</dt><dd>{p.restDays.length ? p.restDays.map((d) => WEEKDAYS[d]).join("، ") : "لا شيء"}</dd></div>
        </dl>
        <label className="field"><span>تاريخ الانتهاء</span>
          <input type="date" value={p.targetDate} min={today()} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <button className="btn ghost wide" onClick={() => { recalc(); toast("أُعيد حساب الوِرد اليومي"); }}>أعد حساب الخطة</button>
        <p className="muted">إعادة الحساب توزّع ما تبقى على أيام العمل حتى التاريخ المستهدف، ولا تمس الوحدات المكتملة.</p>
      </section>

      <section className="card danger">
        <h3>خطة جديدة</h3>
        <p className="muted">إنشاء خطة جديدة يبني وحدات جديدة ويمسح سجل المراجعة الحالي. صدّر نسخة احتياطية أولاً.</p>
        {confirm ? (
          <div className="row">
            <button className="btn ghost" onClick={() => setConfirm(false)}>تراجع</button>
            <button className="btn danger" onClick={() => { setSt((s) => ({ ...emptyState(), settings: s.settings, streak: s.streak })); toast("امسح — ابدأ خطة جديدة"); }}>احذف وابدأ</button>
          </div>
        ) : <button className="btn ghost" onClick={() => setConfirm(true)}>ابدأ خطة جديدة</button>}
      </section>
    </div>
  );
}

/* ═════════════════════════ الإعدادات والنسخ الاحتياطي ═════════════════════════ */
function SettingsScreen({ st, setSt, toast }) {
  const s = st.settings;
  const set = (k, v) => setSt((x) => ({ ...x, settings: { ...x.settings, [k]: v } }));
  const [payload, setPayload] = useState("");

  const doExport = () => {
    const json = JSON.stringify(st);
    setPayload(json);
    try {
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `wird-backup-${today()}.json`; a.click();
      URL.revokeObjectURL(url);
      toast("صُدّرت نسخة احتياطية");
    } catch { toast("انسخ النص أدناه واحفظه"); }
    setSt((x) => logEvent(x, "BackupExported"));
  };

  const doImport = () => {
    try {
      const data = JSON.parse(payload);
      if (!data.units || !Array.isArray(data.units)) throw new Error("bad");
      setSt(logEvent({ ...emptyState(), ...data }, "BackupImported"));
      toast("استُوردت النسخة");
    } catch { toast("النص ليس نسخة وِرد صحيحة"); }
  };

  return (
    <div className="screen">
      <section className="card">
        <h3>الثبات</h3>
        <label className="field"><span>المصحف</span><input value={s.mushaf} onChange={(e) => set("mushaf", e.target.value)} /></label>
        <label className="field"><span>القارئ</span><input value={s.reciter} onChange={(e) => set("reciter", e.target.value)} placeholder="القارئ الذي تلازمه" /></label>
        <p className="muted">مصحف واحد وقارئ واحد لكل خطة — الذاكرة تحفظ مواضع الآيات وصوتها.</p>
      </section>

      <section className="card">
        <h3>محرك المراجعة</h3>
        <label className="field"><span>حد دين المراجعة</span>
          <input type="number" min="3" max="80" value={s.debtThreshold} onChange={(e) => set("debtThreshold", clamp(3, 80, +e.target.value || 12))} />
        </label>
        <label className="field"><span>أقصى فاصل (يوم)</span>
          <input type="number" min="14" max="365" value={s.maxInterval} onChange={(e) => set("maxInterval", clamp(14, 365, +e.target.value || 180))} />
        </label>
        <label className="switch"><input type="checkbox" checked={s.sound} onChange={(e) => set("sound", e.target.checked)} /><span>تنبيه صوتي عند انتهاء المرحلة</span></label>
      </section>

      <section className="card">
        <h3>إمكانية الوصول</h3>
        <label className="switch"><input type="checkbox" checked={s.highContrast} onChange={(e) => set("highContrast", e.target.checked)} /><span>تباين عالٍ</span></label>
        <span className="lbl">حجم النص</span>
        <div className="chipsrow">
          {[[0.9,"صغير"],[1,"عادي"],[1.15,"كبير"],[1.3,"أكبر"]].map(([v, l]) => (
            <button key={v} className={"chipbtn" + (s.textScale === v ? " on" : "")} onClick={() => set("textScale", v)}>{l}</button>
          ))}
        </div>
        <p className="muted">التطبيق يحترم تفضيل تقليل الحركة في نظامك، ويدعم التنقل بلوحة المفاتيح.</p>
      </section>

      <section className="card">
        <h3>النسخ الاحتياطي</h3>
        <div className="row">
          <button className="btn ghost" onClick={doExport}>صدّر</button>
          <button className="btn ghost" onClick={doImport} disabled={!payload.trim()}>استورد</button>
        </div>
        <textarea className="input mono" rows="4" value={payload} onChange={(e) => setPayload(e.target.value)}
                  placeholder="الصق هنا محتوى ملف النسخة الاحتياطية للاستيراد، أو اضغط «صدّر» لتوليده." />
        <p className="muted">الاستيراد يستبدل بياناتك الحالية بالكامل. لا يُحذف شيء تلقائياً دون فعلك.</p>
      </section>
    </div>
  );
}

function chime() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = 528;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, c.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.3);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 1.4);
  } catch { /* الصوت غير متاح */ }
}

/* ═════════════════════════ Design System (19) ═════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap');

.app{
  --bg:#0E1726; --surface:#152139; --surface-2:#1D2E4B;
  --primary:#C9A227; --primary-soft:#E0C25E;
  --success:#3F8F7E; --warning:#D9A441; --error:#B4574C; --info:#5B8FC7;
  --text:#EFE7D5; --text-dim:#A8AEBD; --line:rgba(201,162,39,.18);
  font-family:'IBM Plex Sans Arabic',system-ui,sans-serif;
  background:radial-gradient(120% 60% at 50% 0%,#1B2B47 0%,transparent 60%),var(--bg);
  color:var(--text);min-height:100vh;padding-bottom:92px
}
.app.hc{--text:#FFFFFF;--text-dim:#D5DAE3;--surface:#0A1120;--surface-2:#132038;--line:rgba(255,255,255,.45)}
.app *{box-sizing:border-box}
.app button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.app button:disabled{opacity:.45;cursor:not-allowed}
.app :focus-visible{outline:3px solid var(--primary);outline-offset:2px;border-radius:8px}
.boot{min-height:100vh;display:grid;place-items:center;background:#0E1726;color:#EFE7D5;font-family:'Amiri',serif;font-size:20px}

.topbar{display:flex;justify-content:space-between;align-items:center;padding:18px 16px 10px}
.brand{display:flex;gap:12px;align-items:center}
.brand h1{font-family:'Amiri',serif;font-size:26px;margin:0}
.brand p{margin:2px 0 0;font-size:11px;color:var(--text-dim)}
.rosette{font-family:'Amiri',serif;font-size:36px;color:var(--primary);line-height:1}
.badge-streak{text-align:center;border:1px solid var(--line);border-radius:14px;padding:7px 13px;background:rgba(201,162,39,.06)}
.badge-streak b{display:block;font-family:'Amiri',serif;font-size:22px;color:var(--primary-soft);line-height:1}
.badge-streak span{font-size:10px;color:var(--text-dim)}

.screen{padding:6px 16px 24px;display:flex;flex-direction:column;gap:16px;max-width:640px;margin:0 auto}
.screen.center,.center{text-align:center}
.display{font-family:'Amiri',serif;font-size:28px;margin:6px 0 8px}
.eyebrow{font-size:11px;letter-spacing:2px;color:var(--primary)}
.muted{color:var(--text-dim);font-size:13px;line-height:1.8;margin:6px 0 0}
.err-text{color:var(--error)}
.lbl{display:block;font-size:12px;color:var(--text-dim);margin:14px 0 6px}

.card{border:1px solid var(--line);border-radius:18px;padding:16px;background:var(--surface)}
.card h3{font-family:'Amiri',serif;font-size:19px;margin:0 0 12px}
.card.hero{background:linear-gradient(180deg,rgba(201,162,39,.08),rgba(255,255,255,0))}
.card.danger{border-color:rgba(180,87,76,.35)}
.big{font-size:16px;line-height:1.9;margin:10px 0}

.btn{padding:12px 18px;border-radius:14px;font-size:15px;font-weight:500;transition:transform .15s}
.btn.wide{display:block;width:100%;margin-top:12px}
.btn.primary{background:var(--primary);color:#1A1206}
.btn.primary:hover:not(:disabled){transform:translateY(-1px)}
.btn.ghost{border:1px solid var(--line);color:var(--text-dim)}
.btn.danger{background:var(--error);color:#fff}
.btn .sub{display:block;font-size:11px;opacity:.75;font-weight:400;margin-top:3px}
.row{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap}

.tasklist{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
.tasklist li{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px dashed var(--line);padding-bottom:6px}
.tasklist b{font-family:'Amiri',serif;font-size:20px}
.tasklist span{font-size:13px;color:var(--text-dim)}

.callout{margin-top:12px;padding:11px 13px;border-radius:12px;background:rgba(201,162,39,.1);border:1px solid var(--line);font-size:13px;line-height:1.7}
.callout.err{background:rgba(180,87,76,.15);border-color:rgba(180,87,76,.4)}

.statrow{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.stat{border:1px solid var(--line);border-radius:14px;padding:13px 8px;text-align:center;background:var(--surface)}
.stat b{display:block;font-family:'Amiri',serif;font-size:26px;color:var(--primary-soft);line-height:1}
.stat span{font-size:11px;color:var(--text-dim)}
.stat.err b{color:var(--error)} .stat.good b{color:var(--success)} .stat.warn b{color:var(--warning)}

.bar{height:8px;border-radius:6px;background:rgba(239,231,213,.1);overflow:hidden}
.bar i{display:block;height:100%;background:var(--primary);border-radius:6px;transition:width .4s}

/* الوحدات */
.unitlist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.unit{border:1px solid var(--line);border-radius:14px;background:var(--surface-2);overflow:hidden}
.unit.late{border-color:rgba(180,87,76,.5)}
.unithead{display:flex;align-items:center;gap:11px;width:100%;padding:11px 12px;text-align:right}
.mastery{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;border:2px solid var(--line);background:rgba(0,0,0,.2)}
.mastery b{font-family:'Amiri',serif;font-size:15px;color:var(--primary-soft)}
.unitmeta{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.unitmeta>b{font-size:14px}
.unitmeta>span{font-size:11px;color:var(--text-dim);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cta-sm{flex:none;font-size:12px;color:var(--primary);border:1px solid var(--line);border-radius:20px;padding:5px 12px}
.chip{font-style:normal;font-size:10px;border-radius:20px;padding:2px 8px;border:1px solid var(--line)}
.chip.good{color:var(--success);border-color:rgba(63,143,126,.5)}
.chip.best{color:var(--primary-soft);border-color:rgba(224,194,94,.5)}
.chip.info{color:var(--info);border-color:rgba(91,143,199,.5)}
.chip.warn{color:var(--warning);border-color:rgba(217,164,65,.5)}
.chip.err{color:var(--error);border-color:rgba(180,87,76,.5)}
.chip.idle{color:var(--text-dim)}
.dist{display:flex;gap:6px;flex-wrap:wrap}

/* نموذج الاستدعاء */
.recall{padding:14px;border-top:1px solid var(--line);background:rgba(0,0,0,.16)}
.counter{display:flex;align-items:center;justify-content:center;gap:18px}
.counter b{font-family:'Amiri',serif;font-size:40px;color:var(--primary-soft);min-width:56px;text-align:center;line-height:1}
.counter button{width:42px;height:42px;border-radius:50%;border:1px solid var(--line);font-size:20px}
.chipsrow{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.chipbtn{padding:6px 13px;border-radius:20px;border:1px solid var(--line);font-size:13px;color:var(--text-dim)}
.chipbtn.on{background:var(--primary);color:#1A1206;border-color:var(--primary)}
.verdict{margin:14px 0;padding:10px;border-radius:12px;font-size:12px;line-height:1.8;text-align:center;border:1px solid var(--line)}
.verdict.ok{color:var(--success);border-color:rgba(63,143,126,.4)}
.verdict.no{color:var(--error);border-color:rgba(180,87,76,.4)}
.input{width:100%;padding:11px 12px;border-radius:12px;background:var(--bg);border:1px solid var(--line);color:var(--text);font-size:13px;font-family:inherit;margin-bottom:10px}
.input.mono{font-family:ui-monospace,monospace;direction:ltr;text-align:left;font-size:11px}
.input::placeholder{color:rgba(168,174,189,.6)}
.switch{display:flex;align-items:center;gap:10px;padding:10px 0;font-size:13px}
.switch input{width:18px;height:18px;accent-color:var(--primary);flex:none}
.history{margin-top:12px;font-size:12px;color:var(--text-dim)}
.history summary{cursor:pointer;color:var(--primary)}
.history ul{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:5px;line-height:1.7}

/* الجلسة */
.stagerail{display:flex;gap:5px}
.rail{flex:1;height:3px;border-radius:2px;background:rgba(239,231,213,.14)}
.rail.past{background:var(--success)} .rail.now{background:var(--primary)}
.ringwrap{position:relative;width:186px;margin:0 auto}
.ring{width:186px;height:186px;transform:rotate(-90deg)}
.ringbg{fill:none;stroke:rgba(239,231,213,.1);stroke-width:5}
.ringfg{fill:none;stroke:var(--primary);stroke-width:5;stroke-linecap:round;transition:stroke-dashoffset 1s linear}
.ringmid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
.ringmid b{font-family:'Amiri',serif;font-size:36px}
.ringbtns{display:flex;gap:6px}
.ringbtns button{font-size:11px;padding:5px 12px;border-radius:20px;border:1px solid var(--line);color:var(--text-dim)}
.focus{margin-bottom:10px}
.stagenav{display:flex;justify-content:space-between;gap:10px;position:sticky;bottom:14px}

/* الإحصاء */
.heat{display:grid;grid-template-columns:repeat(12,1fr);grid-auto-rows:1fr;gap:3px;direction:ltr}
.hcell{display:block;padding-top:100%;border-radius:2px;background:rgba(239,231,213,.08)}
.hcell.l1{background:rgba(201,162,39,.45)}
.hcell.l2{background:rgba(201,162,39,.75)}
.hcell.l3{background:var(--success)}
.masterybars{display:flex;flex-direction:column;gap:9px}
.mrow{display:grid;grid-template-columns:74px 1fr 32px;align-items:center;gap:9px;font-size:12px}
.mrow b{font-family:'Amiri',serif;color:var(--primary-soft);text-align:left}
.juzgrid{display:grid;grid-template-columns:repeat(15,1fr);gap:4px}
.juzcell{height:46px;border:1px solid var(--line);border-radius:5px;position:relative;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden}
.juzcell i{display:block;background:var(--primary);opacity:.65;transition:height .4s}
.juzcell span{position:absolute;inset:0;display:grid;place-items:center;font-size:9px;font-family:'Amiri',serif;color:var(--text)}
.weaklist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}
.weaklist li{display:flex;flex-direction:column;gap:3px}
.weaklist b{font-size:14px}
.weaklist em{font-style:normal;font-size:11px;color:var(--primary-soft);border:1px solid var(--line);border-radius:8px;padding:3px 8px;align-self:flex-start}

/* الخطة */
.field{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.field span{font-size:13px;flex:1}
.field input,.field select{width:150px;padding:9px 10px;border-radius:10px;background:var(--bg);border:1px solid var(--line);color:var(--text);font-family:inherit;font-size:13px}
.kv{margin:0;display:flex;flex-direction:column;gap:8px}
.kv div{display:flex;justify-content:space-between;gap:10px;font-size:13px;border-bottom:1px dashed var(--line);padding-bottom:7px}
.kv dt{color:var(--text-dim)} .kv dd{margin:0}

.seg{display:flex;gap:5px;border:1px solid var(--line);border-radius:14px;padding:4px}
.seg button{flex:1;padding:9px 4px;border-radius:10px;font-size:12px;color:var(--text-dim)}
.seg button.on{background:rgba(201,162,39,.16);color:var(--primary-soft)}

.bottomnav{position:fixed;bottom:0;right:0;left:0;display:flex;background:rgba(14,23,38,.95);backdrop-filter:blur(12px);border-top:1px solid var(--line);padding:8px 5px calc(8px + env(safe-area-inset-bottom))}
.navbtn{flex:1;padding:10px 2px;font-size:11.5px;color:var(--text-dim);position:relative;border-radius:10px}
.navbtn.on{color:var(--primary-soft)}
.pill{position:absolute;top:1px;left:50%;transform:translateX(-130%);background:var(--error);color:#fff;font-size:9px;font-style:normal;border-radius:10px;padding:1px 5px}

.snackwrap{position:fixed;bottom:100px;right:0;left:0;text-align:center;z-index:60;pointer-events:none}
.snack{display:inline-block;background:var(--primary);color:#1A1206;padding:10px 18px;border-radius:20px;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,.4)}

@media (max-width:380px){ .juzgrid{grid-template-columns:repeat(10,1fr)} }
@media (prefers-reduced-motion:reduce){ .app *{transition:none!important;animation:none!important} }
`;
