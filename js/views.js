// Gemeinsame Bausteine im neuen Design (PC- und Handy-Version)
import * as S from './store.js';
import { MODES, modeAvailable } from './learn.js';
import { h, plural, countdownText, daysUntil, fmtDate, ICON } from './util.js';

export const abbr = (name) => (name.split(/\s+[–-]\s+/)[0] || name).slice(0, 4);
export const longName = (name) => name.split(/\s+[–-]\s+/)[1] || name;
export const tone = (c) => (c === 'lila' ? 'blau' : c || 'blau'); // Hellblau statt Lila
export const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
export const BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';
export const SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>';
export const PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>';
export const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';

export const cardStats = (cards) => {
  const sure = cards.filter((c) => S.progressOf(c.id).box >= 3).length;
  return { sure, pct: cards.length ? Math.round(sure / cards.length * 100) : 0, due: cards.filter((c) => S.isDue(c.id)).length };
};

// Test, an dem gerade gelernt werden sollte: nächster Test mit Datum, sonst zuletzt gelernter
export function focusTest() {
  const st = S.get();
  const withCards = st.tests.filter((t) => S.cardsOf(t.id).length);
  const dated = withCards.filter((t) => t.date && daysUntil(t.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  if (dated.length) return dated[0];
  const lastOf = (t) => Math.max(0, ...S.cardsOf(t.id).map((c) => S.progressOf(c.id).last || 0));
  return withCards.sort((a, b) => lastOf(b) - lastOf(a))[0] || null;
}

export function heroCard(t) {
  if (!t) return `<div class="hero-card"><span class="hero-chip">LernApp</span>
    <p class="hero-label">So geht's</p><p class="hero-title">Fach öffnen, Test anlegen, Arbeitsblatt hochladen – fertig sind deine Lernkarten.</p></div>`;
  const s = S.subject(t.subjectId);
  const { pct } = cardStats(S.cardsOf(t.id));
  return `<div class="hero-card">
    <a class="hero-chip" href="#/fach/${s.id}">${h(abbr(s.name))} · ${h(longName(s.name))} <span aria-hidden="true">⌄</span></a>
    <p class="hero-label">Dein Fortschritt</p>
    <div class="slider" role="img" aria-label="${pct} Prozent sicher gelernt"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div>
    <p class="hero-pct">${pct}%</p>
    <p class="hero-label">${t.date ? `Nächster Test · ${countdownText(t.date)}` : 'Weiterlernen'}</p>
    <p class="hero-title">${h(t.title)}</p>
    <a class="hero-btn" href="#/lernen/${t.id}/wiederholen">Weiterlernen</a>
  </div>`;
}

export function subjectTile(s) {
  const tests = S.testsOf(s.id);
  const n = S.get().cards.filter((c) => tests.some((t) => t.id === c.testId)).length;
  return `<a class="tile-card" href="#/fach/${s.id}" data-tone="${tone(s.color)}">
    <span class="tile-ico">${h(abbr(s.name))}</span>
    <b>${h(longName(s.name))}</b>
    <small>${tests.length ? `${plural(tests.length, 'Test', 'Tests')} · ${plural(n, 'Karte', 'Karten')}` : 'Noch kein Test'}</small>
    <span class="pill">Öffnen</span></a>`;
}

export function testCard(t) {
  const cards = S.cardsOf(t.id); const { pct } = cardStats(cards);
  return `<a class="item-card" href="#/test/${t.id}">
    <span class="txt"><small>${t.date ? `Test am ${fmtDate(new Date(t.date + 'T00:00'))} · ${countdownText(t.date)}` : 'Test'}</small><b>${h(t.title)}</b><span>${plural(cards.length, 'Karte', 'Karten')} · ${pct} % sicher</span></span>
    <span class="pill">Lernen</span></a>`;
}

export function moduleCard(t) {
  const cards = S.cardsOf(t.id); const { pct } = cardStats(cards);
  return `<div class="module-card">
    <span class="txt"><small>${t.date ? `Test am ${fmtDate(new Date(t.date + 'T00:00'))} · ${countdownText(t.date)}` : 'Test'}</small><b>${h(t.title)}</b><span>${plural(cards.length, 'Karte', 'Karten')} · ${pct} % sicher</span></span>
    ${cards.length ? `<a class="arrow-btn" href="#/lernen/${t.id}/wiederholen" aria-label="Weiterlernen">${ARROW}</a>` : ''}
    <div class="mbar"><i style="width:${pct}%"></i></div>
  </div>`;
}

const MODE_TONE = { karteikarten: 'gelb', quiz: 'blau', wahrfalsch: 'pink', lueckentext: 'orange', zuordnen: 'gruen', schreiben: 'blau' };
const MODE_SHORT = {
  karteikarten: 'Umdrehen und ehrlich bewerten', quiz: 'Eine von vier ist richtig', wahrfalsch: 'Stimmt die Aussage?',
  lueckentext: 'Fehlendes Wort eintippen', zuordnen: 'Begriff und Erklärung verbinden', schreiben: 'Frei antworten, vergleichen',
};

// Inhalt des Reiters "Lernen": wichtige Fragen, Übungs-Kacheln, Probetest
export function learnHtml(t) {
  const cards = S.cardsOf(t.id);
  const stars = cards.filter((c) => c.star);
  const last = S.resultsOf(t.id).at(-1);
  return `
    ${stars.length ? `<section><p class="section-label">Kommt im Test dran</p><div class="cards">
      ${stars.map((c, i) => `<details class="item-card star-q"><summary><span class="txt"><small>Frage ${i + 1}</small><b>${h(c.q)}</b></span><span class="pill">Antwort</span></summary><div class="star-a">${h(c.a)}</div></details>`).join('')}
      </div></section>` : ''}
    <section><p class="section-label">Üben</p>
      <div class="tiles">
        ${MODES.filter((m) => !['wiederholen', 'probetest'].includes(m.key)).map((m) => `<a class="tile-card" data-tone="${MODE_TONE[m.key]}" href="#/lernen/${t.id}/${m.key}" ${modeAvailable(m.key, cards) ? '' : 'aria-disabled="true"'}>
          <span class="tile-ico">${ICON[m.icon]}</span><b>${m.title}</b><small>${MODE_SHORT[m.key]}</small><span class="pill">Starten</span></a>`).join('')}
      </div>
      <a class="exam-card" href="#/lernen/${t.id}/probetest" ${modeAvailable('probetest', cards) ? '' : 'aria-disabled="true"'}>
        <span class="tile-ico">${ICON.exam}</span>
        <span class="txt"><b>Probetest</b><small>${last ? `Letzte Note: ${last.grade} (${h(last.gradeText || '')})` : 'Gemischte Aufgaben mit Note nach IHK-Schlüssel'}</small></span>
        <span class="arrow-btn">${ARROW}</span></a>
    </section>`;
}

// Suchergebnisse (Fächer und Tests)
export function searchHtml(q) {
  const st = S.get();
  const subs = st.subjects.filter((s) => s.name.toLowerCase().includes(q));
  const tests = st.tests.filter((t) => t.title.toLowerCase().includes(q));
  return `<div class="cards">${[
    ...subs.map((s) => `<a class="item-card" href="#/fach/${s.id}"><span class="txt"><small>Fach</small><b>${h(s.name)}</b><span>${plural(S.testsOf(s.id).length, 'Test', 'Tests')}</span></span><span class="pill">Öffnen</span></a>`),
    ...tests.map((t) => `<a class="item-card" href="#/test/${t.id}"><span class="txt"><small>${h(S.subject(t.subjectId)?.name || '')}</small><b>${h(t.title)}</b><span>${plural(S.cardsOf(t.id).length, 'Karte', 'Karten')}</span></span><span class="pill">Lernen</span></a>`),
  ].join('') || '<p class="muted">Nichts gefunden.</p>'}</div>`;
}
