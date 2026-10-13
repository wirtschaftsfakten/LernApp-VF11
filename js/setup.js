// Gemeinsame Einrichtung für PC- und Handy-Version
import * as S from './store.js';
import { generate } from './gen.js';
import { BEISPIEL, FAECHER, KURZARBEIT } from './beispiel.js';

export function addGenerated(testId, doc) {
  const gen = generate(doc.text, { highlights: doc.highlights || [] });
  return S.addCards(gen.map((c) => ({ ...c, testId, docId: doc.id })));
}

export function addBeispielDoc(testId, bd) {
  const d = S.addDoc(testId, bd.name, bd.kind, bd.text);
  d.highlights = bd.highlights;
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
  S.save();
}
