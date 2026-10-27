// Datenhaltung: alles bleibt im Browser (localStorage) auf diesem PC.
import { deleteFile } from './files.js';
const KEY = 'lernapp.v1';

const empty = () => ({
  version: 1,
  subjects: [],   // {id, name, color}
  tests: [],      // {id, subjectId, title, date, notes, createdAt}
  docs: [],       // {id, testId, name, kind, text, addedAt}
  cards: [],      // {id, testId, docId, type, q, a, source, createdAt}
  progress: {},   // cardId -> {box, due, right, wrong, last}
  results: [],    // {id, testId, date, points, max, grade, mode}
  streak: { last: null, days: 0 },
  events: [],     // Lernaktivität: {t, c: cardId, test, ok: 1|0|0.5} – Grundlage für Lernzeit, Sessions, Heatmap
  tasks: [],      // eigene Aufgaben im Planer: {id, title, date, prio, testId, done}
  prefs: { name: '', dailyGoal: 20, weeklyGoalMin: 120, examSize: 10, theme: 'light' },
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); const e = empty(); return { ...e, ...d, prefs: { ...e.prefs, ...(d.prefs || {}) } }; }
  } catch (e) { console.warn('Speicher nicht lesbar', e); }
  return empty();
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Speichern fehlgeschlagen', e);
    document.dispatchEvent(new CustomEvent('lernapp:savefail'));
  }
  listeners.forEach((fn) => fn());
}

export const get = () => state;
export const onChange = (fn) => listeners.add(fn);
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Fächer
export function addSubject(name, color) {
  const s = { id: uid(), name: name.trim(), color };
  state.subjects.push(s); save(); return s;
}
export function updateSubject(id, patch) { Object.assign(subject(id), patch); save(); }
export function deleteSubject(id) {
  state.tests.filter((t) => t.subjectId === id).forEach((t) => deleteTest(t.id, false));
  state.subjects = state.subjects.filter((s) => s.id !== id); save();
}
export const subject = (id) => state.subjects.find((s) => s.id === id);

// Tests / Lernsets
export function addTest(subjectId, title, date, notes = '') {
  const t = { id: uid(), subjectId, title: title.trim(), date: date || '', notes, createdAt: Date.now() };
  state.tests.push(t); save(); return t;
}
export function updateTest(id, patch) { Object.assign(test(id), patch); save(); }
export function deleteTest(id, persist = true) {
  const cardIds = new Set(state.cards.filter((c) => c.testId === id).map((c) => c.id));
  cardIds.forEach((cid) => delete state.progress[cid]);
  state.cards = state.cards.filter((c) => c.testId !== id);
  state.docs.filter((d) => d.testId === id).forEach((d) => (d.fileIds || []).forEach(deleteFile));
  state.docs = state.docs.filter((d) => d.testId !== id);
  state.results = state.results.filter((r) => r.testId !== id);
  state.tests = state.tests.filter((t) => t.id !== id);
  if (persist) save();
}
export const test = (id) => state.tests.find((t) => t.id === id);
export const testsOf = (subjectId) => state.tests.filter((t) => t.subjectId === subjectId);

// Dokumente
export function addDoc(testId, name, kind, text) {
  const d = { id: uid(), testId, name, kind, text, addedAt: Date.now() };
  state.docs.push(d); save(); return d;
}
export function deleteDoc(id, withCards) {
  if (withCards) {
    state.cards.filter((c) => c.docId === id).forEach((c) => delete state.progress[c.id]);
    state.cards = state.cards.filter((c) => c.docId !== id);
  }
  (state.docs.find((d) => d.id === id)?.fileIds || []).forEach(deleteFile);
  state.docs = state.docs.filter((d) => d.id !== id); save();
}
export const docsOf = (testId) => state.docs.filter((d) => d.testId === testId);

