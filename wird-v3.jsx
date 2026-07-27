import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   وِرد v3 — مطابق لمواصفة PRD مع تحسينات في إدارة الخطة (Khatma Plan)
   ══════════════════════════════════════════════════════════════ */

/* ─────────────── DOMAIN: بيانات القرآن ─────────────── */
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
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
const ar = (n) => {
    if (n === null || n === undefined) return "";
    return String(n);
};
const clamp = (lo, hi, v) => Math.max(lo, Math.min(hi, v));
const today = () => new Date().toISOString().slice(0, 10);
const dnum = (s) => Math.floor(Date.parse(s + "T00:00:00Z") / 86400000);
const addDays = (s, n) => {
    if (isNaN(n) || !isFinite(n)) return s;
    return new Date((dnum(s) + n) * 86400000).toISOString().slice(0, 10);
};
const diffDays = (a, b) => dnum(a) - dnum(b);
const nowISO = () => new Date().toISOString();
const WEEKDAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const weekdayOf = (ds) => new Date(ds + "T00:00:00Z").getUTCDay();

/* ─────────────── DOMAIN: الحالات ─────────────── */
const STATES = {
  NEW:        { id: "NEW",        ar: "جديدة",     tone: "idle" },
  LEARNING:   { id: "LEARNING",   ar: "قيد الحفظ", tone: "warn" },
  REVIEW:     { id: "REVIEW",     ar: "مراجعة",    tone: "info" },
  STRONG:     { id: "STRONG",     ar: "قوية",      tone: "good" },
  MASTERED:   { id: "MASTERED",   ar: "متقنة",     tone: "best" },
  WEAK:       { id: "WEAK",       ar: "ضعُفت",     tone: "err"  },
  RELEARNING: { id: "RELEARNING", ar: "إعادة",     tone: "err"  },
};

/* ─────────────── DOMAIN: محركات ─────────────── */
export function reviewEngine(unit, input, cfg) {
  const { mistakes = 0, confidence = 3, hintUsed = false, elapsedDays = 0 } = input;
  const maxInterval = cfg?.maxInterval ?? 180;
  let q = mistakes === 0 ? 5 : mistakes <= 2 ? 4 : mistakes <= 5 ? 3 : mistakes <= 9 ? 2 : 1;
  if (hintUsed) q -= 1;
  q = clamp(0, 5, q);
  const success = q >= 3;
  const prev = unit.interval || 0;
  const stability = success
    ? Math.min(2.8, (unit.stability ?? 1.9) + 0.06 + 0.08 * (q - 3))
    : Math.max(1.3, (unit.stability ?? 1.9) - 0.3);
  const growthCap = confidence <= 2 ? 1.3 : confidence === 3 ? 1.8 : 2.6;
  let nextInterval;
  if (!success) nextInterval = 1;
  else if (!unit.reps || prev === 0) nextInterval = 1;
  else {
    let f = Math.min(stability, growthCap);
    if (elapsedDays > prev) f *= 1 + Math.min(0.25, (elapsedDays - prev) / (prev * 6));
    nextInterval = Math.max(1, Math.round(prev * f));
  }
  nextInterval = Math.min(maxInterval, nextInterval);
  const early = prev > 0 && elapsedDays < prev * 0.6;
  let delta = success ? 5 + q * 2 : -(16 + Math.min(20, mistakes * 2));
  if (early) delta = delta < 0 ? 0 : Math.round(delta * 0.5);
  const mastery = clamp(0, 100, Math.round((unit.mastery || 0) + delta));
  return { success, quality: q, nextInterval, nextReview: addDays(today(), nextInterval), mastery, stability, early };
}

