import * as S from './store.js';
import { generate, keywords, keySentences, TYPE_LABEL } from './gen.js';
import { extractFile, ACCEPT } from './extract.js';
import { addGenerated, loadBeispiel, migrate } from './setup.js';
import { startSession } from './learn.js';
import * as V from './views.js';
import { putFile } from './files.js';
import { openOriginal, hasOriginal } from './viewer.js';
import { h, $, $$, toast, cvar, COLORS, COLOR_NAME, countdownText, daysUntil, dateParts, fmtDate, isoDate, plural, ICON } from './util.js';

const main = $('#main');
const rail = $('#rail');

// ---------- Router ----------
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  rail.classList.remove('open');
  renderRail(parts);
  const [view, id, sub] = parts;
  window.scrollTo(0, 0);
  if (view === 'fach' && S.subject(id)) return viewSubject(id);
  if (view === 'test' && S.test(id)) return viewTest(id, sub || 'lernen');
  if (view === 'lernen') return startSession(main, id, sub, parts[3]);
  if (view === 'einstellungen') return viewSettings();
  return viewHome();
}
window.addEventListener('hashchange', route);
export const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

// ---------- Seitenleiste (wie die Seitenleiste in macOS-Apps) ----------
const NAV_ICON = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg>',
  repeat: ICON.repeat,
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
};

function renderRail(parts) {
  const st = S.get();
  const cur = parts[0] === 'fach' ? parts[1] : ['test', 'lernen'].includes(parts[0]) ? S.test(parts[1])?.subjectId : null;
  const due = st.cards.filter((c) => S.isDue(c.id) && S.progressOf(c.id).last).length;
  rail.innerHTML = `
    <a class="brand" href="#/"><span class="app-ico lg brand-ico" aria-hidden="true">${NAV_ICON.home}</span><b>LernApp</b></a>
    <nav class="side-list">
      <a class="side-row" href="#/" ${!parts.length ? 'aria-current="page"' : ''}><span class="app-ico" data-tone="blau">${NAV_ICON.home}</span>Übersicht</a>
      <a class="side-row" href="#/lernen/alle/wiederholen"><span class="app-ico" data-tone="gruen">${NAV_ICON.repeat}</span>Wiederholen${due ? `<span class="badge">${due}</span>` : ''}</a>
    </nav>
    <p class="side-head">Fächer</p>
    <nav class="side-list">
      ${st.subjects.map((s) => `<a class="side-row" href="#/fach/${s.id}" ${cur === s.id ? 'aria-current="page"' : ''}>${V.subjectIcon(s)}<span class="nm">${h(V.longName(s.name))}</span></a>`).join('')}
      <button class="side-row add" data-act="new-subject"><span class="app-ico add">${V.PLUS}</span>Fach anlegen</button>
    </nav>
    <div class="spacer"></div>
    <nav class="side-list">
      <a class="side-row" href="handy/"><span class="app-ico" data-tone="grau">${NAV_ICON.phone}</span>Handy-Version</a>
      <a class="side-row" href="#/einstellungen" ${parts[0] === 'einstellungen' ? 'aria-current="page"' : ''}><span class="app-ico" data-tone="grau">${NAV_ICON.gear}</span>Einstellungen</a>
    </nav>`;
  if (!$('.menu-btn')) {
    const b = document.createElement('button');
    b.className = 'btn menu-btn small'; b.innerHTML = `${ICON.menu} Menü`; b.setAttribute('aria-controls', 'rail');
    b.onclick = () => rail.classList.toggle('open');
    document.body.appendChild(b);
  }
}