// Karten
export function addCards(list) {
  const known = new Set(state.cards.map((c) => c.testId + '|' + norm(c.q) + '|' + norm(c.a)));
  let n = 0;
  for (const c of list) {
    const k = c.testId + '|' + norm(c.q) + '|' + norm(c.a);
    if (known.has(k)) continue;
    known.add(k);
    state.cards.push({ id: uid(), createdAt: Date.now(), source: '', docId: null, ...c });
    n++;
  }
  save(); return n;
}
export function updateCard(id, patch) { Object.assign(state.cards.find((c) => c.id === id), patch); save(); }
export function deleteCard(id) {
  state.cards = state.cards.filter((c) => c.id !== id);
  delete state.progress[id]; save();
}
export const cardsOf = (testId) => state.cards.filter((c) => c.testId === testId);
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Lernkartei (Leitner, 5 Fächer)
const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];
export const progressOf = (cardId) => state.progress[cardId] || { box: 0, due: 0, right: 0, wrong: 0, last: 0 };

// correct: true = gewusst, false = nicht gewusst, 'hard' = schwierig (Fach bleibt, morgen wieder)
export function grade(cardId, correct, persist = true) {
  const p = { ...progressOf(cardId) };
  if (correct === 'hard') { p.box = Math.max(1, p.box); p.right++; }
  else if (correct) { p.box = Math.min(5, p.box + 1); p.right++; }
  else { p.box = 1; p.wrong++; }
  p.last = Date.now();
  p.due = startOfDay(Date.now()) + (correct === 'hard' ? 1 : INTERVAL_DAYS[p.box]) * 864e5;
  state.progress[cardId] = p;
  const card = state.cards.find((c) => c.id === cardId);
  state.events.push({ t: p.last, c: cardId, test: card?.testId || null, ok: correct === 'hard' ? 0.5 : correct ? 1 : 0 });
  if (state.events.length > 20000) state.events = state.events.slice(-20000);
  touchStreak();
  if (persist) save();
}

// Planer-Aufgaben
export function addTask(t) { const x = { id: uid(), done: false, prio: 'mittel', ...t }; state.tasks.push(x); save(); return x; }
export function updateTask(id, patch) { Object.assign(state.tasks.find((x) => x.id === id), patch); save(); }
export function deleteTask(id) { state.tasks = state.tasks.filter((x) => x.id !== id); save(); }
export function setPrefs(patch) { Object.assign(state.prefs, patch); save(); }
export function updateDoc(id, patch) { Object.assign(state.docs.find((d) => d.id === id), patch); save(); }
export function isDue(cardId) {
  const p = state.progress[cardId];
  return !p || p.due <= Date.now();
}

function touchStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const s = state.streak;
  if (s.last === today) return;
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  s.days = s.last === yesterday ? s.days + 1 : 1;
  s.last = today;
}
export function streakDays() {
  const s = state.streak;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  return s.last === today || s.last === yesterday ? s.days : 0;
}

export function addResult(r) {
  touchStreak();
  state.results.push({ id: uid(), date: Date.now(), ...r }); save();
}
export const resultsOf = (testId) => state.results.filter((r) => r.testId === testId);

export const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

// Backup
export function exportJSON() { return JSON.stringify(state, null, 1); }
export function importJSON(text, mode = 'replace') {
  const data = JSON.parse(text);
  if (!Array.isArray(data.subjects) || !Array.isArray(data.tests)) throw new Error('Das ist keine LernApp-Sicherung.');
  if (mode === 'replace') state = { ...empty(), ...data };
  else {
    // Fächer mit gleichem Namen zusammenlegen, damit ein importierter Test im vorhandenen Fach landet
    for (const s of data.subjects) {
      const same = state.subjects.find((x) => x.name === s.name && x.id !== s.id);
      if (!same) continue;
      (data.tests || []).forEach((t) => { if (t.subjectId === s.id) t.subjectId = same.id; });
      s.id = same.id;
    }
    for (const k of ['subjects', 'tests', 'docs', 'cards', 'results', 'tasks']) {
      state[k] ||= [];
      const ids = new Set(state[k].map((x) => x.id));
      state[k].push(...(data[k] || []).filter((x) => !ids.has(x.id)));
    }
    state.progress = { ...data.progress, ...state.progress };
  }
  save();
}
export function resetAll() { state = empty(); save(); }