export function stateEngine(unit, r) {
  const s = unit.state || "NEW";
  const reps = (unit.reps || 0) + 1;
  if (!r.success) return (s === "MASTERED" || s === "STRONG") ? "WEAK" : "RELEARNING";
  if (s === "NEW") return "LEARNING";
  if (s === "LEARNING") return reps >= 2 ? "REVIEW" : "LEARNING";
  if (s === "WEAK" || s === "RELEARNING") return "REVIEW";
  if (s === "REVIEW") return r.mastery >= 60 && r.nextInterval >= 14 ? "STRONG" : "REVIEW";
  if (s === "STRONG") return r.mastery >= 85 && r.nextInterval >= 45 ? "MASTERED" : "STRONG";
  return s;
}

/* ─────────────── DOMAIN: الخطة ─────────────── */
function buildUnits(surahFrom, surahTo, unitSize) {
  const units = [];
  for (let s = surahFrom; s <= surahTo; s++) {
    const total = ayahCount(s);
    for (let a = 1; a <= total; a += unitSize) {
      const end = Math.min(total, a + unitSize - 1);
      units.push({
        id: `${s}:${a}-${end}`, surah: s, startAyah: a, endAyah: end,
        state: "NEW", mastery: 0, stability: 1.9, interval: 0, reps: 0, lapses: 0,
        nextReview: null, lastReview: null, createdAt: nowISO(), updatedAt: nowISO(), attempts: [],
      });
    }
  }
  return units;
}

function workDaysBetween(from, to, restDays) {
  let n = 0;
  for (let d = from; diffDays(to, d) >= 0; d = addDays(d, 1)) if (!restDays.includes(weekdayOf(d))) n++;
  return n;
}

function recalcPlan(plan, units) {
  const remaining = units.filter((u) => u.state === "NEW").length;
  if (!plan.targetDate || remaining === 0) return { ...plan, dailyUnits: plan.dailyUnits || 1, remaining };
  const days = Math.max(1, workDaysBetween(today(), plan.targetDate, plan.restDays));
  return { ...plan, dailyUnits: Math.max(1, Math.ceil(remaining / days)), remaining, workDaysLeft: days };
}

/* ─────────────── APPLICATION: الحالة ─────────────── */
const KEY = "wird:v2";
const EVENTS_CAP = 300;

const emptyState = () => ({
  version: 3, plan: null, units: [], sessions: [], activeSession: null,
  streak: { current: 0, longest: 0, last: null }, events: [],
  settings: { mushaf: "مصحف المدينة", reciter: "", debtThreshold: 12, maxInterval: 180, sound: true, highContrast: false, textScale: 1 },
});

