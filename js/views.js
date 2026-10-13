// Gemeinsame Bausteine (PC- und Handy-Version) – Aufbau nach iOS-Muster:
// große Titel, gruppierte Listen, farbige Fach-Icons, eine Karteikarte als Hauptelement.
import * as S from './store.js';
import { MODES, modeAvailable, topicsOf } from './learn.js';
import { h, plural, countdownText, daysUntil, fmtDate, ICON } from './util.js';

export const abbr = (name) => (name.split(/\s+[–-]\s+/)[0] || name).slice(0, 4);
export const longName = (name) => name.split(/\s+[–-]\s+/)[1] || name;
export const tone = (c) => c || 'blau';
export const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
export const SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>';
export const PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>';
export const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
export const CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
export const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

export const cardStats = (cards) => {
  const sure = cards.filter((c) => S.progressOf(c.id).box >= 3).length;
  return { sure, pct: cards.length ? Math.round(sure / cards.length * 100) : 0, due: cards.filter((c) => S.isDue(c.id)).length };
};

const MODE_TONE = { karteikarten: 'gelb', quiz: 'blau', ankreuzen: 'gruen', wahrfalsch: 'pink', lueckentext: 'orange', zuordnen: 'lila', schreiben: 'grau', probetest: 'rot' };

// Farbiges Fach-Icon (wie in den iPhone-Einstellungen)
export const subjectIcon = (s, size = '') => `<span class="app-ico ${size}" data-tone="${tone(s.color)}" aria-hidden="true">${h(abbr(s.name))}</span>`;
export const modeIcon = (key, icon) => `<span class="app-ico" data-tone="${MODE_TONE[key] || 'blau'}" aria-hidden="true">${ICON[icon]}</span>`;

// Eine Zeile einer gruppierten Liste
export function cell({ href, act, id, icon = '', title, sub = '', right = '', chev = true, cls = '' }) {
  const inner = `${icon}<span class="cell-txt"><span class="cell-title">${title}</span>${sub ? `<span class="cell-sub">${sub}</span>` : ''}</span>${right ? `<span class="cell-right">${right}</span>` : ''}${chev ? CHEV : ''}`;
  if (href) return `<a class="cell ${cls}" href="${href}">${inner}</a>`;
  if (act) return `<button class="cell ${cls}" data-act="${act}" ${id ? `data-id="${id}"` : ''}>${inner}</button>`;
  return `<div class="cell ${cls}">${inner}</div>`;
}
export const group = (title, rows, foot = '') => rows ? `<section class="group">${title ? `<h2 class="group-title">${title}</h2>` : ''}<div class="cells">${rows}</div>${foot ? `<p class="group-foot">${foot}</p>` : ''}</section>` : '';

