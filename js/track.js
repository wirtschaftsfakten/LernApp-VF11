// Statistiken – ausschließlich aus echter Lernaktivität (state.events), nichts geschätzt oder erfunden.
// Eine Session = Antworten mit weniger als 15 Minuten Pause dazwischen.
// Lernzeit = Dauer der Session (Pausen über 5 Minuten zählen nur 1 Minute) + 30 Sekunden für die letzte Antwort.
import * as S from './store.js';

const DAY = 864e5;
const GAP_SESSION = 15 * 60e3;
const GAP_IDLE = 5 * 60e3;
export const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function sessions(events = S.get().events) {
  const out = [];
  let cur = null;
  for (const e of events) {
    if (!cur || e.t - cur.end > GAP_SESSION) { cur = { start: e.t, end: e.t, ms: 30e3, n: 0, ok: 0, tests: new Set() }; out.push(cur); }
    else { cur.ms += Math.min(e.t - cur.end, GAP_IDLE) ; cur.end = e.t; }
    cur.n++; cur.ok += e.ok; if (e.test) cur.tests.add(e.test);
  }
  return out;
}

// Minuten und Antworten pro Tag für die letzten n Tage (ältester zuerst)
export function perDay(n) {
  const today = S.startOfDay(Date.now());
  const map = new Map();
  for (let i = n - 1; i >= 0; i--) map.set(dayKey(today - i * DAY), { day: today - i * DAY, min: 0, n: 0, ok: 0 });
  const evs = S.get().events.filter((e) => e.t >= today - (n - 1) * DAY);
  for (const s of sessions(evs)) {
    const k = dayKey(s.start);
    if (map.has(k)) { const d = map.get(k); d.min += s.ms / 60e3; }
  }
  for (const e of evs) { const d = map.get(dayKey(e.t)); if (d) { d.n++; d.ok += e.ok; } }
  return [...map.values()].map((d) => ({ ...d, min: Math.round(d.min) }));
}

// Kalenderwoche ab Montag
export function weekStart(t = Date.now()) {
  const d = new Date(S.startOfDay(t));
  const wd = (d.getDay() + 6) % 7;
  return d.getTime() - wd * DAY;
}

export function summary() {
  const st = S.get();
  const ev = st.events;
  const ws = weekStart();
  const lastWs = ws - 7 * DAY;
  const today = S.startOfDay(Date.now());
  const all = sessions(ev);
  const inRange = (a, b) => all.filter((s) => s.start >= a && s.start < b);
  const minutes = (list) => Math.round(list.reduce((x, s) => x + s.ms, 0) / 60e3);
  const thisWeek = inRange(ws, ws + 7 * DAY);
  const lastWeek = inRange(lastWs, ws);
  const todayEv = ev.filter((e) => e.t >= today);
  const weekEv = ev.filter((e) => e.t >= ws);
  return {
    totalAnswers: ev.length,
    accuracy: ev.length ? Math.round(ev.reduce((x, e) => x + e.ok, 0) / ev.length * 100) : null,
    weekAccuracy: weekEv.length ? Math.round(weekEv.reduce((x, e) => x + e.ok, 0) / weekEv.length * 100) : null,
    weekMin: minutes(thisWeek), lastWeekMin: minutes(lastWeek),
    weekSessions: thisWeek.length, lastWeekSessions: lastWeek.length,
    totalSessions: all.length, totalMin: minutes(all),
    todayCards: new Set(todayEv.map((e) => e.c)).size,
    todayMin: minutes(inRange(today, today + DAY)),
    lastActivity: ev.length ? ev[ev.length - 1].t : null,
  };
}

// Aktivität für die Heatmap: Antworten pro Tag der letzten `weeks` Wochen, Wochen als Spalten (Mo–So)
export function heatmap(weeks = 17) {
  const start = weekStart() - (weeks - 1) * 7 * DAY;
  const counts = new Map();
  for (const e of S.get().events) if (e.t >= start) { const k = dayKey(e.t); counts.set(k, (counts.get(k) || 0) + 1); }
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const t = start + (w * 7 + d) * DAY;
      col.push({ t, n: counts.get(dayKey(t)) || 0, future: t > Date.now() });
    }
    cols.push(col);
  }
  return cols;
}

// Antworten und Minuten je Fach
export function bySubject() {
  const st = S.get();
  const testSub = new Map(st.tests.map((t) => [t.id, t.subjectId]));
  const res = new Map(st.subjects.map((s) => [s.id, { s, n: 0, ok: 0, last: 0 }]));
  for (const e of st.events) {
    const r = res.get(testSub.get(e.test));
    if (r) { r.n++; r.ok += e.ok; r.last = Math.max(r.last, e.t); }
  }
  return [...res.values()];
}

// Letzte Aktivität je Test (für "Weiterlernen")
export function lastTest() {
  const ev = S.get().events;
  for (let i = ev.length - 1; i >= 0; i--) if (ev[i].test && S.test(ev[i].test)) return S.test(ev[i].test);
  return null;
}

export function relTime(t) {
  if (!t) return 'noch nie';
  const d = Math.round((S.startOfDay(Date.now()) - S.startOfDay(t)) / DAY);
  if (d <= 0) return 'heute';
  if (d === 1) return 'gestern';
  if (d < 7) return `vor ${d} Tagen`;
  return new Date(t).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}
