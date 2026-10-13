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
  S.save();
}
