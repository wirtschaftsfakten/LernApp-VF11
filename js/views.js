// Gemeinsame Bausteine (PC- und Handy-Version) im Stil einer Fintech-App:
// Verlaufs-Kopf mit großer Zahl, runde Aktions-Knöpfe, weiße Karten mit runden Icons, Pill-Buttons.
import * as S from './store.js';
import { MODES, modeAvailable, topicsOf } from './learn.js';
import { h, plural, countdownText, daysUntil, fmtDate, ICON } from './util.js';

export const abbr = (name) => (name.split(/\s+[–-]\s+/)[0] || name).slice(0, 4);
export const longName = (name) => name.split(/\s+[–-]\s+/)[1] || name;
export const tone = (c) => c || 'blau';
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ARROW = svg('<path d="M5 12h14M13 6l6 6-6 6"/>');
export const SEARCH = svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>');
export const PEN = svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>');
export const BACK = svg('<path d="M15 5l-7 7 7 7"/>');
export const CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
export const PLUS = svg('<path d="M12 5v14M5 12h14"/>');
export const BOLT = svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>');
export const UPLOAD = svg('<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>');
export const DOWN = svg('<path d="M6 9l6 6 6-6"/>');

export const cardStats = (cards) => {
  const sure = cards.filter((c) => S.progressOf(c.id).box >= 3).length;
  return { sure, pct: cards.length ? Math.round(sure / cards.length * 100) : 0, due: cards.filter((c) => S.isDue(c.id)).length };
};

const MODE_TONE = { karteikarten: 'gelb', quiz: 'blau', ankreuzen: 'gruen', wahrfalsch: 'pink', lueckentext: 'orange', zuordnen: 'lila', schreiben: 'grau', probetest: 'rot' };

// Runde Icons
export const subjectIcon = (s, size = '') => `<span class="dot-ico ${size}" data-tone="${tone(s.color)}" aria-hidden="true">${h(abbr(s.name))}</span>`;
export const modeIcon = (key, icon) => `<span class="dot-ico" data-tone="${MODE_TONE[key] || 'blau'}" aria-hidden="true">${ICON[icon]}</span>`;
const plainIcon = (inner, t = 'blau') => `<span class="dot-ico" data-tone="${t}" aria-hidden="true">${inner}</span>`;

// Zeile in einer Karte
export function cell({ href, act, id, icon = '', title, sub = '', right = '', rightSub = '', chev = false, cls = '', attrs = '' }) {
  const inner = `${icon}<span class="row-txt"><span class="row-title">${title}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span>${right || rightSub ? `<span class="row-right">${right ? `<b>${right}</b>` : ''}${rightSub ? `<small>${rightSub}</small>` : ''}</span>` : ''}${chev ? CHEV : ''}`;
  if (href) return `<a class="rv-row ${cls}" href="${href}" ${attrs}>${inner}</a>`;
  if (act) return `<button class="rv-row ${cls}" data-act="${act}" ${id ? `data-id="${id}"` : ''} ${attrs}>${inner}</button>`;
  return `<div class="rv-row ${cls}" ${attrs}>${inner}</div>`;
}
// Weiße Karte mit Titel und optionalem Link rechts
export const group = (title, rows, foot = '', link = '') => rows ? `<section class="rv-card">${title || link ? `<header class="rv-card-head">${title ? `<h2>${title}</h2>` : '<span></span>'}${link}</header>` : ''}<div class="rv-rows">${rows}</div>${foot ? `<p class="rv-foot">${foot}</p>` : ''}</section>` : '';

// Runder Aktions-Knopf im Kopf (wie "Geld hinzufügen")
export const action = ({ href, act, id, icon, label, cls = '' }) => href
  ? `<a class="rv-action ${cls}" href="${href}"><span class="rv-action-ico">${icon}</span><span>${label}</span></a>`
  : `<button class="rv-action ${cls}" ${act ? `data-act="${act}"` : ''} ${id ? `data-id="${id}"` : ''}><span class="rv-action-ico">${icon}</span><span>${label}</span></button>`;