// Test, an dem gerade gelernt werden sollte: nächster Test mit Datum, sonst zuletzt gelernter
export function focusTest() {
  const st = S.get();
  const withCards = st.tests.filter((t) => S.cardsOf(t.id).length);
  const dated = withCards.filter((t) => t.date && daysUntil(t.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  if (dated.length) return dated[0];
  const lastOf = (t) => Math.max(0, ...S.cardsOf(t.id).map((c) => S.progressOf(c.id).last || 0));
  return withCards.sort((a, b) => lastOf(b) - lastOf(a))[0] || null;
}

// Die Karteikarte: das eine auffällige Element der App
export function focusCard(t) {
  if (!t) return `<article class="index-card"><div class="ic-head"><span>Los geht's</span></div>
    <div class="ic-body"><p class="ic-title">Fach öffnen, Test anlegen, Arbeitsblatt fotografieren.</p><p class="ic-meta">Daraus macht die App Karteikarten, Quiz und Probetest.</p></div></article>`;
  const s = S.subject(t.subjectId);
  const cards = S.cardsOf(t.id);
  const { sure, pct, due } = cardStats(cards);
  return `<article class="index-card">
    <div class="ic-head"><span>${h(abbr(s.name))} · ${h(longName(s.name))}</span>${t.date ? `<span class="ic-date">${countdownText(t.date)}</span>` : ''}</div>
    <div class="ic-body">
      <a class="ic-title" href="#/test/${t.id}">${h(t.title)}</a>
      <div class="ic-progress"><div class="meter" role="img" aria-label="${pct} Prozent sicher"><i style="width:${pct}%"></i></div><span>${sure}/${cards.length} sicher</span></div>
      <a class="btn primary big" href="#/lernen/${t.id}/wiederholen">${due ? `Weiterlernen · ${due} fällig` : 'Weiterlernen'}</a>
    </div>
  </article>`;
}

export function subjectCell(s) {
  const tests = S.testsOf(s.id);
  const cards = S.get().cards.filter((c) => tests.some((t) => t.id === c.testId));
  const { pct } = cardStats(cards);
  return cell({ href: `#/fach/${s.id}`, icon: subjectIcon(s), title: h(longName(s.name)), sub: tests.length ? `${plural(tests.length, 'Test', 'Tests')} · ${plural(cards.length, 'Karte', 'Karten')}` : 'Noch kein Test', right: cards.length ? `${pct} %` : '' });
}

export function testCell(t) {
  const cards = S.cardsOf(t.id); const { pct } = cardStats(cards);
  return cell({ href: `#/test/${t.id}`, title: h(t.title), sub: `${t.date ? `${fmtDate(new Date(t.date + 'T00:00'))} · ` : ''}${plural(cards.length, 'Karte', 'Karten')} · ${pct} % sicher`, right: t.date ? `<span class="due-tag">${countdownText(t.date)}</span>` : '' });
}

// Kopf einer Testseite: Fortschritt und Hauptknopf
export function testHeader(t) {
  const s = S.subject(t.subjectId);
  const cards = S.cardsOf(t.id); const { sure, pct, due } = cardStats(cards);
  return `<header class="test-head">
    <p class="eyebrow">${subjectIcon(s, 'xs')} ${h(longName(s.name))}${t.date ? ` · Test am ${fmtDate(new Date(t.date + 'T00:00'))}` : ''}</p>
    <h1 class="large-title">${h(t.title)}</h1>
    ${cards.length ? `<div class="ic-progress wide"><div class="meter"><i style="width:${pct}%"></i></div><span>${sure} von ${cards.length} Karten sicher</span></div>
    <a class="btn primary big" href="#/lernen/${t.id}/wiederholen">${due ? `Weiterlernen · ${due} fällig` : 'Weiterlernen'}</a>` : ''}
  </header>`;
}

// Inhalt des Reiters "Lernen"
export function learnHtml(t) {
  const cards = S.cardsOf(t.id);
  const stars = cards.filter((c) => c.star);
  const last = S.resultsOf(t.id).at(-1);
  const tps = topicsOf(cards, S.docsOf(t.id));
  const modes = MODES.filter((m) => !['wiederholen', 'probetest', 'schreiben'].includes(m.key));
  const topicIcon = (k) => `<span class="app-ico" data-tone="${k === 'begriffe' ? 'lila' : k.startsWith('liste:') ? 'gruen' : k === 'zeit' ? 'orange' : 'grau'}" aria-hidden="true">${k.startsWith('doc:') ? ICON.cards : k === 'zeit' ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>' : ICON.check}</span>`;
  return `
    ${stars.length ? `<section class="group"><h2 class="group-title">Kommt im Test dran</h2><div class="cells">
      ${stars.map((c) => `<details class="cell disclose"><summary><span class="star" aria-hidden="true">★</span><span class="cell-txt"><span class="cell-title">${h(c.q)}</span></span><span class="cell-right">Antwort</span></summary><div class="disclose-body">${h(c.a)}</div></details>`).join('')}
    </div></section>` : ''}
    ${group('', cell({ href: `#/lernen/${t.id}/probetest`, icon: modeIcon('probetest', 'exam'), title: 'Probetest schreiben', sub: last ? `Letzte Note: ${last.grade} – ${h(last.gradeText || '')}` : 'Gemischte Aufgaben, Note nach IHK-Schlüssel', cls: modeAvailable('probetest', cards) ? 'strong' : 'disabled' }))}
    ${tps.length ? group('Abfragen nach Thema', tps.map((tp) => cell({ href: `#/lernen/${t.id}/thema/${encodeURIComponent(tp.key)}`, icon: topicIcon(tp.key), title: h(tp.label), sub: h(tp.sub) })).join('')) : ''}
    ${group('Üben', modes.map((m) => cell({ href: `#/lernen/${t.id}/${m.key}`, icon: modeIcon(m.key, m.icon), title: m.title, sub: m.text, cls: modeAvailable(m.key, cards) ? '' : 'disabled' })).join(''),
      modeAvailable('schreiben', cards) ? `Lieber selbst formulieren? <a href="#/lernen/${t.id}/schreiben">Antwort schreiben</a>` : '')}`;
}

// Suchergebnisse (Fächer und Tests)
export function searchHtml(q) {
  const st = S.get();
  const subs = st.subjects.filter((s) => s.name.toLowerCase().includes(q));
  const tests = st.tests.filter((t) => t.title.toLowerCase().includes(q));
  const rows = [...subs.map(subjectCell), ...tests.map(testCell)].join('');
  return rows ? group('Treffer', rows) : '<p class="empty-note">Nichts gefunden.</p>';
}
