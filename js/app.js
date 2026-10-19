// LernApp – eine responsive Oberfläche für PC, Tablet und Handy.
// Seiten: Dashboard, Fächer (Fach, Test), Lernen, Quiz, Karteikarten, Planer, Fortschritt, Einstellungen.
import * as S from './store.js';
import { generate, keywords, keySentences, TYPE_LABEL } from './gen.js';
import { extractFile, ACCEPT } from './extract.js';
import { addGenerated, loadBeispiel, migrate } from './setup.js';
import { startSession, MODES, modeAvailable, topicsOf } from './learn.js';
import { putFile } from './files.js';
import { openOriginal, hasOriginal } from './viewer.js';
import * as T from './track.js';
import { I } from './icons.js';
import { h, $, $$, toast, COLORS, COLOR_NAME, countdownText, daysUntil, fmtDate, isoDate, plural } from './util.js';

const main = $('#main');
const side = $('#side');
const bottom = $('#bottom');
const dlg = $('#dialog');
const DAY = 864e5;
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];

// ---------- Hilfen ----------
const abbr = (name) => (name.split(/\s+[–-]\s+/)[0] || name).slice(0, 4);
const longName = (name) => name.split(/\s+[–-]\s+/)[1] || name;
const subjIcon = (s, cls = '') => `<span class="subj-ico ${cls}" data-tone="${s?.color || 'blau'}" aria-hidden="true">${h(abbr(s?.name || '?'))}</span>`;
const stats = (cards) => {
  const sure = cards.filter((c) => S.progressOf(c.id).box >= 3).length;
  return { sure, pct: cards.length ? Math.round(sure / cards.length * 100) : 0, due: cards.filter((c) => S.isDue(c.id)).length, total: cards.length };
};
const subjCards = (sid) => { const ids = new Set(S.testsOf(sid).map((t) => t.id)); return S.get().cards.filter((c) => ids.has(c.testId)); };
const bar = (pct, cls = '') => `<div class="meter ${cls}" role="img" aria-label="${pct} Prozent"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
const empty = (title, text, action = '') => `<div class="empty-state">${I.sparkle}<p class="empty-title">${title}</p><p>${text}</p>${action}</div>`;
const card = (title, body, { action = '', cls = '', sub = '' } = {}) => `<section class="card ${cls}">${title ? `<header class="card-head"><div><h2>${title}</h2>${sub ? `<p class="card-sub">${sub}</p>` : ''}</div>${action}</header>` : ''}${body}</section>`;
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`);

// Fortschrittsring (eine Größe, ein Wert)
function ring(pct, size = 132, stroke = 12, label = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${label || pct + ' Prozent'}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(100, pct) / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

// Säulendiagramm (eine Reihe) mit Tooltip über <title>
function barChart(data, { unit = 'min', height = 140 } = {}) {
  const max = Math.max(...data.map((d) => d.v), 1);
  const nice = max <= 10 ? 10 : max <= 30 ? 30 : max <= 60 ? 60 : Math.ceil(max / 30) * 30;
  return `<div class="bars" style="--h:${height}px">
    <div class="bars-grid"><span>${nice}</span><span>${Math.round(nice / 2)}</span><span>0</span></div>
    ${data.map((d) => `<div class="bar-col ${d.today ? 'today' : ''}"><div class="bar-track"><i style="height:${d.v / nice * 100}%" title="${h(d.label)}: ${d.v} ${unit}"></i></div><span>${h(d.short)}</span></div>`).join('')}
  </div>`;
}

// ---------- Farbschema ----------
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const isDark = () => { const t = S.get().prefs.theme || 'light'; return t === 'dark' || (t === 'auto' && darkQuery.matches); };
function applyTheme() {
  document.documentElement.dataset.theme = S.get().prefs.theme || 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark() ? '#0A111D' : '#F8FBFE');
}
darkQuery.addEventListener?.('change', () => { applyTheme(); });
const modeBtn = () => `<button class="mode-btn" data-act="toggle-theme" aria-label="${isDark() ? 'Helles Design' : 'Dunkles Design'}" title="${isDark() ? 'Helles Design' : 'Dunkles Design'}">${isDark() ? I.sun : I.moon}</button>`;

// ---------- Layout ----------
const NAV = [
  ['', 'Dashboard', 'dashboard'], ['faecher', 'Fächer', 'subjects'], ['lesen', 'Lernen', 'learn'], ['quiz', 'Quiz', 'quiz'],
  ['karteikarten', 'Karteikarten', 'cards'], ['planer', 'Planer', 'planner'], ['fortschritt', 'Fortschritt', 'progress'], ['einstellungen', 'Einstellungen', 'settings'],
];
const BOTTOM = ['', 'faecher', 'lesen', 'planer', 'fortschritt'];

function sectionOf(view) {
  if (['fach', 'test'].includes(view)) return 'faecher';
  if (view === 'lernen') return null;
  return view || '';
}

function renderNav(view) {
  const cur = sectionOf(view);
  const p = S.get().prefs;
  const streak = S.streakDays();
  side.innerHTML = `
    <a class="logo" href="#/"><span class="logo-mark">${I.learn}</span><span>LernApp VF11</span></a>
    <nav class="nav" aria-label="Hauptnavigation">
      ${NAV.map(([k, l, ic]) => `<a href="#/${k}" class="nav-item" ${cur === k ? 'aria-current="page"' : ''}>${I[ic]}<span>${l}</span></a>`).join('')}
    </nav>
    <div class="side-foot"><a class="userbox" href="#/einstellungen">
      <span class="avatar">${h((p.name || 'L').trim().charAt(0).toUpperCase())}</span>
      <span class="userbox-txt"><b>${h(p.name || 'Profil einrichten')}</b><small>${streak ? `${I.flame}${streak} ${streak === 1 ? 'Tag' : 'Tage'} Lernserie` : 'Name und Ziele festlegen'}</small></span>
    </a>${modeBtn()}</div>`;
  bottom.innerHTML = BOTTOM.map((k) => { const n = NAV.find((x) => x[0] === k); return `<a href="#/${k}" ${cur === k ? 'aria-current="page"' : ''}>${I[n[2]]}<span>${n[1]}</span></a>`; }).join('');
}

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [view, id, sub, extra] = parts;
  document.body.classList.remove('nav-open');
  if (dlg.open) dlg.close();
  renderNav(view);
  window.scrollTo(0, 0);
  const inSession = view === 'lernen';
  document.body.classList.toggle('in-session', inSession);
  if (inSession) return startSession(main, id, sub, extra);
  const views = { faecher: viewSubjects, fach: viewSubject, test: viewTest, lesen: viewRead, quiz: viewQuiz, karteikarten: viewFlash, planer: viewPlanner, fortschritt: viewProgress, einstellungen: viewSettings };
  if (view === 'fach' && !S.subject(id)) return go('#/faecher');
  if (view === 'test' && !S.test(id)) return go('#/faecher');
  (views[view] || viewDashboard)(id, sub);
}
window.addEventListener('hashchange', route);
const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

const pageHead = (title, sub = '', right = '') => `<header class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right ? `<div class="page-actions">${right}</div>` : ''}</header>`;
const mobileBar = () => `<div class="mobile-bar"><button class="icon-btn" data-act="menu" aria-label="Menü">${I.menu}</button><a class="logo" href="#/"><span class="logo-mark">${I.learn}</span><span>LernApp VF11</span></a><span class="mobile-right">${modeBtn()}<a class="avatar sm" href="#/einstellungen" aria-label="Einstellungen">${h((S.get().prefs.name || 'L').charAt(0).toUpperCase())}</a></span></div>`;
const render = (html) => { main.innerHTML = mobileBar() + html; };

// Aktueller Test für Lernen/Quiz/Karteikarten
function focusTest() {
  const st = S.get();
  const chosen = S.test(st.prefs.currentTest);
  if (chosen && S.cardsOf(chosen.id).length) return chosen;
  const last = T.lastTest();
  if (last && S.cardsOf(last.id).length) return last;
  const withCards = st.tests.filter((t) => S.cardsOf(t.id).length);
  const dated = withCards.filter((t) => t.date && daysUntil(t.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  return dated[0] || withCards[0] || null;
}
function testPicker(cur, base) {
  const tests = S.get().tests.filter((t) => S.cardsOf(t.id).length);
  if (tests.length < 2) return '';
  return `<label class="picker">${I.subjects}<select data-pick="${base}" aria-label="Test auswählen">${tests.map((t) => `<option value="${t.id}" ${t.id === cur?.id ? 'selected' : ''}>${h(abbr(S.subject(t.subjectId)?.name || ''))} · ${h(t.title)}</option>`).join('')}</select></label>`;
}
document.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-pick]');
  if (sel) { S.setPrefs({ currentTest: sel.value }); route(); }
});

// ---------- Dashboard ----------
function greeting() {
  const hr = new Date().getHours();
  const g = hr < 11 ? 'Guten Morgen' : hr < 18 ? 'Guten Tag' : 'Guten Abend';
  const n = S.get().prefs.name.trim();
  return n ? `${g}, ${h(n.split(' ')[0])}` : g;
}