// ---------- Übersicht ----------
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function viewHome() {
  const st = S.get();
  const now = new Date();
  const due = st.cards.filter((c) => S.isDue(c.id) && S.progressOf(c.id).last).length;
  const fresh = st.cards.filter((c) => !S.progressOf(c.id).last).length;
  const sure = st.cards.filter((c) => S.progressOf(c.id).box >= 3).length;
  const streak = S.streakDays();
  const upcoming = st.tests.filter((t) => t.date && daysUntil(t.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  main.innerHTML = `
    <header class="page-head pc-head">
      <div><p class="eyebrow">${WD[now.getDay()]}, ${now.getDate()}. ${MON[now.getMonth()]}</p><h1 class="large-title">Übersicht</h1></div>
      <label class="search">${V.SEARCH}<input type="search" id="find" placeholder="Fächer und Tests durchsuchen" aria-label="Fächer und Tests durchsuchen"></label>
    </header>
    <div id="results" hidden></div>
    <div id="homeBody" class="stack-l">
      <div class="home-grid">
        ${V.focusCard(V.focusTest())}
        <div class="stack-l">
          <a class="stats" href="#/lernen/alle/wiederholen" aria-label="Wiederholen">
            <span><b>${due || fresh}</b><small>${due ? 'heute fällig' : 'neue Karten'}</small></span>
            <span><b>${sure}</b><small>sicher gelernt</small></span>
            <span><b>${streak}</b><small>${streak === 1 ? 'Tag' : 'Tage'} am Stück</small></span>
          </a>
          ${upcoming.length ? V.group('Nächste Tests', upcoming.slice(0, 3).map(V.testCell).join('')) : V.group('Nächste Tests', V.cell({ title: 'Kein Test mit Datum', sub: 'Öffne ein Fach und lege einen Test mit Datum an.', chev: false }))}
        </div>
      </div>
      ${V.group('Fächer', st.subjects.map(V.subjectCell).join('') + V.cell({ act: 'new-subject', icon: `<span class="app-ico add" aria-hidden="true">${V.PLUS}</span>`, title: '<span class="link">Fach anlegen</span>', chev: false }))}
    </div>`;
  const find = $('#find'), res = $('#results'), body = $('#homeBody');
  find.oninput = () => {
    const q = find.value.trim().toLowerCase();
    body.hidden = !!q; res.hidden = !q;
    if (q) res.innerHTML = V.searchHtml(q);
  };
}

const crumb = (href, label) => `<a class="nav-back" href="${href}">${V.BACK}<span>${h(label)}</span></a>`;

// ---------- Fach ----------
function viewSubject(id) {
  const s = S.subject(id);
  const tests = S.testsOf(id).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  main.innerHTML = `
    <div class="pc-bar">${crumb('#/', 'Übersicht')}<span class="row"><button class="btn small" data-act="edit-subject" data-id="${id}">Bearbeiten</button><button class="btn small primary" data-act="new-test" data-id="${id}">${V.PLUS} Test anlegen</button></span></div>
    <header class="page-head subject-head">${V.subjectIcon(s, 'lg')}<h1 class="large-title">${h(V.longName(s.name))}</h1></header>
    ${V.group('Tests', tests.map(V.testCell).join('') + V.cell({ act: 'new-test', id, icon: `<span class="app-ico add" aria-hidden="true">${V.PLUS}</span>`, title: '<span class="link">Test anlegen</span>', chev: false }),
      tests.length ? '' : 'Ein Test sammelt alles, was du dafür lernen musst: Dokumente, Karten und deine Probetest-Ergebnisse.')}`;
}

// ---------- Test ----------
const TABS = [['lernen', 'Lernen'], ['material', 'Material'], ['karten', 'Karten'], ['spickzettel', 'Spickzettel'], ['ergebnisse', 'Ergebnisse']];

function viewTest(id, tab) {
  const t = S.test(id);
  const s = S.subject(t.subjectId);
  const cards = S.cardsOf(id);
  main.innerHTML = `
    <div class="pc-bar">${crumb(`#/fach/${s.id}`, V.longName(s.name))}<span class="row"><button class="btn small" data-act="edit-test" data-id="${id}">Bearbeiten</button></span></div>
    ${V.testHeader(t)}
    <nav class="seg" aria-label="Bereiche">${TABS.map(([k, l]) => `<a href="#/test/${id}/${k}" aria-current="${k === tab ? 'page' : 'false'}">${l}${k === 'karten' ? ` (${cards.length})` : ''}</a>`).join('')}</nav>
    <div id="tab" class="stack-l"></div>`;
  const el = $('#tab');
  ({ lernen: tabLearn, material: tabMaterial, karten: tabCards, spickzettel: tabCheat, ergebnisse: tabResults }[tab] || tabLearn)(el, t);
}

function tabLearn(el, t) {
  const cards = S.cardsOf(t.id);
  if (!cards.length) {
    el.innerHTML = `<div class="empty"><p class="empty-title">Noch keine Karten</p><p>Lade Arbeitsblätter, Mitschriften (PDF, Word, PowerPoint) oder Fotos hoch. Daraus entstehen die Abfragen.</p>
      <a class="btn primary big" href="#/test/${t.id}/material">Material hinzufügen</a></div>`;
    return;
  }
  const known = cards.filter((c) => S.progressOf(c.id).box >= 3).length;
  el.innerHTML = `<div class="learn-grid">${V.learnHtml(t)}</div>` +
    (t.date && daysUntil(t.date) >= 0 ? `<section class="group"><h2 class="group-title">Lernplan bis zum Test</h2>${planHtml(t, cards)}<p class="group-foot">${known} von ${cards.length} Karten sicher</p></section>` : '');
}

function planHtml(t, cards) {
  const days = Math.min(daysUntil(t.date), 21);
  const open = cards.filter((c) => S.progressOf(c.id).box < 3).length;
  const perDay = days > 0 ? Math.ceil(open / days) : open;
  const items = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(Date.now() + i * 864e5);
    const exam = i === days && daysUntil(t.date) === days;
    let task;
    if (exam) task = 'Test';
    else if (i === days - 1) task = 'Probetest';
    else if (i % 3 === 2) task = 'Quiz';
    else task = perDay ? `${perDay} Karten` : 'Wiederholen';
    items.push(`<div class="day ${i === 0 ? 'is-today' : ''} ${exam ? 'exam' : ''}"><b>${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()]} ${d.getDate()}.</b>${task}</div>`);
  }
  return `<div class="plan">${items.join('')}</div>`;
}

// Material
function tabMaterial(el, t) {
  const docs = S.docsOf(t.id);
  el.innerHTML = `
    <section class="stack">
      <label class="drop" id="drop" tabindex="0">
        ${ICON.upload}
        <h3>Dateien hierher ziehen oder klicken</h3>
        <span class="muted small">PDF, Word, PowerPoint, Text oder Fotos von Arbeitsblättern (JPG, PNG). Mehrere auf einmal gehen auch.</span>
        <input type="file" id="file" multiple accept="${ACCEPT}" hidden>
      </label>
      <div id="progress"></div>
      <div class="row"><button class="btn" data-act="paste-text" data-id="${t.id}">Text einfügen</button>
      <span class="small muted">Alles wird nur auf diesem PC verarbeitet – nichts wird hochgeladen.</span></div>
    </section>
    <section>
      <div class="section-title"><h2>Dokumente</h2>${docs.length ? `<button class="btn small" data-act="regen" data-id="${t.id}">Karten neu erzeugen</button>` : ''}</div>
      ${docs.length ? `<div class="doc-list">${docs.map((d) => {
        const n = S.get().cards.filter((c) => c.docId === d.id).length;
        return `<div class="sheet doc"><span class="kind">${h(d.kind)}</span>
          <div><b>${h(d.name)}</b><div class="small muted">${d.text.length.toLocaleString('de-DE')} Zeichen · ${plural(n, 'Karte', 'Karten')}${d.highlights?.length ? ` · ${plural(d.highlights.length, 'Markierung', 'Markierungen')} erkannt` : ''}</div></div>
          <div class="row">${hasOriginal(d) ? `<button class="btn small primary" data-act="show-orig" data-id="${d.id}">Blatt ansehen</button>` : ''}<button class="btn small ${hasOriginal(d) ? '' : 'primary'}" data-act="read-doc" data-id="${d.id}">Lesen</button><button class="btn small" data-act="edit-doc" data-id="${d.id}">Text prüfen</button><button class="btn small ghost" data-act="del-doc" data-id="${d.id}">Entfernen</button></div></div>`;
      }).join('')}</div>` : '<p class="muted">Noch keine Dokumente.</p>'}
    </section>`;
  const input = $('#file'), drop = $('#drop');
  input.onchange = () => handleFiles(t, [...input.files]);
  drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); handleFiles(t, [...e.dataTransfer.files]); };
}

async function handleFiles(t, files) {
  const prog = $('#progress');
  let total = 0;
  for (const f of files) {
    prog.innerHTML = `<div class="sheet progress-line"><b>${h(f.name)}</b><span class="muted small" id="pstat">Wird gelesen …</span><div class="bar"><i style="width:30%;background:var(--blue)"></i></div></div>`;
    try {
      const r = await extractFile(f, (s) => { const p = $('#pstat'); if (p) p.textContent = s; });
      if (!r.text.trim()) throw new Error('Kein Text gefunden. Bei Fotos: gerade, scharf und hell fotografieren.');
      const d = S.addDoc(t.id, f.name, r.kind, r.text);
      const fid = S.uid();
      if (await putFile(fid, f)) d.fileIds = [fid];
      d.highlights = r.highlights; S.save();
      total += addGenerated(t.id, d);
    } catch (e) {
      console.error(e);
      toast(`${f.name}: ${e.message}`);
    }
  }
  prog.innerHTML = '';
  toast(`${plural(total, 'neue Karte', 'neue Karten')} erstellt`);
  route();
}


// Karten
let cardFilter = 'alle';
function tabCards(el, t) {
  const cards = S.cardsOf(t.id);
  const types = [...new Set(cards.map((c) => c.type))];
  if (!types.includes(cardFilter)) cardFilter = 'alle';
  const shown = cardFilter === 'alle' ? cards : cards.filter((c) => c.type === cardFilter);
  el.innerHTML = `
    <div class="section-title">
      <div class="filters" role="group" aria-label="Kartenart">
        <button class="chip" aria-pressed="${cardFilter === 'alle'}" data-filter="alle">Alle ${cards.length}</button>
        ${types.map((k) => `<button class="chip" aria-pressed="${cardFilter === k}" data-filter="${k}">${TYPE_LABEL[k] || k} ${cards.filter((c) => c.type === k).length}</button>`).join('')}
      </div>
      <div class="row">
        <button class="btn small" data-act="import-cards" data-id="${t.id}">Liste einfügen</button>
        <button class="btn small primary" data-act="new-card" data-id="${t.id}">${ICON.plus} Karte</button>
      </div>
    </div>
    <p class="small muted" style="margin-bottom:14px">Automatisch erzeugte Karten können Fehler haben. Unpassende einfach löschen, Antworten direkt hier verbessern.</p>
    <div class="card-list">
      ${shown.map((c) => {
        const p = S.progressOf(c.id);
        return `<div class="sheet card-item" data-card="${c.id}">
          <div><span class="t">${TYPE_LABEL[c.type] || c.type}${c.source && c.source.startsWith('Antwort aus') ? ' · Antwort vorgeschlagen' : ''}</span><div class="q" contenteditable="plaintext-only" data-field="q" spellcheck="true">${h(c.q)}</div></div>
          <div><span class="t">Antwort · Fach ${p.box}/5</span><div contenteditable="plaintext-only" data-field="a" spellcheck="true">${h(c.a)}</div></div>
          <div class="stack" style="gap:4px">
            <button class="btn small ghost star ${c.star ? 'on' : ''}" data-act="star-card" data-id="${c.id}" aria-pressed="${!!c.star}" title="Als wichtig markieren – kommt im Probetest immer dran">${c.star ? '★ Wichtig' : '☆ Wichtig'}</button>
            <button class="btn small ghost" data-act="del-card" data-id="${c.id}" aria-label="Karte löschen">Löschen</button>
          </div>
        </div>`;
      }).join('') || '<p class="muted">Keine Karten.</p>'}
    </div>`;
  $$('[data-filter]', el).forEach((b) => b.onclick = () => { cardFilter = b.dataset.filter; tabCards(el, t); });
  $$('[contenteditable]', el).forEach((n) => n.addEventListener('blur', () => {
    const id = n.closest('[data-card]').dataset.card;
    const v = n.textContent.trim();
    if (v) S.updateCard(id, { [n.dataset.field]: v });
  }));
}

// Spickzettel
function tabCheat(el, t) {
  const docs = S.docsOf(t.id);
  if (!docs.length) { el.innerHTML = '<p class="muted">Lade zuerst Material hoch.</p>'; return; }
  const text = docs.map((d) => d.text).join('\n\n');
  const hl = docs.flatMap((d) => d.highlights || []);
  const kws = keywords(text, hl, 28);
  const sents = keySentences(text, hl, 14);
  const gloss = S.cardsOf(t.id).filter((c) => ['begriff', 'definition', 'abkuerzung'].includes(c.type) && c.a.length < 160).slice(0, 30);
  const colors = ['gelb', 'gruen', 'pink', 'blau', 'orange', 'lila'];
  const mark = (s) => {
    let out = h(s);
    kws.slice(0, 20).forEach((k, i) => {
      const re = new RegExp(`(^|[^\\wäöüÄÖÜß])(${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^\\wäöüÄÖÜß]|$)`, 'g');
      out = out.replace(re, `$1<span class="mk" data-c="${colors[i % 6]}">$2</span>`);
    });
    return out;
  };
  el.innerHTML = `
    <div class="row end no-print" style="margin-bottom:14px"><button class="btn small" onclick="print()">Drucken</button></div>
    <article class="sheet cheat">
      <h2>${h(t.title)}</h2>
      <p class="muted small">Spickzettel – die wichtigsten Begriffe und Sätze aus deinem Material</p>
      <h3 style="margin-top:24px">Schlüsselbegriffe</h3>
      <div class="terms">${kws.map((k, i) => `<span class="mk" data-c="${colors[i % 6]}">${h(k)}</span>`).join('')}</div>
      ${gloss.length ? `<h3>Begriffe &amp; Erklärungen</h3><dl class="glossary">${gloss.map((c) => `<dt>${h(c.q.replace(/^Was (ist|sind|versteht man unter) |\?$/g, ''))}</dt><dd>${h(c.a)}</dd>`).join('')}</dl>` : ''}
      <h3>Kernaussagen</h3>
      <ol style="margin-top:12px">${sents.map((s) => `<li>${mark(s)}</li>`).join('')}</ol>
    </article>`;
}

// Ergebnisse
function tabResults(el, t) {
  const res = S.resultsOf(t.id).slice().reverse();
  const cards = S.cardsOf(t.id);
  const box = [0, 1, 2, 3, 4, 5].map((b) => cards.filter((c) => S.progressOf(c.id).box === b).length);
  el.innerHTML = `
    <section>
      <h2 style="margin-bottom:14px">Lernkartei</h2>
      <div class="sheet pad">
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;align-items:end;height:150px">
          ${box.map((n, i) => `<div style="display:grid;gap:6px;justify-items:center;align-content:end;height:100%">
            <b style="font-family:var(--font-ui)">${n}</b>
            <div style="width:100%;max-width:64px;height:${cards.length ? Math.max(4, n / cards.length * 100) : 4}px;background:${i === 0 ? 'var(--rule)' : i >= 3 ? 'var(--ok)' : 'var(--m-orange)'};border-radius:4px 4px 0 0"></div>
            <span class="small muted">${i === 0 ? 'neu' : `Fach ${i}`}</span></div>`).join('')}
        </div>
        <p class="small muted" style="margin-top:12px">Richtig beantwortete Karten wandern ein Fach weiter und kommen seltener dran. Ab Fach 3 gilt eine Karte als sicher.</p>
      </div>
    </section>
    <section>
      <h2 style="margin-bottom:14px">Probetests</h2>
      ${res.length ? `<div class="sheet pad"><table class="results"><thead><tr><th>Datum</th><th>Punkte</th><th>Note</th></tr></thead><tbody>
        ${res.map((r) => `<tr><td>${fmtDate(r.date)}</td><td>${r.points} / ${r.max} (${Math.round(r.points / r.max * 100)} %)</td><td><b>${r.grade}</b> ${h(r.gradeText || '')}</td></tr>`).join('')}
      </tbody></table></div>` : `<p class="muted">Noch kein Probetest gemacht. <a href="#/lernen/${t.id}/probetest">Jetzt Probetest starten</a></p>`}
    </section>`;
}

// ---------- Einstellungen ----------
function viewSettings() {
  const st = S.get();
  const bytes = new Blob([S.exportJSON()]).size;
  main.innerHTML = `
    <div class="page-head"><div class="crumbs"><a href="#/">Übersicht</a></div><h1>Sicherung &amp; Einstellungen</h1></div>
    <section class="sheet pad stack">
      <h2>Sicherung</h2>
      <p class="muted">Deine Daten liegen nur in diesem Browser auf diesem PC (${(bytes / 1024).toFixed(0)} KB). Mach ab und zu eine Sicherung – z. B. bevor du den Browser-Verlauf löschst oder den PC wechselst.</p>
      <div class="row">
        <button class="btn primary" data-act="backup">Sicherung herunterladen</button>
        <label class="btn">Sicherung laden<input type="file" accept=".json" id="restore" hidden></label>
      </div>
    </section>
    <section class="sheet pad stack">
      <h2>Darstellung</h2>
      <div class="row" role="group" aria-label="Farbschema">
        ${[['auto', 'Wie System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<button class="chip" data-theme-set="${k}" aria-pressed="${(localStorage.getItem('lernapp.theme') || 'auto') === k}">${l}</button>`).join('')}
      </div>
    </section>
    <section class="sheet pad stack">
      <h2>Beispiel</h2>
      <p class="muted">Lädt das Lernset „Eine Frage der Ehre“ aus deinen Arbeitsblättern.</p>
      <div class="row"><button class="btn" data-act="demo">Beispiel laden</button></div>
    </section>
    <section class="sheet pad stack">
      <h2>Alles löschen</h2>
      <p class="muted">Entfernt alle Fächer, Tests, Dokumente, Karten und Ergebnisse (${plural(st.cards.length, 'Karte', 'Karten')}). Lässt sich nicht rückgängig machen.</p>
      <div class="row"><button class="btn danger" data-act="reset">Alles löschen</button></div>
    </section>`;
  $('#restore').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const mode = confirm('Sicherung mit vorhandenen Daten zusammenführen?\n\nOK = zusammenführen · Abbrechen = vorhandene Daten ersetzen') ? 'merge' : 'replace';
    if (mode === 'replace' && !confirm('Wirklich alle vorhandenen Daten durch die Sicherung ersetzen?')) return;
    try { S.importJSON(await f.text(), mode); toast('Sicherung geladen'); go('#/'); }
    catch (err) { toast(err.message); }
  };
  $$('[data-theme-set]').forEach((b) => b.onclick = () => { setTheme(b.dataset.themeSet); viewSettings(); });
}
function setTheme(k) {
  try { localStorage.setItem('lernapp.theme', k); } catch {}
  if (k === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = k;
}
try { setTheme(localStorage.getItem('lernapp.theme') || 'auto'); } catch {}

// ---------- Dialoge ----------
const dlg = $('#dialog');
function openDialog(html, onSubmit) {
  dlg.innerHTML = `<form method="dialog">${html}</form>`;
  const form = $('form', dlg);
  form.onsubmit = (e) => {
    if (e.submitter?.value === 'cancel') return;
    e.preventDefault();
    const res = onSubmit(new FormData(form), e.submitter?.value);
    if (res !== false) dlg.close();
  };
  dlg.showModal();
  $('input,textarea,select', form)?.focus();
}
const swatches = (cur) => `<div class="swatches" role="radiogroup" aria-label="Farbe">${COLORS.map((c) => `<label title="${COLOR_NAME[c]}"><input type="radio" name="color" value="${c}" ${c === cur ? 'checked' : ''} aria-label="${COLOR_NAME[c]}"><span style="--c:${cvar(c)}"></span></label>`).join('')}</div>`;
const dlgButtons = (ok, extra = '') => `<div class="row end">${extra}<button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button><button class="btn primary" value="ok">${ok}</button></div>`;

const ACTIONS = {
  'new-subject'() {
    const used = S.get().subjects.map((s) => s.color);
    const color = COLORS.find((c) => !used.includes(c)) || COLORS[0];
    openDialog(`<h2>Fach anlegen</h2>
      <label class="field">Name<input type="text" name="name" required placeholder="z. B. Wirtschaft, Deutsch, Englisch"></label>
      <div class="field"><span>Textmarker-Farbe</span>${swatches(color)}</div>${dlgButtons('Fach anlegen')}`,
    (fd) => { const s = S.addSubject(fd.get('name'), fd.get('color')); go(`#/fach/${s.id}`); });
  },
  'edit-subject'(id) {
    const s = S.subject(id);
    openDialog(`<h2>Fach bearbeiten</h2>
      <label class="field">Name<input type="text" name="name" required value="${h(s.name)}"></label>
      <div class="field"><span>Textmarker-Farbe</span>${swatches(s.color)}</div>
      ${dlgButtons('Speichern', '<button class="btn danger" value="delete" formnovalidate style="margin-right:auto">Fach löschen</button>')}`,
    (fd, btn) => {
      if (btn === 'delete') {
        if (!confirm(`„${s.name}“ mit allen Tests und Karten löschen?`)) return false;
        S.deleteSubject(id); go('#/'); return;
      }
      S.updateSubject(id, { name: fd.get('name').trim(), color: fd.get('color') }); route();
    });
  },
  'new-test'(subjectId) {
    openDialog(`<h2>Test anlegen</h2>
      <label class="field">Thema<input type="text" name="title" required placeholder="z. B. Kaufvertrag, Unit 3, Bruchrechnung"></label>
      <label class="field">Datum des Tests<input type="date" name="date" min="${isoDate()}"></label>
      <label class="field">Was kommt dran? <span class="muted small">(optional)</span><input type="text" name="notes" placeholder="z. B. Seiten 12–30, Aufgaben 1–10"></label>
      ${dlgButtons('Test anlegen')}`,
    (fd) => { const t = S.addTest(subjectId, fd.get('title'), fd.get('date'), fd.get('notes')); go(`#/test/${t.id}/material`); });
  },
  'edit-test'(id) {
    const t = S.test(id);
    openDialog(`<h2>Test bearbeiten</h2>
      <label class="field">Thema<input type="text" name="title" required value="${h(t.title)}"></label>
      <label class="field">Datum<input type="date" name="date" value="${h(t.date)}"></label>
      <label class="field">Was kommt dran?<input type="text" name="notes" value="${h(t.notes)}"></label>
      ${dlgButtons('Speichern', '<button class="btn danger" value="delete" formnovalidate style="margin-right:auto">Test löschen</button>')}`,
    (fd, btn) => {
      if (btn === 'delete') {
        if (!confirm(`„${t.title}“ mit allen Karten und Ergebnissen löschen?`)) return false;
        const sid = t.subjectId; S.deleteTest(id); go(`#/fach/${sid}`); return;
      }
      S.updateTest(id, { title: fd.get('title').trim(), date: fd.get('date'), notes: fd.get('notes') }); route();
    });
  },
  'paste-text'(testId) {
    openDialog(`<h2>Text einfügen</h2>
      <label class="field">Titel<input type="text" name="name" required value="Mitschrift ${fmtDate(Date.now())}"></label>
      <label class="field">Text<textarea name="text" required rows="12" placeholder="Hefteinträge, Zusammenfassungen, Vokabeln …&#10;&#10;Tipp: „Begriff: Erklärung“ pro Zeile wird zur Karteikarte. Eine Zeile mit „?“ am Ende und die Antwort darunter wird zur Frage-Karte."></textarea></label>
      ${dlgButtons('Karten erzeugen')}`,
    (fd) => {
      const d = S.addDoc(testId, fd.get('name'), 'text', fd.get('text'));
      const n = addGenerated(testId, d);
      toast(`${plural(n, 'neue Karte', 'neue Karten')} erstellt`); route();
    });
  },
  'show-orig'(id) { openOriginal(S.get().docs.find((x) => x.id === id)); },
  'read-doc'(id) {
    const d = S.get().docs.find((x) => x.id === id);
    let body = h(d.text);
    for (const m of (d.highlights || []).slice().sort((a, b) => b.length - a.length)) {
      const e = h(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      body = body.replace(new RegExp(`(?<!<span class="mk">[^<]*)${e}`), `<span class="mk">${h(m)}</span>`);
    }
    body = body.split(/\n\s*\n/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    dlg.innerHTML = `<form method="dialog" class="reader"><h2>${h(d.name)}</h2><div class="reader-text">${body}</div>
      <div class="row end"><button class="btn primary" value="cancel">Schließen</button></div></form>`;
    dlg.classList.add('wide');
    dlg.addEventListener('close', () => dlg.classList.remove('wide'), { once: true });
    dlg.showModal();
  },
  'edit-doc'(id) {
    const d = S.get().docs.find((x) => x.id === id);
    openDialog(`<h2>${h(d.name)}</h2>
      <p class="small muted">Erkannten Text prüfen und Fehler der Texterkennung korrigieren. Danach werden die Karten aus diesem Dokument neu erzeugt (deine Lernfortschritte bei unveränderten Karten bleiben).</p>
      <label class="field">Text<textarea name="text" rows="16">${h(d.text)}</textarea></label>
      ${dlgButtons('Speichern & neu erzeugen')}`,
    (fd) => {
      d.text = fd.get('text');
      regenerateDoc(d);
      route();
    });
  },
  'del-doc'(id) {
    const d = S.get().docs.find((x) => x.id === id);
    const n = S.get().cards.filter((c) => c.docId === id).length;
    if (!confirm(`„${d.name}“ entfernen?${n ? `\nDie ${n} Karten daraus werden auch gelöscht.` : ''}`)) return;
    S.deleteDoc(id, true); route();
  },
  regen(testId) {
    let n = 0;
    S.docsOf(testId).forEach((d) => { n += regenerateDoc(d, true); });
    toast(`${plural(n, 'neue Karte', 'neue Karten')} ergänzt`); route();
  },
  'new-card'(testId) {
    openDialog(`<h2>Eigene Karte</h2>
      <label class="field">Vorderseite (Frage oder Begriff)<textarea name="q" required rows="3"></textarea></label>
      <label class="field">Rückseite (Antwort)<textarea name="a" required rows="3"></textarea></label>
      ${dlgButtons('Speichern', '<button class="btn" value="more" style="margin-right:auto">Speichern &amp; nächste</button>')}`,
    (fd, btn) => {
      S.addCards([{ testId, type: 'manuell', q: fd.get('q'), a: fd.get('a') }]);
      if (btn === 'more') { toast('Karte gespeichert'); ACTIONS['new-card'](testId); return false; }
      route();
    });
  },
  'import-cards'(testId) {
    const t = S.test(testId);
    const prompt = `Erstelle Lernkarten zum Thema „${t.title}“ aus dem folgenden Material. Gib NUR Zeilen im Format\nFrage | Antwort\naus, eine Karte pro Zeile, kurze präzise Antworten, 20–40 Karten.\n\n[Material hier einfügen]`;
    openDialog(`<h2>Liste einfügen</h2>
      <p class="small muted">Eine Karte pro Zeile: <b>Frage | Antwort</b> (auch Tab oder Semikolon geht). Praktisch für Vokabellisten oder Karten, die du woanders erstellt hast.</p>
      <details><summary class="small">Vorlage für einen KI-Chat (falls deine Schule das erlaubt)</summary><pre class="prompt">${h(prompt)}</pre>
      <button type="button" class="btn small" id="copyPrompt">Vorlage kopieren</button></details>
      <label class="field">Karten<textarea name="list" required rows="10" placeholder="Gilde | Zusammenschluss von Kaufleuten&#10;Wann entstand die Hanse? | Mitte des 12. Jahrhunderts"></textarea></label>
      ${dlgButtons('Karten übernehmen')}`,
    (fd) => {
      const rows = fd.get('list').split('\n').map((l) => l.split(/\s*(?:\||\t|;)\s*/)).filter((p) => p.length >= 2 && p[0].trim() && p[1].trim());
      const n = S.addCards(rows.map(([q, ...a]) => ({ testId, type: 'import', q: q.trim(), a: a.join('; ').trim() })));
      toast(`${plural(n, 'Karte', 'Karten')} übernommen`); route();
    });
    $('#copyPrompt').onclick = () => navigator.clipboard?.writeText(prompt).then(() => toast('Vorlage kopiert'));
  },
  'star-card'(id) {
    const c = S.get().cards.find((x) => x.id === id);
    S.updateCard(id, { star: !c.star });
    const b = $(`[data-act="star-card"][data-id="${id}"]`);
    if (b) { b.classList.toggle('on', !!c.star); b.setAttribute('aria-pressed', !!c.star); b.textContent = c.star ? '★ Wichtig' : '☆ Wichtig'; }
  },
  'del-card'(id) { S.deleteCard(id); $(`[data-card="${id}"]`)?.remove(); },
  backup() {
    const blob = new Blob([S.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `lernapp-sicherung-${isoDate()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  reset() {
    if (!confirm('Wirklich ALLES löschen? Das lässt sich nicht rückgängig machen.')) return;
    S.resetAll(); toast('Alles gelöscht'); go('#/');
  },
  demo() { loadDemo(); },
};

function regenerateDoc(d, keepExisting = false) {
  const old = S.get().cards.filter((c) => c.docId === d.id);
  const fresh = generate(d.text, { highlights: d.highlights || [] });
  const key = (c) => (c.q + '|' + c.a).toLowerCase();
  const freshKeys = new Set(fresh.map(key));
  if (!keepExisting) {
    // Karten entfernen, die es im neuen Text nicht mehr gibt (eigene Änderungen an Karten bleiben erhalten, wenn sie gleich sind)
    old.filter((c) => !freshKeys.has(key(c))).forEach((c) => S.deleteCard(c.id));
  }
  S.save();
  return S.addCards(fresh.map((c) => ({ ...c, testId: d.testId, docId: d.id })));
}

function loadDemo() {
  const t = loadBeispiel();
  if (!t) { toast('Beispiel ist schon geladen'); return; }
  toast(`Beispiel geladen: ${S.cardsOf(t.id).length} Karten`);
  go(`#/test/${t.id}`);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  e.preventDefault();
  ACTIONS[b.dataset.act]?.(b.dataset.id);
});

document.addEventListener('lernapp:savefail', () => toast('Speichern fehlgeschlagen – Browser-Speicher voll. Alte Dokumente löschen oder Sicherung machen.'));
migrate();
route();
