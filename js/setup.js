// Gemeinsame Einrichtung für PC- und Handy-Version
import * as S from './store.js';
import { generate } from './gen.js';
import { BEISPIEL, ENGLISCH_READING, FAECHER, KURZARBEIT } from './beispiel.js';
import { ENGLISCH_UNTERRICHT, SVV_KFZ } from './unterricht.js';

export function addGenerated(testId, doc) {
  const gen = generate(doc.text, { highlights: doc.highlights || [] });
  return S.addCards(gen.map((c) => ({ ...c, testId, docId: doc.id })));
}

export function addBeispielDoc(testId, bd) {
  const d = S.addDoc(testId, bd.name, bd.kind, bd.text);
  d.highlights = bd.highlights;
  if (bd.urls) d.urls = bd.urls;
  const n = addGenerated(testId, d);
  // Fragen der Kurzarbeit als wichtig markieren
  if (bd === KURZARBEIT) S.get().cards.filter((c) => c.docId === d.id && c.type === 'frage').forEach((c) => { c.star = true; });
  S.save();
  return n;
}

// Legt den Deutsch-Test an; gibt null zurück, wenn er schon existiert
export function loadBeispiel() {
  const st = S.get();
  if (st.tests.some((t) => t.title === BEISPIEL.test.title)) return null;
  const s = st.subjects.find((x) => x.name === BEISPIEL.subject.name) || S.addSubject(BEISPIEL.subject.name, BEISPIEL.subject.color);
  const t = S.addTest(s.id, BEISPIEL.test.title, '', BEISPIEL.test.notes);
  for (const bd of BEISPIEL.docs) addBeispielDoc(t.id, bd);
  return t;
}

// Einmalige Einrichtung: Fächer laut Stundenplan, Deutsch-Test, Kurzarbeit-Fragen
export function migrate() {
  const st = S.get();
  st.setup ||= {};
  if (!st.setup.faecherV1) {
    const old = st.subjects.find((s) => s.name === 'Deutsch / Kommunikation');
    if (old) old.name = 'D – Deutsch';
    for (const f of FAECHER) if (!st.subjects.some((s) => s.name === f.name)) st.subjects.push({ id: S.uid(), ...f });
    st.setup.faecherV1 = true;
  }
  if (!st.setup.beispielAutoV1) {
    st.setup.beispielAutoV1 = true;
    if (loadBeispiel()) st.setup.kurzarbeitV1 = true;
  }
  if (!st.setup.kurzarbeitV1) {
    const t = st.tests.find((x) => x.title === BEISPIEL.test.title);
    if (t && !S.docsOf(t.id).some((d) => d.name === KURZARBEIT.name)) {
      addBeispielDoc(t.id, KURZARBEIT);
      t.notes = BEISPIEL.test.notes;
    }
    st.setup.kurzarbeitV1 = true;
  }
  // Inhalte auf den Stand der Unterlagen bringen (keine selbst formulierten Antworten mehr)
  if (!st.setup.unterlagenV2) {
    const t = st.tests.find((x) => x.title === BEISPIEL.test.title);
    if (t) {
      t.notes = BEISPIEL.test.notes;
      // Früher automatisch gesetztes Datum (Anlage + 9 Tage) entfernen; selbst eingetragene Daten bleiben
      const auto = new Date(t.createdAt + 9 * 864e5);
      const autoIso = `${auto.getFullYear()}-${String(auto.getMonth() + 1).padStart(2, '0')}-${String(auto.getDate()).padStart(2, '0')}`;
      if (t.date === autoIso) t.date = '';
      for (const bd of BEISPIEL.docs) {
        const d = S.docsOf(t.id).find((x) => x.name === bd.name || (bd.oldNames || []).includes(x.name));
        if (!d || (d.text === bd.text && d.name === bd.name)) continue;
        S.get().cards.filter((c) => c.docId === d.id).forEach((c) => S.deleteCard(c.id));
        S.deleteDoc(d.id);
        addBeispielDoc(t.id, bd);
      }
    }
    st.setup.unterlagenV2 = true;
  }
  // Original-Fotos der Beispiel-Blätter verknüpfen
  if (!st.setup.blaetterV1) {
    const t = st.tests.find((x) => x.title === BEISPIEL.test.title);
    if (t) for (const bd of BEISPIEL.docs) {
      const d = S.docsOf(t.id).find((x) => x.name === bd.name);
      if (d && bd.urls) d.urls = bd.urls;
    }
    st.setup.blaetterV1 = true;
  }
  // Fertiges Unterrichtsmaterial an den Test des Fachs hängen
  if (!st.setup.englischReadingV1) {
    attachToSubjectTest(ENGLISCH_READING.subject, ENGLISCH_READING.test.title, [ENGLISCH_READING]);
    st.setup.englischReadingV1 = true;
  }
  if (!st.setup.englischHabitsV1) {
    attachToSubjectTest(ENGLISCH_UNTERRICHT.subject, ENGLISCH_UNTERRICHT.testTitle, ENGLISCH_UNTERRICHT.docs);
    st.setup.englischHabitsV1 = true;
  }
  if (!st.setup.svvKfzV1) {
    attachToSubjectTest(SVV_KFZ.subject, SVV_KFZ.testTitle, SVV_KFZ.docs);
    st.setup.svvKfzV1 = true;
  }
  S.save();
}

// Fertige Lernpakete aus dem Ordner pakete/ (lokal und auf GitHub Pages).
// pakete/pakete.json listet die Dateien; jedes Paket wird einmal zusammengeführt.
export async function loadPakete() {
  let list;
  try {
    const r = await fetch('pakete/pakete.json', { cache: 'no-store' });
    if (!r.ok) return 0;
    list = await r.json();
  } catch { return 0; }
  const st = S.get();
  st.setup ||= {};
  st.setup.pakete ||= {};
  let n = 0;
  for (const file of list) {
    if (st.setup.pakete[file]) continue;
    try {
      const r = await fetch('pakete/' + file, { cache: 'no-store' });
      if (!r.ok) continue;
      const text = await r.text();
      n += JSON.parse(text).tests.filter((t) => !st.tests.some((x) => x.id === t.id)).length;
      S.importJSON(text, 'merge');
      st.setup.pakete[file] = true;
      S.save();
    } catch (e) { console.warn('Paket nicht ladbar', file, e); }
  }
  return n;
}

// Nächster anstehender Test des Fachs, sonst der neueste, sonst ein neuer
function attachToSubjectTest(subjectName, testTitle, docs) {
  const s = S.get().subjects.find((x) => x.name === subjectName);
  if (!s) return;
  const today = new Date().toISOString().slice(0, 10);
  const tests = S.testsOf(s.id);
  const t = tests.filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
    || [...tests].sort((a, b) => b.createdAt - a.createdAt)[0]
    || S.addTest(s.id, testTitle, '');
  for (const bd of docs) if (!S.docsOf(t.id).some((d) => d.name === bd.name)) addBeispielDoc(t.id, bd);
}