// Verlaufs-Kopf mit großer Zahl
export function hero({ top = '', label = '', big = '', unit = '', chip = '', actions = [], cls = '' }) {
  return `<section class="rv-hero ${cls}">
    ${top ? `<div class="rv-top">${top}</div>` : ''}
    <div class="rv-figure">
      ${label ? `<p class="rv-label">${label}</p>` : ''}
      <p class="rv-big">${big}${unit ? `<span class="rv-unit">${unit}</span>` : ''}</p>
      ${chip}
    </div>
    ${actions.length ? `<div class="rv-actions">${actions.join('')}</div>` : ''}
  </section>`;
}

// Test, an dem gerade gelernt werden sollte: nächster Test mit Datum, sonst zuletzt gelernter
export function focusTest() {
  const st = S.get();
  const withCards = st.tests.filter((t) => S.cardsOf(t.id).length);
  const dated = withCards.filter((t) => t.date && daysUntil(t.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  if (dated.length) return dated[0];
  const lastOf = (t) => Math.max(0, ...S.cardsOf(t.id).map((c) => S.progressOf(c.id).last || 0));
  return withCards.sort((a, b) => lastOf(b) - lastOf(a))[0] || null;
}

// Kopf der Startseite
export function homeHero(top) {
  const st = S.get();
  const t = focusTest();
  const due = st.cards.filter((c) => S.isDue(c.id) && S.progressOf(c.id).last).length;
  const fresh = st.cards.filter((c) => !S.progressOf(c.id).last).length;
  const n = due || fresh;
  const chip = t ? `<a class="rv-chip" href="#/test/${t.id}">${h(abbr(S.subject(t.subjectId).name))} · ${h(t.title.length > 34 ? t.title.slice(0, 32) + '…' : t.title)}${DOWN}</a>` : '<span class="rv-chip">Noch kein Test</span>';
  return hero({
    top, label: due ? 'Heute fällig' : 'Neue Karten', big: String(n), unit: n === 1 ? 'Karte' : 'Karten', chip,
    actions: t ? [
      action({ href: '#/lernen/alle/wiederholen', icon: ICON.repeat, label: 'Lernen' }),
      action({ href: `#/lernen/${t.id}/quiz`, icon: ICON.quiz, label: 'Quiz' }),
      action({ href: `#/lernen/${t.id}/probetest`, icon: ICON.exam, label: 'Probetest' }),
      action({ href: `#/test/${t.id}/material`, icon: PLUS, label: 'Material' }),
    ] : [],
  });
}

// Zwei kleine Kennzahl-Karten
export function statTiles() {
  const st = S.get();
  const sure = st.cards.filter((c) => S.progressOf(c.id).box >= 3).length;
  const pct = st.cards.length ? Math.round(sure / st.cards.length * 100) : 0;
  const streak = S.streakDays();
  return `<div class="rv-tiles">
    <a class="rv-tile" href="#/lernen/alle/wiederholen"><small>Sicher gelernt</small><b>${pct}<span>%</span></b><div class="rv-meter"><i style="width:${pct}%"></i></div><small>${sure} von ${st.cards.length} Karten</small></a>
    <div class="rv-tile"><small>Lernserie</small><b>${streak}<span>${streak === 1 ? 'Tag' : 'Tage'}</span></b><div class="rv-days">${[...Array(7)].map((_, i) => `<i class="${i < Math.min(streak, 7) ? 'on' : ''}"></i>`).join('')}</div><small>am Stück gelernt</small></div>
  </div>`;
}

export function subjectCell(s) {
  const tests = S.testsOf(s.id);
  const cards = S.get().cards.filter((c) => tests.some((t) => t.id === c.testId));
  const { pct } = cardStats(cards);
  return cell({ href: `#/fach/${s.id}`, icon: subjectIcon(s), title: h(longName(s.name)), sub: tests.length ? plural(tests.length, 'Test', 'Tests') : 'Noch kein Test', right: cards.length ? `${pct} %` : '', rightSub: cards.length ? plural(cards.length, 'Karte', 'Karten') : '' });
}

export function testCell(t) {
  const cards = S.cardsOf(t.id); const { pct } = cardStats(cards);
  const s = S.subject(t.subjectId);
  return cell({ href: `#/test/${t.id}`, icon: subjectIcon(s), title: h(t.title), sub: t.date ? `Test am ${fmtDate(new Date(t.date + 'T00:00'))}` : `${plural(cards.length, 'Karte', 'Karten')}`, right: t.date ? countdownText(t.date) : `${pct} %`, rightSub: t.date ? `${pct} % sicher` : 'sicher' });
}

// Kopf einer Testseite
export function testHero(t, top) {
  const s = S.subject(t.subjectId);
  const cards = S.cardsOf(t.id); const { sure, pct, due } = cardStats(cards);
  return hero({
    top, cls: 'small',
    label: `${h(abbr(s.name))} · ${h(t.title)}`,
    big: String(pct), unit: '% sicher',
    chip: `<span class="rv-chip static">${sure} von ${cards.length} Karten${t.date ? ` · Test ${countdownText(t.date)}` : ''}</span>`,
    actions: cards.length ? [
      action({ href: `#/lernen/${t.id}/wiederholen`, icon: ICON.repeat, label: due ? `Lernen (${due})` : 'Lernen' }),
      action({ href: `#/lernen/${t.id}/quiz`, icon: ICON.quiz, label: 'Quiz' }),
      action({ href: `#/lernen/${t.id}/ankreuzen`, icon: ICON.check, label: 'Ankreuzen' }),
      action({ href: `#/lernen/${t.id}/probetest`, icon: ICON.exam, label: 'Probetest' }),
    ] : [action({ href: `#/test/${t.id}/material`, icon: PLUS, label: 'Material' })],
  });
}

// Inhalt des Reiters "Lernen"
export function learnHtml(t) {
  const cards = S.cardsOf(t.id);
  const stars = cards.filter((c) => c.star);
  const last = S.resultsOf(t.id).at(-1);
  const tps = topicsOf(cards, S.docsOf(t.id));
  const modes = MODES.filter((m) => !['wiederholen', 'probetest', 'schreiben'].includes(m.key));
  const topicIcon = (k) => plainIcon(k.startsWith('doc:') ? ICON.cards : k === 'zeit' ? svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>') : ICON.check, k === 'begriffe' ? 'lila' : k.startsWith('liste:') ? 'gruen' : k === 'zeit' ? 'orange' : 'grau');
  return `
    ${stars.length ? `<section class="rv-card"><header class="rv-card-head"><h2>Kommt im Test dran</h2></header><div class="rv-rows">
      ${stars.map((c) => `<details class="rv-row disclose"><summary>${plainIcon('★', 'gelb')}<span class="row-txt"><span class="row-title">${h(c.q)}</span></span><span class="rv-pill">Antwort</span></summary><div class="disclose-body">${h(c.a)}</div></details>`).join('')}
    </div></section>` : ''}
    ${tps.length ? group('Abfragen nach Thema', tps.map((tp) => cell({ href: `#/lernen/${t.id}/thema/${encodeURIComponent(tp.key)}`, icon: topicIcon(tp.key), title: h(tp.label), sub: h(tp.sub), chev: true })).join('')) : ''}
    ${group('Üben', modes.map((m) => cell({ href: `#/lernen/${t.id}/${m.key}`, icon: modeIcon(m.key, m.icon), title: m.title, sub: m.text, chev: true, cls: modeAvailable(m.key, cards) ? '' : 'disabled' })).join('') +
      cell({ href: `#/lernen/${t.id}/probetest`, icon: modeIcon('probetest', 'exam'), title: 'Probetest', sub: last ? `Letzte Note: ${last.grade} – ${h(last.gradeText || '')}` : 'Gemischte Aufgaben, Note nach IHK-Schlüssel', chev: true, cls: modeAvailable('probetest', cards) ? '' : 'disabled' }),
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