const logEvent = (st, type, payload) => ({
  ...st, events: [...st.events, { type, at: nowISO(), payload: payload || null }].slice(-EVENTS_CAP),
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
        if (r) {
            const data = JSON.parse(r.value);
            setSt({ ...emptyState(), ...data });
        } else setSt(emptyState());
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
  const blocked = due.length > (st?.settings.debtThreshold ?? 12);

  const submitReview = (unitId, input, note) => {
    setSt((s) => {
      const i = s.units.findIndex((u) => u.id === unitId);
      if (i < 0) return s;
      const u = s.units[i];
      const elapsed = u.lastReview ? diffDays(today(), u.lastReview) : 0;
      const r = reviewEngine(u, { ...input, elapsedDays: elapsed }, s.settings);
      const nextState = stateEngine(u, r);
      const upd = {
        ...u, state: nextState, mastery: r.mastery, stability: r.stability,
        interval: r.nextInterval, nextReview: r.nextReview, lastReview: today(),
        reps: u.reps + 1, lapses: u.lapses + (r.success ? 0 : 1), updatedAt: nowISO(),
        attempts: [...u.attempts, {
          at: nowISO(), mistakes: input.mistakes, confidence: input.confidence, hintUsed: input.hintUsed,
          elapsedDays: elapsed, quality: r.quality, intervalBefore: u.interval, intervalAfter: r.nextInterval,
          masteryBefore: u.mastery, masteryAfter: r.mastery, stateBefore: u.state, stateAfter: nextState, note: note || "",
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
    ...s, activeSession: { startedAt: nowISO(), date: today(), stage: 0, secsLeft: STAGES[0].min * 60, reviewed: [], learned: [], notes: "" },
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
          <div><h1>وِرد</h1><p>{WEEKDAYS[new Date().getDay()]} · {saved ? "محفوظ" : "يُحفظ…"}</p></div>
        </div>
        <div className="badge-streak" title="أيام متتالية"><b>{ar(st.streak.current)}</b><span>يوم</span></div>
      </header>
      <main>
        {st.activeSession ? (
          <SessionScreen st={st} due={due} onPatch={patchSession} onAdvance={advanceStage} onEnd={endSession} onSubmit={submitReview} toast={toast}
            onLearn={(id) => setSt((s) => ({ ...s, activeSession: { ...s.activeSession, learned: [...new Set([...s.activeSession.learned, id])] } }))} />
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

/* ═════════════════════════ الجلسة ═════════════════════════ */
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
      <div className="stagerail">
        {STAGES.map((s, i) => <span key={s.id} className={"rail " + (i < a.stage ? "past" : i === a.stage ? "now" : "")} />)}
      </div>
      <header>
        <span className="eyebrow">المرحلة {ar(a.stage + 1)} من {ar(STAGES.length)}</span>
        <h2 className="display">{stage.ar}</h2>
        <p className="muted">{stage.hint}</p>
      </header>
      <Ring secs={a.secsLeft} total={total} running={running} onToggle={() => setRunning((r) => !r)} onReset={() => onPatch({ secsLeft: total })} />
      <div className="stagebody">
        {stage.id === "review" && (due.length === 0 ? <p className="muted center">لا مراجعة مستحقة.</p> : <ul className="unitlist">{due.slice(0, 8).map((u) => <UnitRow key={u.id} u={u} onSubmit={onSubmit} toast={toast} />)}</ul>)}
        {(stage.id === "read" || stage.id === "memorize") && (blocked ? <div className="callout err">دين المراجعة مرتفع. الحفظ الجديد موقوف.</div> : <div className="center">
          {newUnits.map((u) => (<div key={u.id} className="focus"><h3 className="display">{surahName(u.surah)}</h3><p className="muted">الآيات {ar(u.startAyah)}–{ar(u.endAyah)} · الجزء {ar(juzOfAyah(u.surah, u.startAyah))}</p></div>))}
        </div>)}
        {stage.id === "recall" && (blocked ? <div className="callout err">الحفظ الجديد موقوف.</div> : newUnits.length === 0 ? <p className="muted center">لا وحدات جديدة.</p> : <ul className="unitlist">
          {newUnits.map((u) => (<UnitRow key={u.id} u={u} openDefault firstTime onSubmit={(id, inp, note) => { onSubmit(id, inp, note); onLearn(id); toast(`دخلت ${unitLabel(u)} الجدول`); }} />))}
        </ul>)}
        {stage.id === "link" && <div className="center"><p className="muted">اربط ما حفظت اليوم بما قبله.</p><textarea className="input" rows="3" placeholder="ملاحظات الجلسة" value={a.notes} onChange={(e) => onPatch({ notes: e.target.value })} /></div>}
      </div>
      <div className="stagenav"><button className="btn ghost" onClick={() => onEnd(false)}>توقف مؤقت</button><button className="btn primary" onClick={onAdvance}>{a.stage === STAGES.length - 1 ? "أنهِ الجلسة" : "المرحلة التالية"}</button></div>
    </div>
  );
}

function Ring({ secs, total, running, onToggle, onReset }) {
  const R = 62, C = 2 * Math.PI * R, pct = total ? 1 - secs / total : 0;
  const m = String(Math.floor(secs / 60)).padStart(2, "0"), s = String(secs % 60).padStart(2, "0");
  return (
    <div className="ringwrap">
      <svg viewBox="0 0 150 150" className="ring"><circle cx="75" cy="75" r={R} className="ringbg" /><circle cx="75" cy="75" r={R} className="ringfg" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} /></svg>
      <div className="ringmid"><b>{ar(`${m}:${s}`)}</b><div className="ringbtns"><button onClick={onToggle}>{running ? "إيقاف" : "تشغيل"}</button><button onClick={onReset}>إعادة</button></div></div>
    </div>
  );
}

function UnitRow({ u, onSubmit, toast, openDefault, firstTime }) {
  const [open, setOpen] = useState(!!openDefault);
  const late = u.nextReview ? diffDays(today(), u.nextReview) : 0;
  const stt = STATES[u.state];
  return (
    <li className={"unit" + (late > 0 ? " late" : "")}>
      <button className="unithead" onClick={() => setOpen(!open)}>
        <span className="mastery"><b>{ar(u.mastery)}</b></span>
        <span className="unitmeta"><b>{unitLabel(u)}</b><span><i className={"chip " + stt.tone}>{stt.ar}</i>{u.nextReview ? (late > 0 ? ` متأخر ${ar(late)} يوم` : " اليوم") : ""}</span></span>
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
      <div className="counter"><button onClick={() => setMistakes((m) => m + 1)}>+</button><b>{ar(mistakes)}</b><button onClick={() => setMistakes((m) => Math.max(0, m - 1))}>−</button></div>
      <div className="chipsrow">{[0,1,2,3,5,8,12].map((n) => (<button key={n} className={"chipbtn" + (mistakes === n ? " on" : "")} onClick={() => setMistakes(n)}>{ar(n)}</button>))}</div>
      <label className="lbl">الثقة</label>
      <div className="chipsrow">{[1,2,3,4,5].map((c) => (<button key={c} className={"chipbtn" + (confidence === c ? " on" : "")} onClick={() => setConfidence(c)}>{ar(c)}</button>))}</div>
      <label className="switch"><input type="checkbox" checked={hintUsed} onChange={(e) => setHint(e.target.checked)} /><span>احتجت مساعدة</span></label>
      <div className={"verdict " + (preview.success ? "ok" : "no")}>الإتقان: {ar(u.mastery)} ← {ar(preview.mastery)} · الحالة: {STATES[nextState].ar}</div>
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظات الخطأ" />
      <button className="btn primary wide" onClick={() => onSubmit({ mistakes, confidence, hintUsed }, note)}>سجّل النتيجة</button>
    </div>
  );
}

/* ═════════════════════════ الرئيسية ═════════════════════════ */
function Home({ st, due, debt, blocked, onStart, onSubmit, toast }) {
  const newUnits = st.units.filter((u) => u.state === "NEW");
  const done = st.units.length - newUnits.length;
  const todayUnits = newUnits.slice(0, st.plan.dailyUnits || 1);
  return (
    <div className="screen">
      <section className="card hero">
        <span className="eyebrow">مهمة اليوم</span>
        {todayUnits.length === 0 ? <p className="big">أتممت وحدات الخطة!</p> : <ul className="tasklist">{todayUnits.map((u) => (<li key={u.id}><b>{surahName(u.surah)}</b> <span>{ar(u.startAyah)}–{ar(u.endAyah)}</span></li>))}</ul>}
        {blocked && <div className="callout err">دين المراجعة ({ar(due.length)}) — الحفظ الجديد موقوف.</div>}
        <button className="btn primary wide" onClick={onStart}>ابدأ جلسة اليوم</button>
      </section>
      <section className="statrow">
        <Stat v={ar(due.length)} l="مستحق" tone={blocked ? "err" : "warn"} />
        <Stat v={ar(debt)} l="متأخر" tone={debt ? "err" : "good"} />
        <Stat v={ar(done)} l="محفوظ" />
      </section>
      {due.length > 0 && (
        <section className="card"><h3>أقرب المراجعات</h3><ul className="unitlist">{due.slice(0, 4).map((u) => <UnitRow key={u.id} u={u} onSubmit={onSubmit} toast={toast} />)}</ul></section>
      )}
    </div>
  );
}

const Stat = ({ v, l, tone }) => <div className={"stat " + (tone || "")}><b>{v}</b><span>{l}</span></div>;
const Bar = ({ value, max }) => <div className="bar"><i style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} /></div>;

/* ═════════════════════════ المراجعة ═════════════════════════ */
function ReviewScreen({ st, due, onSubmit, toast }) {
  const [f, setF] = useState("due");
  const active = st.units.filter((u) => u.state !== "NEW");
  const shown = f === "due" ? due : f === "weak" ? active.filter((u) => ["WEAK", "RELEARNING"].includes(u.state)).sort((a, b) => a.mastery - b.mastery) : active;
  return (
    <div className="screen">
      <div className="seg">{[["due", `المستحق ${ar(due.length)}`], ["weak", "الضعيف"], ["all", `الكل ${ar(active.length)}`]].map(([id, l]) => (<button key={id} className={f === id ? "on" : ""} onClick={() => setF(id)}>{l}</button>))}</div>
      <ul className="unitlist">{shown.slice(0, 40).map((u) => <UnitRow key={u.id} u={u} onSubmit={onSubmit} toast={toast} />)}</ul>
    </div>
  );
}

/* ═════════════════════════ الإحصاء ═════════════════════════ */
function Stats({ st, due }) {
  const active = st.units.filter((u) => u.state !== "NEW");
  const juz = useMemo(() => {
    const tot = {}, don = {};
    st.units.forEach((u) => { const j = juzOfAyah(u.surah, u.startAyah); tot[j] = (tot[j] || 0) + 1; if (u.state !== "NEW") don[j] = (don[j] || 0) + 1; });
    return Array.from({ length: 30 }, (_, i) => ({ j: i + 1, t: tot[i + 1] || 0, d: don[i + 1] || 0 }));
  }, [st.units]);
  return (
    <div className="screen">
      <section className="card"><h3>إتمام الأجزاء</h3><div className="juzgrid">{juz.map((x) => (<div key={x.j} className="juzcell"><i style={{ height: `${x.t ? (x.d / x.t) * 100 : 0}%` }} /><span>{ar(x.j)}</span></div>))}</div></section>
      <section className="card">
        <h3>توزيع الإتقان</h3>
        {Object.keys(STATES).filter(k => k !== 'NEW').map(k => {
           const n = st.units.filter(u => u.state === k).length;
           return <div key={k} className="mrow"><span>{STATES[k].ar}</span><Bar value={n} max={active.length} /><b>{ar(n)}</b></div>
        })}
      </section>
    </div>
  );
}

/* ═════════════════════════ الخطة (Khatma Plan) ═════════════════════════ */
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
        <h2 className="display">أنشئ خطتك</h2>
        <label className="field"><span>من سورة</span><select value={surahFrom} onChange={(e) => setFrom(+e.target.value)}>{SURAH_NAMES.map((n, i) => <option key={i} value={i + 1}>{ar(i+1)}. {n}</option>)}</select></label>
        <label className="field"><span>إلى سورة</span><select value={surahTo} onChange={(e) => setTo(+e.target.value)}>{SURAH_NAMES.map((n, i) => <option key={i} value={i + 1}>{ar(i+1)}. {n}</option>)}</select></label>
        <label className="field"><span>حجم الوحدة</span><input type="number" value={unitSize} onChange={(e) => setSize(+e.target.value)} /></label>
        <label className="field"><span>تاريخ الانتهاء</span><input type="date" value={targetDate} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="callout">{ar(count)} وحدة · {ar(days)} يوم عمل · <b>{ar(Math.ceil(count/days))} وحدة يومياً</b></div>
        <button className="btn primary wide" onClick={() => onCreate({ surahFrom, surahTo, unitSize, targetDate, restDays })}>أنشئ الخطة</button>
      </section>
    </div>
  );
}

function PlanScreen({ st, setSt, toast }) {
  const p = st.plan;
  const newUnits = st.units.filter((u) => u.state === "NEW");
  const doneUnits = st.units.length - newUnits.length;
  
  // Pace Analysis
  const recentSessions = st.sessions.filter(s => diffDays(today(), s.date) <= 14);
  const unitsLearned = recentSessions.reduce((sum, s) => sum + (s.learned || 0), 0);
  const actualPace = unitsLearned / 14; // Average units per day last 14 days
  
  const daysLeftToTarget = Math.max(1, workDaysBetween(today(), p.targetDate, p.restDays));
  const requiredPace = newUnits.length / daysLeftToTarget;
  
  const estCompletion = actualPace > 0 ? addDays(today(), Math.ceil(newUnits.length / actualPace)) : null;

  // Upcoming Juz Milestones
  const milestones = useMemo(() => {
    const list = [];
    let currentJuz = juzOfAyah(st.units.find(u => u.state === 'NEW')?.surah || 1, 1);
    const unitsPerJuz = {};
    st.units.forEach(u => {
        const j = juzOfAyah(u.surah, u.startAyah);
        if (!unitsPerJuz[j]) unitsPerJuz[j] = [];
        unitsPerJuz[j].push(u);
    });

    let unitsAcc = 0;
    for (let j = currentJuz; j <= 30; j++) {
        const remainingInJuz = (unitsPerJuz[j] || []).filter(u => u.state === 'NEW').length;
        if (remainingInJuz > 0) {
            unitsAcc += remainingInJuz;
            const daysAtRequired = Math.ceil(unitsAcc / requiredPace);
            list.push({ juz: j, date: addDays(today(), daysAtRequired) });
        }
        if (list.length >= 5) break;
    }
    return list;
  }, [st.units, requiredPace]);

  return (
    <div className="screen">
      <section className="card">
        <h3>خلاصة الخطة</h3>
        <div className="kv">
          <div><dt>النطاق</dt><dd>{surahName(p.surahFrom)} ← {surahName(p.surahTo)}</dd></div>
          <div><dt>المتبقي</dt><dd>{ar(newUnits.length)} وحدة من {ar(st.units.length)}</dd></div>
          <div><dt>تاريخ الانتهاء</dt><dd>{ar(p.targetDate)}</dd></div>
        </div>
        <Bar value={doneUnits} max={st.units.length} />
      </section>

      <section className="card">
        <h3>تحليل الأداء (آخر ١٤ يوماً)</h3>
        <div className="pace-compare">
          <div className="pace-box">
            <span>السرعة الحالية</span>
            <b>{ar(actualPace.toFixed(1))}</b>
            <small>وحدة / يوم</small>
          </div>
          <div className="pace-box">
            <span>السرعة المطلوبة</span>
            <b>{ar(requiredPace.toFixed(1))}</b>
            <small>وحدة / يوم</small>
          </div>
        </div>
        {estCompletion && (
          <div className={"callout " + (diffDays(estCompletion, p.targetDate) > 0 ? "err" : "good")}>
            توقع الانتهاء حسب سرعتك: <b>{ar(estCompletion)}</b>
            {diffDays(estCompletion, p.targetDate) > 0 
                ? ` (متأخر ${ar(diffDays(estCompletion, p.targetDate))} يوم)`
                : ` (متقدم بـ ${ar(Math.abs(diffDays(estCompletion, p.targetDate)))} يوم)`}
          </div>
        )}
      </section>

      <section className="card">
        <h3>المحطات القادمة (تقديري)</h3>
        <ul className="milestones">
            {milestones.map(m => (
                <li key={m.juz}>
                    <span>الجزء {ar(m.juz)}</span>
                    <b>{ar(m.date)}</b>
                </li>
            ))}
        </ul>
      </section>

      <button className="btn ghost wide" onClick={() => setSt(s => logEvent({ ...s, plan: recalcPlan(s.plan, s.units) }, "PlanUpdated"))}>تحديث الوِرد اليومي</button>
    </div>
  );
}

/* ═════════════════════════ الإعدادات ═════════════════════════ */
function SettingsScreen({ st, setSt, toast }) {
  const s = st.settings;
  const set = (k, v) => setSt((x) => ({ ...x, settings: { ...x.settings, [k]: v } }));
  return (
    <div className="screen">
      <section className="card">
        <h3>عام</h3>
        <label className="field"><span>المصحف</span><input value={s.mushaf} onChange={(e) => set("mushaf", e.target.value)} /></label>
        <label className="field"><span>القارئ</span><input value={s.reciter} onChange={(e) => set("reciter", e.target.value)} /></label>
        <label className="switch"><input type="checkbox" checked={s.sound} onChange={(e) => set("sound", e.target.checked)} /><span>صوت التنبيه</span></label>
      </section>
      <section className="card danger">
        <h3>منطقة الخطر</h3>
        <button className="btn danger wide" onClick={() => { if(confirm("هل أنت متأكد؟ سيتم حذف كل شيء")) { setSt(emptyState()); toast("تم حذف البيانات"); } }}>حذف كافة البيانات</button>
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
  } catch {}
}

const unitLabel = (u) => `${surahName(u.surah)} ${ar(u.startAyah)}–${ar(u.endAyah)}`;

/* ═════════════════════════ Design System ═════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap');
.app{
  --bg:#0E1726; --surface:#152139; --surface-2:#1D2E4B; --primary:#C9A227; --primary-soft:#E0C25E;
  --success:#3F8F7E; --warning:#D9A441; --error:#B4574C; --text:#EFE7D5; --text-dim:#A8AEBD; --line:rgba(201,162,39,.18);
  font-family:'IBM Plex Sans Arabic',sans-serif; background:var(--bg); color:var(--text); min-height:100vh; padding-bottom:90px;
}
.app *{box-sizing:border-box}
button{cursor:pointer; font-family:inherit}
.topbar{display:flex; justify-content:space-between; align-items:center; padding:15px}
.brand h1{font-family:'Amiri',serif; margin:0; font-size:24px}
.brand p{font-size:10px; margin:0; color:var(--text-dim)}
.badge-streak{background:var(--surface-2); padding:5px 12px; border-radius:12px; text-align:center}
.badge-streak b{color:var(--primary); font-size:18px; display:block}
.badge-streak span{font-size:9px}
.screen{padding:15px; max-width:600px; margin:0 auto; display:flex; flex-direction:column; gap:15px}
.card{background:var(--surface); border:1px solid var(--line); border-radius:15px; padding:15px}
.card h3{font-family:'Amiri',serif; margin:0 0 10px; font-size:18px}
.hero{background:linear-gradient(to bottom, rgba(201,162,39,0.1), transparent)}
.display{font-family:'Amiri',serif; font-size:28px; margin:10px 0}
.eyebrow{font-size:10px; color:var(--primary); letter-spacing:1px}
.muted{font-size:12px; color:var(--text-dim)}
.btn{border:none; border-radius:12px; padding:12px; font-weight:600; transition:0.2s}
.btn.primary{background:var(--primary); color:#1A1206}
.btn.ghost{background:transparent; border:1px solid var(--line); color:var(--text)}
.btn.danger{background:var(--error); color:#fff}
.btn.wide{width:100%}
.statrow{display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px}
.stat{background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:10px; text-align:center}
.stat b{display:block; font-size:20px; color:var(--primary-soft)}
.stat span{font-size:10px; color:var(--text-dim)}
.stat.err b{color:var(--error)} .stat.good b{color:var(--success)}
.bar{height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden; margin:10px 0}
.bar i{display:block; height:100%; background:var(--primary)}
.unitlist{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px}
.unit{background:var(--surface-2); border-radius:12px; border:1px solid var(--line); overflow:hidden}
.unithead{display:flex; align-items:center; gap:10px; padding:10px; width:100%; border:none; background:none; color:inherit; text-align:right}
.mastery{width:35px; height:35px; border-radius:50%; border:2px solid var(--line); display:grid; place-items:center; font-size:12px}
.unitmeta{flex:1}
.unitmeta b{font-size:13px; display:block}
.unitmeta span{font-size:10px; color:var(--text-dim)}
.chip{font-size:9px; padding:2px 6px; border-radius:10px; border:1px solid var(--line); margin-left:5px}
.chip.good{color:var(--success)} .chip.warn{color:var(--warning)} .chip.err{color:var(--error)}
.cta-sm{font-size:11px; color:var(--primary)}
.recall{padding:15px; background:rgba(0,0,0,0.2); border-top:1px solid var(--line)}
.counter{display:flex; align-items:center; justify-content:center; gap:20px; margin-bottom:15px}
.counter b{font-size:32px; font-family:'Amiri',serif}
.counter button{width:35px; height:35px; border-radius:50%; border:1px solid var(--line); background:none; color:inherit}
.chipsrow{display:flex; gap:5px; justify-content:center; flex-wrap:wrap; margin-bottom:10px}
.chipbtn{background:none; border:1px solid var(--line); color:var(--text-dim); padding:5px 10px; border-radius:15px; font-size:12px}
.chipbtn.on{background:var(--primary); color:#000; border-color:var(--primary)}
.verdict{font-size:11px; text-align:center; padding:10px; border-radius:10px; margin:10px 0}
.verdict.ok{background:rgba(63,143,126,0.1); color:var(--success)}
.verdict.no{background:rgba(180,87,76,0.1); color:var(--error)}
.input{width:100%; background:var(--bg); border:1px solid var(--line); border-radius:10px; color:inherit; padding:10px; margin-bottom:10px}
.stagerail{display:flex; gap:4px}
.rail{flex:1; height:3px; background:rgba(255,255,255,0.1); border-radius:2px}
.rail.past{background:var(--success)} .rail.now{background:var(--primary)}
.ringwrap{position:relative; width:150px; margin:20px auto}
.ring{transform:rotate(-90deg); width:150px; height:150px}
.ringbg{fill:none; stroke:rgba(255,255,255,0.05); stroke-width:5}
.ringfg{fill:none; stroke:var(--primary); stroke-width:5; stroke-linecap:round; transition:stroke-dashoffset 0.5s}
.ringmid{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center}
.ringmid b{font-size:28px; font-family:'Amiri',serif}
.ringbtns{display:flex; gap:5px}
.ringbtns button{font-size:10px; background:none; border:1px solid var(--line); color:var(--text-dim); border-radius:10px; padding:2px 8px}
.juzgrid{display:grid; grid-template-columns:repeat(10,1fr); gap:5px}
.juzcell{height:40px; border:1px solid var(--line); border-radius:5px; position:relative; overflow:hidden; display:flex; align-items:flex-end}
.juzcell i{background:var(--primary); width:100%; opacity:0.5}
.juzcell span{position:absolute; inset:0; display:grid; place-items:center; font-size:10px}
.bottomnav{position:fixed; bottom:0; left:0; right:0; background:rgba(14,23,38,0.95); display:flex; border-top:1px solid var(--line); padding:10px}
.navbtn{flex:1; background:none; border:none; color:var(--text-dim); font-size:11px; display:flex; flex-direction:column; align-items:center; gap:3px}
.navbtn.on{color:var(--primary)}
.pill{background:var(--error); color:#fff; border-radius:10px; padding:1px 4px; font-size:8px}
.pace-compare{display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px}
.pace-box{background:var(--surface-2); padding:10px; border-radius:12px; text-align:center}
.pace-box span{font-size:10px; color:var(--text-dim); display:block}
.pace-box b{font-size:20px; color:var(--primary); font-family:'Amiri',serif}
.pace-box small{font-size:9px; display:block; opacity:0.6}
.milestones{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px}
.milestones li{display:flex; justify-content:space-between; font-size:13px; border-bottom:1px dashed var(--line); padding-bottom:5px}
.field{display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--line)}
.field span{font-size:13px}
.field select, .field input{background:var(--bg); border:1px solid var(--line); color:inherit; border-radius:5px; padding:5px}
`;