// Aufgaben für heute: aus echtem Stand abgeleitet + eigene Aufgaben aus dem Planer
function todayTasks() {
  const st = S.get();
  const out = [];
  const dueAll = st.cards.filter((c) => S.isDue(c.id) && S.progressOf(c.id).last).length;
  const fresh = st.cards.filter((c) => !S.progressOf(c.id).last).length;
  const sum = T.summary();
  const goal = st.prefs.dailyGoal;
  if (dueAll) out.push({ title: `${dueAll} fällige Karten wiederholen`, sub: 'Lernkartei', href: '#/lernen/alle/wiederholen', done: false });
  else if (fresh) out.push({ title: `Neue Karten lernen`, sub: `${fresh} Karten noch nie geübt`, href: '#/lernen/alle/wiederholen', done: false });
  out.push({ title: `Tagesziel: ${goal} Karten`, sub: `${Math.min(sum.todayCards, goal)} von ${goal} geschafft`, href: '#/lernen/alle/wiederholen', done: sum.todayCards >= goal });
  for (const t of st.tests) {
    const d = t.date ? daysUntil(t.date) : null;
    if (!S.cardsOf(t.id).length) { out.push({ title: `Material für „${t.title}“ hinzufügen`, sub: longName(S.subject(t.subjectId)?.name || ''), href: `#/test/${t.id}/material`, done: false }); continue; }
    if (d !== null && d >= 0 && d <= 7) {
      const recent = S.resultsOf(t.id).some((r) => Date.now() - r.date < 2 * DAY);
      out.push({ title: `Probetest „${t.title}“`, sub: `Test ${countdownText(t.date)}`, href: `#/lernen/${t.id}/probetest`, done: recent });
    }
  }
  const today = isoDate();
  for (const x of st.tasks.filter((x) => x.date && x.date <= today && (!x.done || x.date === today))) {
    out.push({ title: h(x.title), sub: x.date < today ? 'überfällig' : 'eigene Aufgabe', task: x.id, done: x.done, prio: x.prio });
  }
  return out;
}
const taskRow = (x) => x.task
  ? `<label class="task ${x.done ? 'done' : ''}"><input type="checkbox" data-task="${x.task}" ${x.done ? 'checked' : ''}><span class="task-box">${I.check}</span><span class="task-txt"><b>${x.title}</b><small>${x.sub}</small></span>${x.prio ? `<span class="prio" data-p="${x.prio}">${x.prio}</span>` : ''}</label>`
  : `<a class="task ${x.done ? 'done' : ''}" href="${x.href}"><span class="task-box">${I.check}</span><span class="task-txt"><b>${x.title}</b><small>${h(x.sub)}</small></span>${I.right}</a>`;
document.addEventListener('change', (e) => {
  const cb = e.target.closest('[data-task]');
  if (cb) { S.updateTask(cb.dataset.task, { done: cb.checked }); cb.closest('.task').classList.toggle('done', cb.checked); }
});

function examPrio(d) { return d <= 3 ? 'hoch' : d <= 7 ? 'mittel' : 'niedrig'; }
function examCard(t) {
  const d = daysUntil(t.date); const s = S.subject(t.subjectId); const { pct } = stats(S.cardsOf(t.id));
  const dt = new Date(t.date + 'T00:00');
  return `<a class="exam" href="#/test/${t.id}">
    <span class="exam-date"><small>${WD[dt.getDay()]}</small><b>${dt.getDate()}</b><small>${MON[dt.getMonth()]}</small></span>
    <span class="exam-txt"><b>${h(t.title)}</b><small>${subjIcon(s, 'xs')} ${h(longName(s?.name || ''))} · ${pct} % sicher</small></span>
    <span class="exam-right"><span class="badge" data-p="${examPrio(d)}">${d === 0 ? 'heute' : d === 1 ? 'morgen' : `${d} Tage`}</span></span>
  </a>`;
}

