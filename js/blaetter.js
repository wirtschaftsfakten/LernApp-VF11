// Original-Arbeitsblätter als Bilder: eigene Textmarker entfernt, wichtige Stellen neu markiert.
// Erscheinen im Reiter „Material markiert“ bei jedem Test des Fachs.
const seiten = (prefix, n) => Array.from({ length: n }, (_, i) => `blaetter/${prefix}-${String(i + 1).padStart(2, '0')}.jpg`);

export const BLAETTER = [
  { subject: 'SVV – Sozialversicherungslehre', name: 'Grundlagen der Kfz-Versicherung (LF 6)', pages: seiten('svv', 18) },
  { subject: 'E – Englisch', name: 'The 1% Rule, Kfz-Vokabular, Unit 8', pages: seiten('en', 8) },
];

export const blaetterOf = (subjectName) => BLAETTER.filter((b) => b.subject === subjectName);