function viewDashboard() {
  const st = S.get();
  const sum = T.summary();
  const all = stats(st.cards);
  const goal = st.prefs.dailyGoal, wgoal = st.prefs.weeklyGoalMin;
  const streak = S.streakDays();
  const ft = focusTest();
  const exams = st.tests.filter((t) => t.date && daysUntil(t.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const days = T.perDay(7);
  const wrongCount = st.cards.filter((c) => S.progressOf(c.id).wrong > 0 && S.progressOf(c.id).box < 3).length;
  const subtitle = all.total
    ? (all.due ? `Heute warten ${all.due} Karten auf dich${exams[0] ? ` – „${h(exams[0].title)}“ ist ${countdownText(exams[0].date)}` : ''}.` : 'Alles wiederholt. Zeit für ein Quiz oder neues Material.')
    : 'Lege ein Fach an und lade deine Unterlagen hoch – daraus entstehen deine Lernkarten.';
  render(`
    ${pageHead(greeting(), subtitle, `<label class="search">${I.search}<input type="search" id="find" placeholder="Fächer und Tests suchen" aria-label="Suchen"></label><button class="btn primary" data-act="new-subject">${I.plus}<span>Neues Fach</span></button>`)}
    <div id="results" hidden></div>
    <div class="dash" id="dashBody">
      ${card('Lernfortschritt', `
        <div class="progress-hero">
          <div class="ring-wrap">${ring(all.pct, 148, 14)}<div class="ring-label"><b>${all.pct}%</b><small>sicher gelernt</small></div></div>
          <div class="goal-list">
            <div class="goal"><span class="goal-ico">${I.target}</span><div><b>Tagesziel</b><small>${Math.min(sum.todayCards, goal)} / ${goal} Karten</small>${bar(sum.todayCards / goal * 100)}</div></div>
            <div class="goal"><span class="goal-ico">${I.clock}</span><div><b>Wochenziel</b><small>${fmtMin(sum.weekMin)} / ${fmtMin(wgoal)}</small>${bar(sum.weekMin / wgoal * 100)}</div></div>
            <div class="goal"><span class="goal-ico">${I.flame}</span><div><b>Lernserie</b><small>${streak} ${streak === 1 ? 'Tag' : 'Tage'} am Stück</small><div class="streak-dots">${[...Array(7)].map((_, i) => `<i class="${i < Math.min(streak, 7) ? 'on' : ''}"></i>`).join('')}</div></div></div>
          </div>
        </div>
        <p class="card-foot">${all.sure} von ${all.total} Karten sitzen sicher (ab Fach 3 der Lernkartei).</p>`, { cls: 'span-8' })}

      ${card('Weiterlernen', ft ? `
        <div class="continue">
          <span class="continue-meta">${subjIcon(S.subject(ft.subjectId), 'sm')}<span><small>${h(longName(S.subject(ft.subjectId)?.name || ''))}</small><b>${h(ft.title)}</b></span></span>
          ${bar(stats(S.cardsOf(ft.id)).pct)}
          <a class="btn primary block" href="#/lernen/${ft.id}/wiederholen">${I.play}<span>Weiterlernen</span></a>
          <div class="quick">
            <a href="#/lesen">${I.learn}<span>Lektion fortsetzen</span></a>
            <a href="#/lernen/${ft.id}/quiz">${I.quiz}<span>Quiz starten</span></a>
            <a href="${wrongCount ? '#/lernen/alle/fehler' : '#/karteikarten'}" class="${wrongCount ? '' : 'muted-link'}">${I.rotate}<span>Fehler wiederholen${wrongCount ? ` (${wrongCount})` : ''}</span></a>
          </div>
        </div>` : empty('Noch nichts zu lernen', 'Lege ein Fach und einen Test an und lade Material hoch.', `<button class="btn primary" data-act="new-subject">${I.plus}<span>Fach anlegen</span></button>`), { cls: 'span-4' })}

      ${card('Fächer', st.subjects.length ? `<div class="subject-grid">${st.subjects.map(subjectTile).join('')}</div>` : empty('Noch keine Fächer', 'Lege dein erstes Fach an.'), { cls: 'span-8', action: '<a class="link-btn" href="#/faecher">Alle ansehen</a>' })}

      <div class="span-4 stack">
        ${card('Heutige Aufgaben', `<div class="tasks">${todayTasks().slice(0, 6).map(taskRow).join('')}</div>`, { action: '<a class="link-btn" href="#/planer">Planer</a>' })}
        ${card('Nächste Prüfungen', exams.length ? `<div class="exams">${exams.slice(0, 3).map(examCard).join('')}</div>` : `<p class="muted pad-x">Keine Prüfung mit Datum. Trage im Test ein Datum ein, dann erscheint hier ein Countdown.</p>`)}
      </div>

      ${card('Lernzeit diese Woche', sum.totalAnswers ? `
        <div class="time-stats">
          <div class="kpi"><small>Lernzeit</small><b>${fmtMin(sum.weekMin)}</b><span class="delta ${sum.weekMin >= sum.lastWeekMin ? 'up' : 'down'}">${sum.lastWeekMin ? `${sum.weekMin >= sum.lastWeekMin ? '+' : '−'}${fmtMin(Math.abs(sum.weekMin - sum.lastWeekMin))} zur Vorwoche` : 'erste Woche'}</span></div>
          <div class="kpi"><small>Sessions</small><b>${sum.weekSessions}</b><span class="delta">${sum.lastWeekSessions} in der Vorwoche</span></div>
          <div class="kpi"><small>Richtige Antworten</small><b>${sum.weekAccuracy ?? '–'}${sum.weekAccuracy !== null ? '%' : ''}</b><span class="delta">diese Woche</span></div>
          <div class="kpi"><small>Heute gelernt</small><b>${fmtMin(sum.todayMin)}</b><span class="delta">${sum.todayCards} Karten</span></div>
        </div>
        ${barChart(days.map((d) => { const dt = new Date(d.day); return { v: d.min, short: WD[dt.getDay()], label: `${WD_LONG[dt.getDay()]}, ${dt.getDate()}. ${MON[dt.getMonth()]}`, today: d.day === S.startOfDay(Date.now()) }; }))}` :
        empty('Noch keine Lernzeit aufgezeichnet', 'Sobald du Karten, Quiz oder Probetests machst, erscheinen hier deine Lernzeit, Sessions und richtigen Antworten.', ft ? `<a class="btn primary" href="#/lernen/${ft.id}/wiederholen">${I.play}<span>Erste Session starten</span></a>` : ''), { cls: 'span-12', action: '<a class="link-btn" href="#/fortschritt">Details</a>' })}
    </div>`);
  const find = $('#find'), res = $('#results'), body = $('#dashBody');
  find.oninput = () => {
    const q = find.value.trim().toLowerCase();
    body.hidden = !!q; res.hidden = !q;
    if (!q) return;
    const subs = st.subjects.filter((s) => s.name.toLowerCase().includes(q));
    const tests = st.tests.filter((t) => t.title.toLowerCase().includes(q));
    res.innerHTML = card('Suchergebnisse', subs.length + tests.length ? `<div class="list">${[
      ...subs.map((s) => `<a class="list-row" href="#/fach/${s.id}">${subjIcon(s)}<span class="lr-txt"><b>${h(s.name)}</b><small>Fach · ${plural(S.testsOf(s.id).length, 'Test', 'Tests')}</small></span>${I.right}</a>`),
      ...tests.map((t) => `<a class="list-row" href="#/test/${t.id}">${subjIcon(S.subject(t.subjectId))}<span class="lr-txt"><b>${h(t.title)}</b><small>Test · ${plural(S.cardsOf(t.id).length, 'Karte', 'Karten')}</small></span>${I.right}</a>`),
    ].join('')}</div>` : '<p class="muted pad-x">Nichts gefunden.</p>');
  };
}

function subjectTile(s) {
  const tests = S.testsOf(s.id);
  const cards = subjCards(s.id);
  const { pct, due } = stats(cards);
  const act = T.bySubject().find((x) => x.s.id === s.id);
  const next = tests.filter((t) => t.date && daysUntil(t.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  const status = !tests.length ? ['neu', 'Neu'] : !cards.length ? ['leer', 'Kein Material'] : due ? ['faellig', `${due} fällig`] : ['ok', 'Im Plan'];
  return `<a class="subject" href="#/fach/${s.id}">
    <span class="subject-top">${subjIcon(s)}<span class="badge" data-s="${status[0]}">${status[1]}</span></span>
    <b class="subject-name">${h(longName(s.name))}</b>
    <span class="subject-progress">${bar(pct)}<small>${pct}%</small></span>
    <span class="subject-meta"><span><small>Nächster Test</small>${next ? h(countdownText(next.date)) : '–'}</span><span><small>Zuletzt</small>${T.relTime(act?.last)}</span></span>
  </a>`;
}

// ---------- Fächer ----------
function viewSubjects() {
  const st = S.get();
  render(`
    ${pageHead('Fächer', `${plural(st.subjects.length, 'Fach', 'Fächer')} · ${plural(st.tests.length, 'Test', 'Tests')} · ${plural(st.cards.length, 'Karte', 'Karten')}`, `<button class="btn primary" data-act="new-subject">${I.plus}<span>Neues Fach</span></button>`)}
    ${st.subjects.length ? `<div class="subject-grid wide">${st.subjects.map(subjectTile).join('')}<button class="subject add" data-act="new-subject"><span class="add-ico">${I.plus}</span><b>Fach anlegen</b><small>z. B. BWL, Englisch, Mathe</small></button></div>`
      : card('', empty('Noch keine Fächer', 'Lege dein erstes Fach an. Danach legst du darin Tests an und lädst deine Unterlagen hoch.', `<button class="btn primary" data-act="new-subject">${I.plus}<span>Fach anlegen</span></button>`))}`);
}

function viewSubject(id) {
  const s = S.subject(id);
  const tests = S.testsOf(id).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const all = stats(subjCards(id));
  render(`
    <nav class="crumbs"><a href="#/faecher">Fächer</a>${I.right}<span>${h(longName(s.name))}</span></nav>
    ${pageHead(`<span class="title-with-ico">${subjIcon(s, 'lg')}${h(longName(s.name))}</span>`, `${plural(tests.length, 'Test', 'Tests')} · ${all.pct} % sicher gelernt`,
      `<button class="btn" data-act="edit-subject" data-id="${id}">${I.edit}<span>Bearbeiten</span></button><button class="btn primary" data-act="new-test" data-id="${id}">${I.plus}<span>Neuer Test</span></button>`)}
    ${tests.length ? `<div class="test-grid">${tests.map((t) => {
      const st = stats(S.cardsOf(t.id)); const res = S.resultsOf(t.id).at(-1);
      return `<a class="test-card" href="#/test/${t.id}">
        <span class="test-card-top"><b>${h(t.title)}</b>${t.date ? `<span class="badge" data-p="${daysUntil(t.date) < 0 ? 'vorbei' : examPrio(daysUntil(t.date))}">${daysUntil(t.date) < 0 ? 'vorbei' : countdownText(t.date)}</span>` : ''}</span>
        <small>${t.date ? `Test am ${fmtDate(new Date(t.date + 'T00:00'))}` : 'Ohne Datum'}</small>
        <span class="subject-progress">${bar(st.pct)}<small>${st.pct}%</small></span>
        <span class="subject-meta"><span><small>Karten</small>${st.total}</span><span><small>Fällig</small>${st.due}</span><span><small>Probetest</small>${res ? `Note ${res.grade}` : '–'}</span></span>
      </a>`;
    }).join('')}</div>` : card('', empty('Noch kein Test', 'Ein Test sammelt alles, was du dafür lernen musst: Unterlagen, Karten und Probetest-Ergebnisse.', `<button class="btn primary" data-act="new-test" data-id="${id}">${I.plus}<span>Test anlegen</span></button>`))}`);
}

// ---------- Test ----------
const TABS = [['uebersicht', 'Übersicht'], ['material', 'Material'], ['karten', 'Karten'], ['spickzettel', 'Spickzettel'], ['ergebnisse', 'Ergebnisse']];
function viewTest(id, tab = 'uebersicht') {
  const t = S.test(id); const s = S.subject(t.subjectId);
  const cards = S.cardsOf(id); const st = stats(cards);
  if (!TABS.some(([k]) => k === tab)) tab = 'uebersicht';
  render(`
    <nav class="crumbs"><a href="#/faecher">Fächer</a>${I.right}<a href="#/fach/${s.id}">${h(longName(s.name))}</a>${I.right}<span>${h(t.title)}</span></nav>
    ${pageHead(h(t.title), `${t.date ? `Test am ${fmtDate(new Date(t.date + 'T00:00'))} · ${countdownText(t.date)} · ` : ''}${st.total} Karten · ${st.pct} % sicher`,
      `<button class="btn" data-act="edit-test" data-id="${id}">${I.edit}<span>Bearbeiten</span></button>${cards.length ? `<a class="btn primary" href="#/lernen/${id}/wiederholen">${I.play}<span>Lernen${st.due ? ` · ${st.due} fällig` : ''}</span></a>` : ''}`)}
    <nav class="tabs" aria-label="Bereiche">${TABS.map(([k, l]) => `<a href="#/test/${id}/${k}" ${k === tab ? 'aria-current="page"' : ''}>${l}${k === 'karten' ? `<span class="count">${cards.length}</span>` : ''}</a>`).join('')}</nav>
    <div id="tab"></div>`);
  ({ uebersicht: tabOverview, material: tabMaterial, karten: tabCards, spickzettel: tabCheat, ergebnisse: tabResults }[tab])($('#tab'), t);
}

function modeTiles(t, cards, keys) {
  const meta = { karteikarten: ['cards', 'Karteikarten'], quiz: ['quiz', 'Quiz'], ankreuzen: ['listCheck', 'Ankreuzen'], wahrfalsch: ['checkCircle', 'Wahr oder falsch'], lueckentext: ['text', 'Lückentext'], zuordnen: ['shuffle', 'Zuordnen'], probetest: ['exam', 'Probetest'], schreiben: ['pen', 'Antwort schreiben'] };
  return `<div class="mode-grid">${keys.map((k) => {
    const m = MODES.find((x) => x.key === k); const ok = modeAvailable(k, cards);
    return `<a class="mode ${ok ? '' : 'disabled'}" href="#/lernen/${t.id}/${k}" ${ok ? '' : 'aria-disabled="true"'}><span class="mode-ico">${I[meta[k][0]]}</span><b>${meta[k][1]}</b><small>${ok ? m.text : m.missing}</small></a>`;
  }).join('')}</div>`;
}

function tabOverview(el, t) {
  const cards = S.cardsOf(t.id);
  if (!cards.length) {
    el.innerHTML = card('', empty('Noch keine Karten', 'Lade Arbeitsblätter, Mitschriften (PDF, Word, PowerPoint) oder Fotos hoch. Daraus entstehen Karten, Quiz und Probetest.', `<a class="btn primary" href="#/test/${t.id}/material">${I.upload}<span>Material hinzufügen</span></a>`));
    return;
  }
  const stars = cards.filter((c) => c.star);
  const tps = topicsOf(cards, S.docsOf(t.id));
  el.innerHTML = `<div class="dash">
    ${stars.length ? card('Kommt im Test dran', `<div class="list">${stars.map((c) => `<details class="list-row disclose"><summary>${I.star}<span class="lr-txt"><b>${h(c.q)}</b></span><span class="link-btn">Antwort</span></summary><div class="disclose-body">${h(c.a)}</div></details>`).join('')}</div>`, { cls: 'span-12' }) : ''}
    ${card('Üben', modeTiles(t, cards, ['karteikarten', 'quiz', 'ankreuzen', 'wahrfalsch', 'lueckentext', 'zuordnen']), { cls: 'span-8' })}
    ${card('Probetest', `<div class="exam-cta"><span class="mode-ico big">${I.exam}</span><p>Gemischte Aufgaben zum Anklicken, Note nach IHK-Schlüssel.${S.resultsOf(t.id).length ? ` Letzte Note: <b>${S.resultsOf(t.id).at(-1).grade}</b>` : ''}</p><a class="btn primary block" href="#/lernen/${t.id}/probetest">Probetest starten</a></div>`, { cls: 'span-4' })}
    ${tps.length ? card('Abfragen nach Thema', `<div class="list">${tps.map((tp) => `<a class="list-row" href="#/lernen/${t.id}/thema/${encodeURIComponent(tp.key)}"><span class="row-ico">${I[tp.key === 'zeit' ? 'clock' : tp.key.startsWith('doc:') ? 'file' : 'listCheck']}</span><span class="lr-txt"><b>${h(tp.label)}</b><small>${h(tp.sub)}</small></span>${I.right}</a>`).join('')}</div>`, { cls: 'span-12' }) : ''}
    ${t.date && daysUntil(t.date) >= 0 ? card('Lernplan bis zum Test', planStrip(t, cards), { cls: 'span-12' }) : ''}
  </div>`;
}

function planStrip(t, cards) {
  const days = Math.min(daysUntil(t.date), 21);
  const open = cards.filter((c) => S.progressOf(c.id).box < 3).length;
  const per = days > 0 ? Math.ceil(open / days) : open;
  let html = '';
  for (let i = 0; i <= days; i++) {
    const d = new Date(Date.now() + i * DAY);
    const exam = i === days;
    const task = exam ? 'Test' : i === days - 1 ? 'Probetest' : i % 3 === 2 ? 'Quiz' : per ? `${per} Karten` : 'Wiederholen';
    html += `<div class="plan-day ${i === 0 ? 'today' : ''} ${exam ? 'exam' : ''}"><small>${WD[d.getDay()]}</small><b>${d.getDate()}.</b><span>${task}</span></div>`;
  }
  return `<div class="plan-strip">${html}</div>`;
}

// Material
function tabMaterial(el, t) {
  const docs = S.docsOf(t.id);
  el.innerHTML = `<div class="dash">
    ${card('Unterlagen hinzufügen', `
      <label class="drop" id="drop" tabindex="0">
        <span class="drop-ico">${I.upload}</span>
        <b>Dateien hierher ziehen oder auswählen</b>
        <small>PDF, Word, PowerPoint, Text oder Fotos von Arbeitsblättern – auch PDFs aus GoodNotes</small>
        <input type="file" id="file" multiple accept="${ACCEPT}" hidden>
      </label>
      <div class="drop-actions">
        <label class="btn">${I.camera}<span>Foto aufnehmen</span><input type="file" id="cam" accept="image/*" capture="environment" hidden></label>
        <button class="btn" data-act="paste-text" data-id="${t.id}">${I.text}<span>Text einfügen</span></button>
      </div>
      <div id="progress"></div>
      <p class="card-foot">Alles wird nur auf diesem Gerät gelesen und gespeichert – nichts wird hochgeladen.</p>`, { cls: 'span-12' })}
    ${card('Dokumente', docs.length ? `<div class="list">${docs.map((d) => {
      const n = S.get().cards.filter((c) => c.docId === d.id).length;
      return `<div class="list-row doc-row"><span class="row-ico">${I[hasOriginal(d) ? 'camera' : 'file']}</span><span class="lr-txt"><b>${h(d.name)}</b><small>${plural(n, 'Karte', 'Karten')}${d.highlights?.length ? ` · ${plural(d.highlights.length, 'Markierung', 'Markierungen')} erkannt` : ''}${d.done ? ' · gelernt' : ''}</small></span>
        <span class="row-actions">${hasOriginal(d) ? `<button class="btn sm" data-act="show-orig" data-id="${d.id}">${I.eye}<span>Blatt</span></button>` : ''}<a class="btn sm" href="#/lesen/${t.id}/${d.id}">${I.learn}<span>Lesen</span></a><button class="icon-btn" data-act="doc-menu" data-id="${d.id}" aria-label="Weitere Aktionen">${I.edit}</button></span></div>`;
    }).join('')}</div>` : '<p class="muted pad-x">Noch keine Dokumente.</p>', { cls: 'span-12', action: docs.length ? `<button class="link-btn" data-act="regen" data-id="${t.id}">Karten neu erzeugen</button>` : '' })}
  </div>`;
  const input = $('#file'), drop = $('#drop');
  input.onchange = () => handleFiles(t, [...input.files]);
  $('#cam').onchange = (e) => handleFiles(t, [...e.target.files]);
  drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); handleFiles(t, [...e.dataTransfer.files]); };
}

async function handleFiles(t, files) {
  const prog = $('#progress');
  let total = 0;
  for (const f of files) {
    prog.innerHTML = `<div class="progress-line"><b>${h(f.name)}</b><small id="pstat">Wird gelesen …</small><div class="meter"><i class="indet"></i></div></div>`;
    try {
      const r = await extractFile(f, (s) => { const p = $('#pstat'); if (p) p.textContent = s; });
      if (!r.text.trim()) throw new Error('Kein Text gefunden. Bei Fotos: gerade, scharf und hell fotografieren.');
      const d = S.addDoc(t.id, f.name === 'image.jpg' ? `Foto ${fmtDate(Date.now())}` : f.name, r.kind, r.text);
      const fid = S.uid();
      if (await putFile(fid, f)) d.fileIds = [fid];
      d.highlights = r.highlights; S.save();
      total += addGenerated(t.id, d);
    } catch (e) { console.error(e); toast(`${f.name}: ${e.message}`); }
  }
  prog.innerHTML = '';
  toast(`${plural(total, 'neue Karte', 'neue Karten')} erstellt`);
  route();
}

// Karten
let cardFilter = 'alle', cardQuery = '';
function tabCards(el, t) {
  const cards = S.cardsOf(t.id);
  const types = [...new Set(cards.map((c) => c.type))];
  if (!['alle', 'wichtig', ...types].includes(cardFilter)) cardFilter = 'alle';
  const shown = cards.filter((c) => (cardFilter === 'alle' || (cardFilter === 'wichtig' ? c.star : c.type === cardFilter)) && (!cardQuery || (c.q + ' ' + c.a).toLowerCase().includes(cardQuery.toLowerCase())));
  el.innerHTML = card('', `
    <div class="toolbar">
      <label class="search">${I.search}<input type="search" id="cq" placeholder="Karten durchsuchen" value="${h(cardQuery)}" aria-label="Karten durchsuchen"></label>
      <div class="toolbar-actions"><button class="btn" data-act="import-cards" data-id="${t.id}">${I.listCheck}<span>Liste einfügen</span></button><button class="btn primary" data-act="new-card" data-id="${t.id}">${I.plus}<span>Karte</span></button></div>
    </div>
    <div class="chips" role="group" aria-label="Filter">
      ${[['alle', `Alle ${cards.length}`], ['wichtig', `Wichtig ${cards.filter((c) => c.star).length}`], ...types.map((k) => [k, `${TYPE_LABEL[k] || k} ${cards.filter((c) => c.type === k).length}`])].map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${cardFilter === k}">${l}</button>`).join('')}
    </div>
    <p class="hint">Automatisch erzeugte Karten können Fehler haben. Text direkt anklicken und verbessern, unpassende löschen.</p>
    <div class="card-table">
      ${shown.slice(0, 300).map((c) => {
        const p = S.progressOf(c.id);
        return `<div class="card-item" data-card="${c.id}">
          <div><small>${TYPE_LABEL[c.type] || c.type}</small><div class="q" contenteditable="plaintext-only" data-field="q" spellcheck="true">${h(c.q)}</div></div>
          <div><small>Antwort · Fach ${p.box}/5</small><div contenteditable="plaintext-only" data-field="a" spellcheck="true">${h(c.a)}</div></div>
          <div class="card-item-actions">
            <button class="icon-btn star ${c.star ? 'on' : ''}" data-act="star-card" data-id="${c.id}" aria-pressed="${!!c.star}" aria-label="Als wichtig markieren" title="Wichtig: kommt im Probetest immer dran">${I.star}</button>
            <button class="icon-btn" data-act="del-card" data-id="${c.id}" aria-label="Karte löschen">${I.trash}</button>
          </div>
        </div>`;
      }).join('') || '<p class="muted pad-x">Keine Karte gefunden.</p>'}
    </div>`);
  $$('[data-filter]', el).forEach((b) => b.onclick = () => { cardFilter = b.dataset.filter; tabCards(el, t); });
  const q = $('#cq', el);
  q.oninput = () => { cardQuery = q.value; const pos = q.selectionStart; tabCards(el, t); const n = $('#cq'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[contenteditable]', el).forEach((n) => n.addEventListener('blur', () => {
    const v = n.textContent.trim();
    if (v) S.updateCard(n.closest('[data-card]').dataset.card, { [n.dataset.field]: v });
  }));
}

// Spickzettel
function tabCheat(el, t) {
  const docs = S.docsOf(t.id);
  if (!docs.length) { el.innerHTML = card('', empty('Noch kein Material', 'Füge zuerst Unterlagen hinzu.')); return; }
  const text = docs.map((d) => d.text).join('\n\n');
  const hl = docs.flatMap((d) => d.highlights || []);
  const kws = keywords(text, hl, 28);
  const sents = keySentences(text, hl, 14);
  const gloss = S.cardsOf(t.id).filter((c) => ['begriff', 'definition', 'abkuerzung'].includes(c.type) && c.a.length < 160).slice(0, 30);
  const mark = (s) => {
    let out = h(s);
    kws.slice(0, 20).forEach((k) => {
      const re = new RegExp(`(^|[^\\wäöüÄÖÜß])(${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^\\wäöüÄÖÜß]|$)`, 'g');
      out = out.replace(re, '$1<mark>$2</mark>');
    });
    return out;
  };
  el.innerHTML = `<div class="dash">
    ${card('Schlüsselbegriffe', `<div class="terms">${kws.map((k) => `<span class="term">${h(k)}</span>`).join('')}</div>`, { cls: 'span-12' })}
    ${gloss.length ? card('Begriffe', `<dl class="glossary">${gloss.map((c) => `<dt>${h(c.q.replace(/^(Was (ist|sind|versteht man unter)|Wofür steht die Abkürzung) |\?$/g, ''))}</dt><dd>${h(c.a)}</dd>`).join('')}</dl>`, { cls: 'span-6' }) : ''}
    ${card('Kernaussagen', `<ol class="key-list">${sents.map((s) => `<li>${mark(s)}</li>`).join('')}</ol>`, { cls: gloss.length ? 'span-6' : 'span-12' })}
  </div>`;
}

// Ergebnisse
function tabResults(el, t) {
  const res = S.resultsOf(t.id).slice().reverse();
  const cards = S.cardsOf(t.id);
  const box = [0, 1, 2, 3, 4, 5].map((b) => cards.filter((c) => S.progressOf(c.id).box === b).length);
  el.innerHTML = `<div class="dash">
    ${card('Lernkartei', boxChart(box, cards.length), { cls: 'span-6', sub: 'Richtig beantwortete Karten wandern ein Fach weiter. Ab Fach 3 gilt eine Karte als sicher.' })}
    ${card('Probetests', res.length ? `<div class="list">${res.map((r) => `<div class="list-row"><span class="grade-chip" data-g="${r.grade}">${r.grade}</span><span class="lr-txt"><b>${h(r.gradeText || '')}</b><small>${fmtDate(r.date)}</small></span><span class="lr-right"><b>${String(r.points).replace('.', ',')} / ${r.max}</b><small>${Math.round(r.points / r.max * 100)} %</small></span></div>`).join('')}</div>` : empty('Noch kein Probetest', 'Mach einen Probetest – das Ergebnis erscheint hier mit Note.', `<a class="btn primary" href="#/lernen/${t.id}/probetest">Probetest starten</a>`), { cls: 'span-6' })}
  </div>`;
}
function boxChart(box, total) {
  const max = Math.max(...box, 1);
  return `<div class="box-chart">${box.map((n, i) => `<div class="box-col"><b>${n}</b><div class="box-track"><i class="${i >= 3 ? 'sure' : ''}" style="height:${n / max * 100}%" title="${i === 0 ? 'Neu' : `Fach ${i}`}: ${n} Karten"></i></div><small>${i === 0 ? 'Neu' : `Fach ${i}`}</small></div>`).join('')}</div>`;
}

// ---------- Lernen (Leseansicht) ----------
function viewRead(testId, docId) {
  const t = S.test(testId) || focusTest();
  if (!t) { render(pageHead('Lernen', 'Kapitel lesen, zusammenfassen, Notizen machen') + card('', empty('Noch keine Unterlagen', 'Lege ein Fach und einen Test an und lade Unterlagen hoch.', `<a class="btn primary" href="#/faecher">Zu den Fächern</a>`))); return; }
  const docs = S.docsOf(t.id);
  const d = docs.find((x) => x.id === docId) || docs.find((x) => !x.done) || docs[0];
  const s = S.subject(t.subjectId);
  const idx = d ? docs.indexOf(d) : -1;
  const doneN = docs.filter((x) => x.done).length;
  let body = '';
  if (d) {
    body = h(d.text);
    for (const m of (d.highlights || []).slice().sort((a, b) => b.length - a.length)) {
      const e = h(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      body = body.replace(new RegExp(`(?<!<mark>[^<]*)${e}`), `<mark>${h(m)}</mark>`);
    }
    body = body.split(/\n\s*\n/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  }
  const summary = d ? keySentences(d.text, d.highlights || [], 5) : [];
  render(`
    ${pageHead('Lernen', `${h(longName(s?.name || ''))} · ${h(t.title)}`, testPicker(t, 'lesen'))}
    <div class="learn-layout">
      <aside class="card modules">
        <header class="card-head"><div><h2>Kapitel</h2><p class="card-sub">${doneN} von ${docs.length} gelernt</p></div></header>
        ${bar(docs.length ? doneN / docs.length * 100 : 0)}
        <nav class="module-list">${docs.map((x, i) => `<a href="#/lesen/${t.id}/${x.id}" class="module ${x === d ? 'active' : ''} ${x.done ? 'done' : ''}"><span class="module-num">${x.done ? I.check : i + 1}</span><span>${h(x.name.replace(/^(Lesetext|Arbeitsblatt|Kurzarbeit): ?/, ''))}</span></a>`).join('')}</nav>
        <a class="btn block" href="#/test/${t.id}/material">${I.plus}<span>Unterlagen hinzufügen</span></a>
      </aside>
      ${d ? `<article class="card reader">
        <header class="reader-head"><div><small>Kapitel ${idx + 1} von ${docs.length}</small><h2>${h(d.name)}</h2></div>${hasOriginal(d) ? `<button class="btn sm" data-act="show-orig" data-id="${d.id}">${I.eye}<span>Original</span></button>` : ''}</header>
        ${summary.length ? `<div class="summary"><b>${I.sparkle} Das Wichtigste</b><ul>${summary.map((x) => `<li>${h(x)}</li>`).join('')}</ul></div>` : ''}
        <div class="reader-text">${body}</div>
        <div class="note-box"><label for="note"><b>${I.note} Meine Notiz</b></label><textarea id="note" rows="4" placeholder="Was willst du dir merken? Eigene Beispiele, Eselsbrücken …">${h(d.note || '')}</textarea></div>
        <footer class="reader-foot">
          <a class="btn ${idx > 0 ? '' : 'disabled'}" href="${idx > 0 ? `#/lesen/${t.id}/${docs[idx - 1].id}` : '#'}" ${idx > 0 ? '' : 'aria-disabled="true"'}>${I.left}<span>Zurück</span></a>
          <button class="btn" id="saveNote">${I.note}<span>Notiz speichern</span></button>
          <button class="btn ${d.done ? '' : 'primary'}" id="markDone">${I.check}<span>${d.done ? 'Gelernt ✓' : 'Als gelernt markieren'}</span></button>
          <a class="btn ${idx < docs.length - 1 ? '' : 'disabled'}" href="${idx < docs.length - 1 ? `#/lesen/${t.id}/${docs[idx + 1].id}` : '#'}" ${idx < docs.length - 1 ? '' : 'aria-disabled="true"'}><span>Weiter</span>${I.right}</a>
        </footer>
      </article>` : card('', empty('Noch keine Unterlagen', 'Füge Unterlagen hinzu, dann kannst du sie hier lesen.'))}
    </div>`);
  if (!d) return;
  $('#saveNote').onclick = () => { S.updateDoc(d.id, { note: $('#note').value }); toast('Notiz gespeichert'); };
  $('#markDone').onclick = () => {
    S.updateDoc(d.id, { done: !d.done, note: $('#note').value });
    if (!d.done) return route();
    const next = docs.find((x) => !x.done);
    go(next ? `#/lesen/${t.id}/${next.id}` : `#/lesen/${t.id}/${d.id}`);
  };
}

// ---------- Quiz ----------
function viewQuiz(testId) {
  const t = S.test(testId) || focusTest();
  if (!t) { render(pageHead('Quiz', 'Wissen abfragen – alles zum Anklicken') + card('', empty('Noch keine Karten', 'Lade zuerst Unterlagen hoch.', `<a class="btn primary" href="#/faecher">Zu den Fächern</a>`))); return; }
  const cards = S.cardsOf(t.id);
  const tps = topicsOf(cards, S.docsOf(t.id));
  const res = S.resultsOf(t.id).slice(-5).reverse();
  render(`
    ${pageHead('Quiz', `${h(longName(S.subject(t.subjectId)?.name || ''))} · ${h(t.title)}`, testPicker(t, 'quiz'))}
    <div class="dash">
      ${card('Quiz-Arten', modeTiles(t, cards, ['quiz', 'ankreuzen', 'wahrfalsch', 'lueckentext', 'zuordnen', 'probetest']), { cls: 'span-8' })}
      ${card('Letzte Probetests', res.length ? `<div class="list">${res.map((r) => `<div class="list-row"><span class="grade-chip" data-g="${r.grade}">${r.grade}</span><span class="lr-txt"><b>${h(r.gradeText || '')}</b><small>${fmtDate(r.date)}</small></span><span class="lr-right"><b>${Math.round(r.points / r.max * 100)} %</b></span></div>`).join('')}</div>` : `<p class="muted pad-x">Noch kein Probetest für diesen Test.</p>`, { cls: 'span-4' })}
      ${tps.length ? card('Abfragen nach Thema', `<div class="topic-grid">${tps.map((tp) => `<a class="topic" href="#/lernen/${t.id}/thema/${encodeURIComponent(tp.key)}"><span class="row-ico">${I[tp.key === 'zeit' ? 'clock' : tp.key.startsWith('doc:') ? 'file' : 'listCheck']}</span><span class="lr-txt"><b>${h(tp.label)}</b><small>${h(tp.sub)}</small></span>${I.right}</a>`).join('')}</div>`, { cls: 'span-12' }) : ''}
    </div>`);
}

// ---------- Karteikarten ----------
function viewFlash(testId) {
  const t = S.test(testId) || focusTest();
  const st = S.get();
  const scope = t ? S.cardsOf(t.id) : [];
  const due = scope.filter((c) => S.isDue(c.id) && S.progressOf(c.id).last).length;
  const fresh = scope.filter((c) => !S.progressOf(c.id).last).length;
  const hard = st.cards.filter((c) => S.progressOf(c.id).wrong > 0 && S.progressOf(c.id).box < 3).length;
  const box = [0, 1, 2, 3, 4, 5].map((b) => scope.filter((c) => S.progressOf(c.id).box === b).length);
  if (!t) { render(pageHead('Karteikarten') + card('', empty('Noch keine Karten', 'Lade zuerst Unterlagen hoch.', `<a class="btn primary" href="#/faecher">Zu den Fächern</a>`))); return; }
  render(`
    ${pageHead('Karteikarten', `${h(longName(S.subject(t.subjectId)?.name || ''))} · ${h(t.title)}`, testPicker(t, 'karteikarten'))}
    <div class="dash">
      <section class="card span-8 flash-start">
        <div class="flash-preview">${I.cards}</div>
        <div class="flash-start-txt">
          <h2>${due ? `${due} Karten sind heute fällig` : fresh ? `${fresh} neue Karten` : 'Alles wiederholt'}</h2>
          <p class="muted">Karte umdrehen und ehrlich bewerten: <b>Wusste ich</b>, <b>Schwierig</b> oder <b>Wiederholen</b>. Die Lernkartei plant danach, wann die Karte wiederkommt.</p>
          <div class="btn-row"><a class="btn primary" href="#/lernen/${t.id}/wiederholen">${I.play}<span>Session starten</span></a><a class="btn" href="#/lernen/${t.id}/karteikarten">${I.cards}<span>Alle Karten durchgehen</span></a></div>
        </div>
      </section>
      ${card('Schwierige Karten', `<div class="kpi big"><b>${hard}</b><small>Karten, die du schon falsch hattest und noch nicht sicher sitzen</small></div><a class="btn block ${hard ? '' : 'disabled'}" href="${hard ? '#/lernen/alle/fehler' : '#'}">${I.rotate}<span>Fehler wiederholen</span></a>`, { cls: 'span-4' })}
      ${card('Lernkartei', boxChart(box, scope.length), { cls: 'span-12', sub: 'Gewusste Karten wandern ein Fach weiter und kommen seltener dran. Ab Fach 3 gilt eine Karte als sicher.' })}
    </div>`);
}

// ---------- Planer ----------
function viewPlanner() {
  const st = S.get();
  const ws = T.weekStart();
  const today = isoDate();
  const exams = st.tests.filter((t) => t.date && daysUntil(t.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const dayIso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  // Lernblöcke: bis zum Test die offenen Karten gleichmäßig verteilen (abgeleitet, keine erfundenen Termine)
  const blocks = (iso) => {
    const out = [];
    for (const t of exams) {
      const left = daysUntil(t.date), d = Math.round((new Date(iso + 'T00:00') - new Date(today + 'T00:00')) / DAY);
      if (d < 0 || d > left) continue;
      const s = S.subject(t.subjectId);
      if (d === left) { out.push({ kind: 'exam', title: t.title, s, href: `#/test/${t.id}` }); continue; }
      const open = S.cardsOf(t.id).filter((c) => S.progressOf(c.id).box < 3).length;
      const per = left > 0 ? Math.ceil(open / left) : open;
      out.push({ kind: d === left - 1 ? 'probe' : 'learn', title: d === left - 1 ? `Probetest ${t.title}` : per ? `${per} Karten ${t.title}` : `Wiederholen ${t.title}`, s, href: d === left - 1 ? `#/lernen/${t.id}/probetest` : `#/lernen/${t.id}/wiederholen` });
    }
    return out;
  };
  const week = [...Array(7)].map((_, i) => ws + i * DAY);
  render(`
    ${pageHead('Planer', 'Lernblöcke, Aufgaben und Prüfungen im Blick', `<button class="btn primary" data-act="new-task">${I.plus}<span>Aufgabe</span></button>`)}
    ${card('Diese Woche', `<div class="week">${week.map((t) => {
      const iso = dayIso(t); const dt = new Date(t);
      const tasks = st.tasks.filter((x) => x.date === iso);
      const bl = blocks(iso);
      return `<div class="week-day ${iso === today ? 'today' : ''} ${iso < today ? 'past' : ''}">
        <header><small>${WD[dt.getDay()]}</small><b>${dt.getDate()}</b></header>
        <div class="week-items">
          ${bl.map((b) => `<a class="block" data-k="${b.kind}" href="${b.href}">${subjIcon(b.s, 'xs')}<span>${h(b.kind === 'exam' ? `Test: ${b.title}` : b.title)}</span></a>`).join('')}
          ${tasks.map((x) => `<label class="block task-block ${x.done ? 'done' : ''}" data-k="task"><input type="checkbox" data-task="${x.id}" ${x.done ? 'checked' : ''}><span>${h(x.title)}</span></label>`).join('')}
          ${!bl.length && !tasks.length ? '<span class="week-empty">frei</span>' : ''}
        </div>
      </div>`;
    }).join('')}</div>`, { action: '<span class="legend"><i data-k="learn"></i>Lernblock <i data-k="probe"></i>Probetest <i data-k="exam"></i>Prüfung <i data-k="task"></i>Aufgabe</span>' })}
    <div class="dash">
      ${card('Aufgaben', st.tasks.length ? `<div class="tasks">${st.tasks.slice().sort((a, b) => (a.done - b.done) || (a.date || '9').localeCompare(b.date || '9')).map((x) => `
        <div class="task-line ${x.done ? 'done' : ''}"><label class="task"><input type="checkbox" data-task="${x.id}" ${x.done ? 'checked' : ''}><span class="task-box">${I.check}</span><span class="task-txt"><b>${h(x.title)}</b><small>${x.date ? fmtDate(new Date(x.date + 'T00:00')) : 'ohne Datum'}${x.testId && S.test(x.testId) ? ` · ${h(S.test(x.testId).title)}` : ''}</small></span><span class="prio" data-p="${x.prio}">${x.prio}</span></label><button class="icon-btn" data-act="del-task" data-id="${x.id}" aria-label="Aufgabe löschen">${I.trash}</button></div>`).join('')}</div>`
        : empty('Keine eigenen Aufgaben', 'Trage Hausaufgaben, Abgaben oder Erinnerungen ein – sie erscheinen auch auf dem Dashboard.', `<button class="btn primary" data-act="new-task">${I.plus}<span>Aufgabe anlegen</span></button>`), { cls: 'span-7' })}
      ${card('Anstehende Prüfungen', exams.length ? `<div class="exams">${exams.map(examCard).join('')}</div>` : '<p class="muted pad-x">Keine Prüfung mit Datum. Im Test unter „Bearbeiten“ ein Datum eintragen.</p>', { cls: 'span-5' })}
    </div>`);
}

// ---------- Fortschritt ----------
function heatmapHtml() {
  const cols = T.heatmap(17);
  const max = Math.max(1, ...cols.flat().map((c) => c.n));
  const lvl = (n) => (n === 0 ? 0 : n <= max * .25 ? 1 : n <= max * .5 ? 2 : n <= max * .75 ? 3 : 4);
  return `<div class="heat-wrap"><div class="heat-labels"><span>Mo</span><span></span><span>Mi</span><span></span><span>Fr</span><span></span><span>So</span></div>
    <div class="heat">${cols.map((col) => `<div class="heat-col">${col.map((c) => { const d = new Date(c.t); return `<i data-l="${c.future ? 'f' : lvl(c.n)}" title="${d.getDate()}. ${MON[d.getMonth()]}: ${c.n} Antworten"></i>`; }).join('')}</div>`).join('')}</div></div>
    <div class="heat-legend"><span>weniger</span><i data-l="0"></i><i data-l="1"></i><i data-l="2"></i><i data-l="3"></i><i data-l="4"></i><span>mehr</span></div>`;
}

function viewProgress() {
  const st = S.get();
  const sum = T.summary();
  const days = T.perDay(14);
  const subs = T.bySubject();
  const maxN = Math.max(1, ...subs.map((x) => x.n));
  const streak = S.streakDays();
  if (!sum.totalAnswers) {
    render(pageHead('Fortschritt', 'Lernzeit, Sessions und richtige Antworten') + card('', empty('Noch keine Lernaktivität', 'Ab deiner ersten Karteikarten-, Quiz- oder Probetest-Session zeichnet die App hier echte Werte auf: Lernzeit, Sessions, richtige Antworten, Heatmap und Verteilung auf die Fächer.', focusTest() ? `<a class="btn primary" href="#/lernen/${focusTest().id}/wiederholen">${I.play}<span>Jetzt starten</span></a>` : '')) +
      card('Fortschritt je Fach', subjectProgressList(), { cls: 'mt' }));
    return;
  }
  const diff = (a, b, fmt = (x) => x) => (b ? `<span class="delta ${a >= b ? 'up' : 'down'}">${a >= b ? '▲' : '▼'} ${fmt(Math.abs(a - b))} zur Vorwoche</span>` : '<span class="delta">keine Vorwoche</span>');
  render(`
    ${pageHead('Fortschritt', 'Alle Werte stammen aus deiner echten Lernaktivität auf diesem Gerät')}
    <div class="kpi-row">
      <div class="card kpi-card"><span class="kpi-ico">${I.clock}</span><small>Lernzeit diese Woche</small><b>${fmtMin(sum.weekMin)}</b>${diff(sum.weekMin, sum.lastWeekMin, fmtMin)}</div>
      <div class="card kpi-card"><span class="kpi-ico">${I.timer}</span><small>Sessions diese Woche</small><b>${sum.weekSessions}</b>${diff(sum.weekSessions, sum.lastWeekSessions)}</div>
      <div class="card kpi-card"><span class="kpi-ico">${I.checkCircle}</span><small>Richtige Antworten</small><b>${sum.accuracy}%</b><span class="delta">${sum.totalAnswers} Antworten insgesamt</span></div>
      <div class="card kpi-card"><span class="kpi-ico">${I.flame}</span><small>Lernserie</small><b>${streak} ${streak === 1 ? 'Tag' : 'Tage'}</b><span class="delta">${fmtMin(sum.totalMin)} Lernzeit gesamt</span></div>
    </div>
    <div class="dash">
      ${card('Lernzeit der letzten 14 Tage', barChart(days.map((d) => { const dt = new Date(d.day); return { v: d.min, short: `${dt.getDate()}.`, label: `${WD_LONG[dt.getDay()]}, ${dt.getDate()}. ${MON[dt.getMonth()]}`, today: d.day === S.startOfDay(Date.now()) }; }), { height: 160 }), { cls: 'span-8', sub: 'Minuten pro Tag' })}
      ${card('Genauigkeit', `<div class="ring-wrap center">${ring(sum.accuracy, 140, 14)}<div class="ring-label"><b>${sum.accuracy}%</b><small>richtig</small></div></div><p class="card-foot center">${sum.weekAccuracy !== null ? `Diese Woche: ${sum.weekAccuracy} %` : 'Diese Woche noch keine Antworten'}</p>`, { cls: 'span-4' })}
      ${card('Aktivität', heatmapHtml(), { cls: 'span-8', sub: 'Antworten pro Tag, letzte 17 Wochen' })}
      ${card('Lernverteilung', subs.filter((x) => x.n).length ? `<div class="dist">${subs.filter((x) => x.n).sort((a, b) => b.n - a.n).map((x) => `<div class="dist-row"><span class="dist-name">${subjIcon(x.s, 'xs')}${h(longName(x.s.name))}</span><div class="dist-track"><i style="width:${x.n / maxN * 100}%" title="${x.n} Antworten"></i></div><b>${x.n}</b></div>`).join('')}</div>` : '<p class="muted pad-x">Noch keine Antworten einem Fach zugeordnet.</p>', { cls: 'span-4', sub: 'Antworten je Fach' })}
      ${card('Fortschritt je Fach', subjectProgressList(), { cls: 'span-12' })}
    </div>`);
}
function subjectProgressList() {
  const st = S.get();
  return st.subjects.length ? `<div class="list">${st.subjects.map((s) => {
    const x = stats(subjCards(s.id)); const act = T.bySubject().find((b) => b.s.id === s.id);
    return `<a class="list-row" href="#/fach/${s.id}">${subjIcon(s)}<span class="lr-txt"><b>${h(longName(s.name))}</b><small>${x.total ? `${x.sure} von ${x.total} Karten sicher · zuletzt ${T.relTime(act?.last)}` : 'noch keine Karten'}</small></span><span class="lr-bar">${bar(x.pct)}<small>${x.pct}%</small></span></a>`;
  }).join('')}</div>` : '<p class="muted pad-x">Noch keine Fächer.</p>';
}

// ---------- Einstellungen ----------
function viewSettings() {
  const st = S.get(); const p = st.prefs;
  const kb = (new Blob([S.exportJSON()]).size / 1024).toFixed(0);
  render(`
    ${pageHead('Einstellungen', 'Profil, Ziele und Daten')}
    <div class="dash">
      ${card('Profil', `<form class="form" id="profile">
        <div class="profile-row"><span class="avatar lg">${h((p.name || 'L').charAt(0).toUpperCase())}</span><label class="field">Dein Name<input type="text" name="name" value="${h(p.name)}" placeholder="z. B. Alex" autocomplete="given-name"></label></div>
        <p class="hint">Nur für die Begrüßung. Der Name bleibt auf diesem Gerät.</p>
        <button class="btn primary">Speichern</button></form>`, { cls: 'span-6' })}
      ${card('Lernziele', `<form class="form" id="goals">
        <label class="field">Tagesziel<span class="input-unit"><input type="number" name="dailyGoal" min="5" max="500" step="5" value="${p.dailyGoal}"><span>Karten pro Tag</span></span></label>
        <label class="field">Wochenziel<span class="input-unit"><input type="number" name="weeklyGoalMin" min="15" max="2000" step="15" value="${p.weeklyGoalMin}"><span>Minuten pro Woche</span></span></label>
        <button class="btn primary">Ziele speichern</button></form>`, { cls: 'span-6' })}
      ${card('Darstellung', `<div class="pad-x"><div class="theme-toggle" role="group" aria-label="Farbschema">${[['light', 'Hell', 'sun'], ['dark', 'Dunkel', 'moon'], ['auto', 'Automatisch', 'monitor']].map(([k, l, ic]) => `<button data-theme-set="${k}" aria-pressed="${(p.theme || 'light') === k}">${I[ic]}${l}</button>`).join('')}</div><p class="hint" style="margin-top:12px">„Automatisch“ folgt der Einstellung deines Geräts.</p></div>`, { cls: 'span-12' })}
      ${card('Daten & Sicherung', `<div class="list">
        <button class="list-row" data-act="backup"><span class="row-ico">${I.download}</span><span class="lr-txt"><b>Sicherung herunterladen</b><small>Alle Fächer, Karten und Fortschritte (${kb} KB). Originalfotos sind nicht enthalten.</small></span>${I.right}</button>
        <label class="list-row"><span class="row-ico">${I.upload}</span><span class="lr-txt"><b>Sicherung laden</b><small>Von einem anderen Gerät übernehmen</small></span>${I.right}<input type="file" accept=".json,application/json" id="restore" hidden></label>
        <button class="list-row" data-act="demo"><span class="row-ico">${I.sparkle}</span><span class="lr-txt"><b>Beispiel laden</b><small>Deutsch: „Eine Frage der Ehre“</small></span>${I.right}</button>
      </div>`, { cls: 'span-6', sub: 'Deine Daten liegen nur in diesem Browser.' })}
      ${card('Gefahrenzone', `<p class="muted pad-x">Entfernt alle Fächer, Tests, Dokumente, Karten, Aufgaben und Statistiken (${plural(st.cards.length, 'Karte', 'Karten')}).</p><div class="pad-x"><button class="btn danger" data-act="reset">${I.trash}<span>Alles löschen</span></button></div>`, { cls: 'span-6' })}
    </div>`);
  $$('[data-theme-set]').forEach((b) => b.onclick = () => { S.setPrefs({ theme: b.dataset.themeSet }); applyTheme(); route(); });
  $('#profile').onsubmit = (e) => { e.preventDefault(); S.setPrefs({ name: new FormData(e.target).get('name').trim() }); toast('Gespeichert'); route(); };
  $('#goals').onsubmit = (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    S.setPrefs({ dailyGoal: Math.max(5, +fd.get('dailyGoal') || 20), weeklyGoalMin: Math.max(15, +fd.get('weeklyGoalMin') || 120) }); toast('Ziele gespeichert');
  };
  $('#restore').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const text = await f.text();
    openDialog(`<h2>Sicherung laden</h2><p class="muted">Mit deinen vorhandenen Daten zusammenführen oder alles ersetzen?</p>
      <div class="dialog-actions"><button class="btn" value="cancel" formnovalidate>Abbrechen</button><button class="btn danger" value="replace">Ersetzen</button><button class="btn primary" value="merge">Zusammenführen</button></div>`,
    (fd, btn) => { try { S.importJSON(text, btn === 'replace' ? 'replace' : 'merge'); toast('Sicherung geladen'); go('#/'); } catch (err) { toast(err.message); } });
  };
}

// ---------- Dialoge ----------
function openDialog(html, onSubmit) {
  dlg.innerHTML = `<form method="dialog">${html}</form>`;
  const form = $('form', dlg);
  form.onsubmit = (e) => {
    if (e.submitter?.value === 'cancel') return;
    e.preventDefault();
    if (onSubmit(new FormData(form), e.submitter?.value) !== false) dlg.close();
  };
  dlg.showModal();
  $('input:not([type=hidden]),textarea,select', form)?.focus();
}
const swatches = (cur) => `<div class="swatches" role="radiogroup" aria-label="Farbe">${COLORS.map((c) => `<label title="${COLOR_NAME[c]}"><input type="radio" name="color" value="${c}" ${c === cur ? 'checked' : ''} aria-label="${COLOR_NAME[c]}"><span class="subj-ico" data-tone="${c}"></span></label>`).join('')}</div>`;
const dlgButtons = (ok, extra = '') => `<div class="dialog-actions">${extra}<button class="btn" value="cancel" formnovalidate>Abbrechen</button><button class="btn primary" value="ok">${ok}</button></div>`;
// Rückfrage im Dialog statt Browser-Popup (auf Handys teils gesperrt)
function confirmDialog(text, label, action) {
  openDialog(`<h2>${h(text)}</h2><p class="muted">Das lässt sich nicht rückgängig machen.</p><div class="dialog-actions"><button class="btn" value="cancel" formnovalidate>Abbrechen</button><button class="btn danger" value="ok">${label}</button></div>`, () => { action(); });
}

const ACTIONS = {
  menu() { document.body.classList.toggle('nav-open'); },
  'toggle-theme'() { S.setPrefs({ theme: isDark() ? 'light' : 'dark' }); applyTheme(); route(); },
  'new-subject'() {
    const used = S.get().subjects.map((s) => s.color);
    openDialog(`<h2>Neues Fach</h2>
      <label class="field">Name<input type="text" name="name" required placeholder="z. B. BWL, Englisch, Mathematik"></label>
      <div class="field"><span>Farbe</span>${swatches(COLORS.find((c) => !used.includes(c)) || COLORS[0])}</div>${dlgButtons('Fach anlegen')}`,
    (fd) => { const s = S.addSubject(fd.get('name'), fd.get('color')); go(`#/fach/${s.id}`); });
  },
  'edit-subject'(id) {
    const s = S.subject(id);
    openDialog(`<h2>Fach bearbeiten</h2>
      <label class="field">Name<input type="text" name="name" required value="${h(s.name)}"></label>
      <div class="field"><span>Farbe</span>${swatches(s.color)}</div>
      ${dlgButtons('Speichern', '<button class="btn danger-text" value="delete" formnovalidate>Löschen</button>')}`,
    (fd, btn) => {
      if (btn === 'delete') { setTimeout(() => confirmDialog(`„${s.name}“ mit allen Tests löschen?`, 'Fach löschen', () => { S.deleteSubject(id); go('#/faecher'); })); return; }
      S.updateSubject(id, { name: fd.get('name').trim(), color: fd.get('color') }); route();
    });
  },
  'new-test'(subjectId) {
    openDialog(`<h2>Neuer Test</h2>
      <label class="field">Thema<input type="text" name="title" required placeholder="z. B. Kaufvertrag, Unit 3"></label>
      <label class="field">Datum der Prüfung <span class="opt">optional</span><input type="date" name="date" min="${isoDate()}"></label>
      <label class="field">Was kommt dran? <span class="opt">optional</span><input type="text" name="notes" placeholder="z. B. Seiten 12–30"></label>
      ${dlgButtons('Test anlegen')}`,
    (fd) => { const t = S.addTest(subjectId, fd.get('title'), fd.get('date'), fd.get('notes')); go(`#/test/${t.id}/material`); });
  },
  'edit-test'(id) {
    const t = S.test(id);
    openDialog(`<h2>Test bearbeiten</h2>
      <label class="field">Thema<input type="text" name="title" required value="${h(t.title)}"></label>
      <label class="field">Datum der Prüfung<input type="date" name="date" value="${h(t.date)}"></label>
      <label class="field">Was kommt dran?<input type="text" name="notes" value="${h(t.notes || '')}"></label>
      ${dlgButtons('Speichern', '<button class="btn danger-text" value="delete" formnovalidate>Löschen</button>')}`,
    (fd, btn) => {
      if (btn === 'delete') { setTimeout(() => confirmDialog(`„${t.title}“ mit allen Karten löschen?`, 'Test löschen', () => { const sid = t.subjectId; S.deleteTest(id); go(`#/fach/${sid}`); })); return; }
      S.updateTest(id, { title: fd.get('title').trim(), date: fd.get('date'), notes: fd.get('notes') }); route();
    });
  },
  'new-task'() {
    const tests = S.get().tests;
    openDialog(`<h2>Neue Aufgabe</h2>
      <label class="field">Aufgabe<input type="text" name="title" required placeholder="z. B. Hausaufgabe S. 34, Referat vorbereiten"></label>
      <div class="field-row"><label class="field">Datum<input type="date" name="date" value="${isoDate()}"></label>
      <label class="field">Priorität<select name="prio"><option value="hoch">hoch</option><option value="mittel" selected>mittel</option><option value="niedrig">niedrig</option></select></label></div>
      ${tests.length ? `<label class="field">Gehört zu <span class="opt">optional</span><select name="testId"><option value="">–</option>${tests.map((t) => `<option value="${t.id}">${h(abbr(S.subject(t.subjectId)?.name || ''))} · ${h(t.title)}</option>`).join('')}</select></label>` : ''}
      ${dlgButtons('Hinzufügen')}`,
    (fd) => { S.addTask({ title: fd.get('title').trim(), date: fd.get('date'), prio: fd.get('prio'), testId: fd.get('testId') || null }); toast('Aufgabe hinzugefügt'); route(); });
  },
  'del-task'(id) { S.deleteTask(id); route(); },
  'paste-text'(testId) {
    openDialog(`<h2>Text einfügen</h2>
      <label class="field">Titel<input type="text" name="name" required value="Mitschrift ${fmtDate(Date.now())}"></label>
      <label class="field">Text<textarea name="text" required rows="10" placeholder="Tipp: „Begriff: Erklärung“ pro Zeile wird eine Karteikarte. Eine Zeile mit „?“ und die Antwort darunter wird eine Frage-Karte."></textarea></label>
      ${dlgButtons('Karten erzeugen')}`,
    (fd) => { const d = S.addDoc(testId, fd.get('name'), 'text', fd.get('text')); toast(`${plural(addGenerated(testId, d), 'neue Karte', 'neue Karten')} erstellt`); route(); });
  },
  'show-orig'(id) { openOriginal(S.get().docs.find((x) => x.id === id)); },
  'doc-menu'(id) {
    const d = S.get().docs.find((x) => x.id === id);
    openDialog(`<h2>${h(d.name)}</h2>
      <div class="list">
        <button class="list-row" value="edit"><span class="row-ico">${I.edit}</span><span class="lr-txt"><b>Text korrigieren</b><small>Fehler der Texterkennung verbessern, Karten neu erzeugen</small></span></button>
        <button class="list-row danger" value="delete"><span class="row-ico">${I.trash}</span><span class="lr-txt"><b>Entfernen</b><small>Dokument und die Karten daraus löschen</small></span></button>
      </div><div class="dialog-actions"><button class="btn" value="cancel" formnovalidate>Schließen</button></div>`,
    (fd, btn) => {
      if (btn === 'edit') setTimeout(() => openDialog(`<h2>Text korrigieren</h2><p class="muted">Danach werden die Karten aus diesem Dokument neu erzeugt.</p><label class="field">Text<textarea name="text" rows="14">${h(d.text)}</textarea></label>${dlgButtons('Speichern')}`,
        (f2) => { d.text = f2.get('text'); regenerateDoc(d); route(); }));
      if (btn === 'delete') setTimeout(() => confirmDialog(`„${d.name}“ entfernen?`, 'Entfernen', () => { S.deleteDoc(id, true); route(); }));
    });
  },
  regen(testId) { let n = 0; S.docsOf(testId).forEach((d) => { n += regenerateDoc(d, true); }); toast(`${plural(n, 'neue Karte', 'neue Karten')} ergänzt`); route(); },
  'new-card'(testId) {
    openDialog(`<h2>Eigene Karte</h2>
      <label class="field">Vorderseite<textarea name="q" required rows="3" placeholder="Frage oder Begriff"></textarea></label>
      <label class="field">Rückseite<textarea name="a" required rows="3" placeholder="Antwort"></textarea></label>
      ${dlgButtons('Speichern', '<button class="btn" value="more">Speichern & nächste</button>')}`,
    (fd, btn) => {
      S.addCards([{ testId, type: 'manuell', q: fd.get('q'), a: fd.get('a') }]);
      if (btn === 'more') { toast('Karte gespeichert'); setTimeout(() => ACTIONS['new-card'](testId)); return; }
      route();
    });
  },
  'import-cards'(testId) {
    openDialog(`<h2>Liste einfügen</h2>
      <p class="muted">Eine Karte pro Zeile: <b>Frage | Antwort</b> (Tab oder Semikolon geht auch).</p>
      <label class="field">Karten<textarea name="list" required rows="10" placeholder="Gilde | Zusammenschluss von Kaufleuten"></textarea></label>
      ${dlgButtons('Übernehmen')}`,
    (fd) => {
      const rows = fd.get('list').split('\n').map((l) => l.split(/\s*(?:\||\t|;)\s*/)).filter((p) => p.length >= 2 && p[0].trim() && p[1].trim());
      toast(`${plural(S.addCards(rows.map(([q, ...a]) => ({ testId, type: 'import', q: q.trim(), a: a.join('; ').trim() }))), 'Karte', 'Karten')} übernommen`); route();
    });
  },
  'star-card'(id) {
    const c = S.get().cards.find((x) => x.id === id);
    S.updateCard(id, { star: !c.star });
    const b = $(`[data-act="star-card"][data-id="${id}"]`);
    if (b) { b.classList.toggle('on', !!c.star); b.setAttribute('aria-pressed', !!c.star); }
  },
  'del-card'(id) { S.deleteCard(id); $(`[data-card="${id}"]`)?.remove(); },
  backup() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([S.exportJSON()], { type: 'application/json' }));
    a.download = `lernapp-sicherung-${isoDate()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  reset() { confirmDialog('Wirklich alles löschen?', 'Alles löschen', () => { S.resetAll(); toast('Alles gelöscht'); go('#/'); }); },
  demo() { const t = loadBeispiel(); if (!t) toast('Beispiel ist schon geladen'); else { toast(`Beispiel geladen: ${S.cardsOf(t.id).length} Karten`); go(`#/test/${t.id}`); } },
};

function regenerateDoc(d, keepExisting = false) {
  const fresh = generate(d.text, { highlights: d.highlights || [] });
  const key = (c) => (c.q + '|' + c.a).toLowerCase();
  const freshKeys = new Set(fresh.map(key));
  if (!keepExisting) S.get().cards.filter((c) => c.docId === d.id && !['manuell', 'import'].includes(c.type) && !freshKeys.has(key(c))).forEach((c) => S.deleteCard(c.id));
  S.save();
  return S.addCards(fresh.map((c) => ({ ...c, testId: d.testId, docId: d.id })));
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b) { e.preventDefault(); ACTIONS[b.dataset.act]?.(b.dataset.id); return; }
  if (e.target.closest('a[aria-disabled="true"], .mode.disabled')) e.preventDefault();
  if (document.body.classList.contains('nav-open') && e.target.classList.contains('scrim')) document.body.classList.remove('nav-open');
});
dlg.addEventListener('click', (e) => {
  if (e.target !== dlg) return;
  const r = dlg.getBoundingClientRect();
  if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) dlg.close();
});
document.addEventListener('lernapp:savefail', () => toast('Speichern fehlgeschlagen – Browser-Speicher voll. Alte Dokumente löschen oder Sicherung machen.'));
try { localStorage.removeItem('lernapp.theme'); } catch {}
applyTheme();
migrate();
route();
