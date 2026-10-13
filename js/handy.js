// Handy-Version: alle Fächer und Tests, Upload, Lernen – eine Spalte, Tab-Leiste unten.
import * as S from './store.js';
import { keywords, keySentences, TYPE_LABEL } from './gen.js';
import { extractFile, ACCEPT } from './extract.js';
import { addGenerated, loadBeispiel, migrate } from './setup.js';
import { startSession, MODES, modeAvailable } from './learn.js';
import { h, $, $$, toast, plural, cvar, COLORS, COLOR_NAME, countdownText, daysUntil, dateParts, fmtDate, isoDate, ICON } from './util.js';

const main = $('#main');
const nav = $('#tabbar');
const sheet = $('#sheet');

// ---------- Router ----------
function route() {
  const [view, id, sub] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  window.scrollTo(0, 0);
  if (sheet.open) sheet.close();
  if (view === 'lernen') {
    document.body.classList.add('in-session'); nav.hidden = true;
    return startSession(main, id, sub);
  }
  document.body.classList.remove('in-session'); nav.hidden = false;
  const tab = view === 'mehr' ? 'mehr' : 'start';
  $$('a', nav).forEach((a) => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
  if (view === 'fach' && S.subject(id)) return viewSubject(id);
  if (view === 'test' && S.test(id)) return viewTest(id, sub || 'lernen');
  if (view === 'mehr') return viewMore();
  viewHome();
}
window.addEventListener('hashchange', route);
const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

const cardStats = (cards) => {
  const sure = cards.filter((c) => S.progressOf(c.id).box >= 3).length;
  return { sure, pct: cards.length ? Math.round(sure / cards.length * 100) : 0, due: cards.filter((c) => S.isDue(c.id)).length };
};
const bar = (pct) => `<div class="bar"><i style="width:${pct}%"></i></div>`;

// ---------- Bottom-Sheet ----------
function openSheet(html, onSubmit) {
  sheet.innerHTML = `<form class="stack" id="sf">${html}</form>`;
  sheet.showModal();
  const f = $('#sf');
  $$('[data-close]', f).forEach((b) => b.onclick = () => sheet.close());
  f.onsubmit = (e) => {
    e.preventDefault();
    if (onSubmit(new FormData(f), e.submitter?.value) !== false) sheet.close();
  };
  return f;
}
const sheetButtons = (ok, extra = '') => `<div class="row end">${extra}<button type="button" class="btn ghost" data-close>Abbrechen</button><button class="btn primary" value="ok">${ok}</button></div>`;
const swatches = (cur) => `<div class="swatches" role="radiogroup" aria-label="Farbe">${COLORS.map((c) => `<label title="${COLOR_NAME[c]}"><input type="radio" name="color" value="${c}" ${c === cur ? 'checked' : ''} aria-label="${COLOR_NAME[c]}"><span style="--c:${cvar(c)}"></span></label>`).join('')}</div>`;

// Löschen mit Rückfrage im Sheet (Browser-Dialoge sind auf manchen Handys gesperrt)
function confirmSheet(text, label, action) {
  openSheet(`<h2>${h(text)}</h2><p class="muted">Das lässt sich nicht rückgängig machen.</p>${sheetButtons(label).replace('btn primary', 'btn danger')}`, () => { action(); });
}

// ---------- Start ----------
const abbr = (name) => (name.split(/\s+[–-]\s+/)[0] || name).slice(0, 4);
const tone = (c) => (c === 'lila' ? 'blau' : c || 'blau'); // Hellblau statt Lila
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';
const SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>';

// Test, an dem gerade gelernt werden sollte: nächster Test mit Datum, sonst zuletzt gelernter
function focusTest() {
  const st = S.get();
  const withCards = st.tests.filter((t) => S.cardsOf(t.id).length);
  const dated = withCards.filter((t) => t.date && daysUntil(t.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  if (dated.length) return dated[0];
  const lastOf = (t) => Math.max(0, ...S.cardsOf(t.id).map((c) => S.progressOf(c.id).last || 0));
  return withCards.sort((a, b) => lastOf(b) - lastOf(a))[0] || null;
}

function heroCard(t) {
  if (!t) return `<div class="hero-card"><span class="hero-chip">LernApp</span>
    <p class="hero-label">So geht's</p><p class="hero-title">Fach antippen, Test anlegen, Arbeitsblatt fotografieren – fertig sind deine Lernkarten.</p></div>`;
  const s = S.subject(t.subjectId);
  const { pct } = cardStats(S.cardsOf(t.id));
  return `<div class="hero-card">
    <a class="hero-chip" href="#/fach/${s.id}">${h(abbr(s.name))} · ${h(s.name.split(/\s+[–-]\s+/)[1] || s.name)} <span aria-hidden="true">⌄</span></a>
    <p class="hero-label">Dein Fortschritt</p>
    <div class="slider" role="img" aria-label="${pct} Prozent sicher gelernt"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div>
    <p class="hero-pct">${pct}%</p>
    <p class="hero-label">${t.date ? `Nächster Test · ${countdownText(t.date)}` : 'Weiterlernen'}</p>
    <p class="hero-title">${h(t.title)}</p>
    <a class="hero-btn" href="#/lernen/${t.id}/wiederholen">Weiterlernen</a>
  </div>`;
}

function viewHome() {
  const st = S.get();
  const due = st.cards.filter((c) => S.isDue(c.id) && S.progressOf(c.id).last).length;
  main.innerHTML = `
    <header class="top">
      <span class="avatar" aria-hidden="true">L</span>
      <span class="hello"><small>Willkommen zurück,</small><b>Deine LernApp</b></span>
      <a class="icon-btn" href="#/lernen/alle/wiederholen" aria-label="Wiederholen${due ? `, ${due} Karten fällig` : ''}">${BELL}${due ? `<span class="dot">${due > 99 ? '99+' : due}</span>` : ''}</a>
    </header>
    <label class="search">${SEARCH}<input type="search" id="find" placeholder="Fach oder Test suchen" aria-label="Fach oder Test suchen"></label>
    <div id="results" hidden></div>
    <div id="homeBody" class="home-body">
      ${heroCard(focusTest())}
      <section>
        <h2>Deine Fächer</h2>
        <div class="tiles">${st.subjects.map((s) => {
          const tests = S.testsOf(s.id);
          const n = st.cards.filter((c) => tests.some((t) => t.id === c.testId)).length;
          return `<a class="tile-card" href="#/fach/${s.id}" data-tone="${tone(s.color)}">
            <span class="tile-ico">${h(abbr(s.name))}</span>
            <b>${h(s.name.split(/\s+[–-]\s+/)[1] || s.name)}</b>
            <small>${tests.length ? `${plural(tests.length, 'Test', 'Tests')} · ${plural(n, 'Karte', 'Karten')}` : 'Noch kein Test'}</small>
            <span class="pill">Öffnen</span></a>`;
        }).join('')}
          <button class="tile-card add" id="newSubject"><span class="tile-ico">+</span><b>Fach anlegen</b><small>Eigenes Fach</small></button>
        </div>
      </section>
    </div>`;
  $('#newSubject').onclick = newSubject;
  const find = $('#find'), res = $('#results'), body = $('#homeBody');
  find.oninput = () => {
    const q = find.value.trim().toLowerCase();
    body.hidden = !!q; res.hidden = !q;
    if (!q) return;
    const subs = st.subjects.filter((s) => s.name.toLowerCase().includes(q));
    const tests = st.tests.filter((t) => t.title.toLowerCase().includes(q));
    res.innerHTML = `<div class="cards">${[
      ...subs.map((s) => `<a class="item-card" href="#/fach/${s.id}"><span class="txt"><small>Fach</small><b>${h(s.name)}</b><span>${plural(S.testsOf(s.id).length, 'Test', 'Tests')}</span></span><span class="pill">Öffnen</span></a>`),
      ...tests.map((t) => `<a class="item-card" href="#/test/${t.id}"><span class="txt"><small>${h(S.subject(t.subjectId)?.name || '')}</small><b>${h(t.title)}</b><span>${plural(S.cardsOf(t.id).length, 'Karte', 'Karten')}</span></span><span class="pill">Lernen</span></a>`),
    ].join('') || '<p class="muted">Nichts gefunden.</p>'}</div>`;
  };
}

function newSubject() {
  const used = S.get().subjects.map((s) => s.color);
  openSheet(`<h2>Fach anlegen</h2>
    <label class="field">Name<input type="text" name="name" required placeholder="z. B. BGP – Geschäftsprozesse"></label>
    <div class="field"><span>Farbe</span>${swatches(COLORS.find((c) => !used.includes(c)) || COLORS[0])}</div>${sheetButtons('Anlegen')}`,
  (fd) => { const s = S.addSubject(fd.get('name'), fd.get('color')); go(`#/fach/${s.id}`); });
}

const pageHead = (back, title, right = '') => `<header class="nav-head"><a class="icon-btn plain" href="${back}" aria-label="Zurück"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></a><h1>${title}</h1>${right}</header>`;

// ---------- Fach ----------
function viewSubject(id) {
  const s = S.subject(id);
  const tests = S.testsOf(id).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  main.innerHTML = `
    ${pageHead('#/', h(s.name), `<button class="icon-btn plain" id="editS" aria-label="Fach bearbeiten"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg></button>`)}
    <p class="section-label">Deine Tests</p>
    ${tests.length ? `<div class="cards">${tests.map((t) => {
      const cards = S.cardsOf(t.id); const { pct } = cardStats(cards);
      return `<a class="item-card" href="#/test/${t.id}">
        <span class="txt"><small>${t.date ? `Test am ${fmtDate(new Date(t.date + 'T00:00'))} · ${countdownText(t.date)}` : 'Test'}</small><b>${h(t.title)}</b><span>${plural(cards.length, 'Karte', 'Karten')} · ${pct} % sicher</span></span>
        <span class="pill">Lernen</span></a>`;
    }).join('')}</div>` : `<div class="item-card empty-card"><span class="txt"><b>Noch kein Test</b><span>Lege einen Test an und fotografiere dann deine Arbeitsblätter.</span></span></div>`}
    <button class="btn primary big" id="newTest">+ Test anlegen</button>`;
  $('#newTest').onclick = () => openSheet(`<h2>Test anlegen</h2>
    <label class="field">Thema<input type="text" name="title" required placeholder="z. B. Kaufvertrag, Unit 3"></label>
    <label class="field">Datum <span class="muted small">(optional)</span><input type="date" name="date" min="${isoDate()}"></label>
    ${sheetButtons('Anlegen')}`,
  (fd) => { const t = S.addTest(id, fd.get('title'), fd.get('date')); go(`#/test/${t.id}/material`); });
  $('#editS').onclick = () => openSheet(`<h2>Fach bearbeiten</h2>
    <label class="field">Name<input type="text" name="name" required value="${h(s.name)}"></label>
    <div class="field"><span>Farbe</span>${swatches(s.color)}</div>
    ${sheetButtons('Speichern', '<button type="submit" class="btn ghost danger-text" value="delete" formnovalidate style="margin-right:auto">Löschen</button>')}`,
  (fd, btn) => {
    if (btn === 'delete') { setTimeout(() => confirmSheet(`„${s.name}“ mit allen Tests löschen?`, 'Fach löschen', () => { S.deleteSubject(id); go('#/'); })); return; }
    S.updateSubject(id, { name: fd.get('name').trim(), color: fd.get('color') }); route();
  });
}

// ---------- Test ----------
const TABS = [['lernen', 'Lernen'], ['material', 'Material'], ['karten', 'Karten'], ['spick', 'Spickzettel']];
function viewTest(id, tab) {
  const t = S.test(id); const s = S.subject(t.subjectId);
  const cards = S.cardsOf(id); const { pct } = cardStats(cards);
  main.innerHTML = `
    ${pageHead(`#/fach/${s.id}`, h(s.name), `<button class="icon-btn plain" id="editT" aria-label="Test bearbeiten"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg></button>`)}
    <div class="module-card">
      <span class="txt"><small>${t.date ? `Test am ${fmtDate(new Date(t.date + 'T00:00'))} · ${countdownText(t.date)}` : 'Test'}</small><b>${h(t.title)}</b><span>${plural(cards.length, 'Karte', 'Karten')} · ${pct} % sicher</span></span>
      ${cards.length ? `<a class="arrow-btn" href="#/lernen/${id}/wiederholen" aria-label="Weiterlernen">${ARROW}</a>` : ''}
      <div class="mbar"><i style="width:${pct}%"></i></div>
    </div>
    <nav class="seg" aria-label="Bereiche">${TABS.map(([k, l]) => `<a href="#/test/${id}/${k}" aria-current="${k === tab ? 'page' : 'false'}">${l}</a>`).join('')}</nav>
    <div id="tab" class="tabbody"></div>`;
  $('#editT').onclick = () => openSheet(`<h2>Test bearbeiten</h2>
    <label class="field">Thema<input type="text" name="title" required value="${h(t.title)}"></label>
    <label class="field">Datum<input type="date" name="date" value="${h(t.date)}"></label>
    ${sheetButtons('Speichern', '<button type="submit" class="btn ghost danger-text" value="delete" formnovalidate style="margin-right:auto">Löschen</button>')}`,
  (fd, btn) => {
    if (btn === 'delete') { setTimeout(() => confirmSheet(`„${t.title}“ löschen?`, 'Test löschen', () => { S.deleteTest(id); go(`#/fach/${s.id}`); })); return; }
    S.updateTest(id, { title: fd.get('title').trim(), date: fd.get('date') }); route();
  });
  const el = $('#tab');
  ({ lernen: tabLearn, material: tabMaterial, karten: tabCards, spick: tabCheat }[tab] || tabLearn)(el, t);
}

const MODE_TONE = { karteikarten: 'gelb', quiz: 'blau', wahrfalsch: 'pink', lueckentext: 'orange', zuordnen: 'gruen', schreiben: 'blau' };
const MODE_SHORT = {
  karteikarten: 'Umdrehen und ehrlich bewerten', quiz: 'Eine von vier ist richtig', wahrfalsch: 'Stimmt die Aussage?',
  lueckentext: 'Fehlendes Wort eintippen', zuordnen: 'Begriff und Erklärung verbinden', schreiben: 'Frei antworten, vergleichen',
};

function tabLearn(el, t) {
  const cards = S.cardsOf(t.id);
  if (!cards.length) {
    el.innerHTML = `<div class="item-card empty-card"><span class="txt"><b>Erst Material, dann lernen</b><span>Fotografiere deine Arbeitsblätter oder lade PDF/Word-Dateien hoch.</span></span></div>
      <a class="btn primary big" href="#/test/${t.id}/material">Material hochladen</a>`;
    return;
  }
  const stars = cards.filter((c) => c.star);
  const last = S.resultsOf(t.id).at(-1);
  el.innerHTML = `
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

// Material
function tabMaterial(el, t) {
  const docs = S.docsOf(t.id);
  el.innerHTML = `
    <div class="upload">
      <label class="btn primary big">${ICON.upload} Foto aufnehmen<input type="file" id="cam" accept="image/*" capture="environment" hidden></label>
      <label class="btn big">Dateien auswählen<input type="file" id="files" multiple accept="${ACCEPT}" hidden></label>
      <button class="btn ghost" id="paste">Text einfügen</button>
      <p class="small muted">PDF, Word, PowerPoint, Text oder Fotos. Wird nur auf deinem Handy gelesen, nichts wird hochgeladen.</p>
    </div>
    <div id="progress"></div>
    <section><p class="section-label">Dokumente</p>
      ${docs.length ? `<div class="cards">${docs.map((d) => `<div class="item-card doc">
        <span class="txt"><b>${h(d.name)}</b><span class="small muted">${plural(S.get().cards.filter((c) => c.docId === d.id).length, 'Karte', 'Karten')}</span></span>
        <span class="row"><button class="btn small" data-read="${d.id}">Lesen</button><button class="btn small ghost" data-del="${d.id}" aria-label="Entfernen">✕</button></span></div>`).join('')}</div>` : '<p class="muted">Noch keine Dokumente.</p>'}
    </section>`;
  $('#cam').onchange = (e) => handleFiles(t, [...e.target.files]);
  $('#files').onchange = (e) => handleFiles(t, [...e.target.files]);
  $('#paste').onclick = () => openSheet(`<h2>Text einfügen</h2>
    <label class="field">Titel<input type="text" name="name" required value="Mitschrift ${fmtDate(Date.now())}"></label>
    <label class="field">Text<textarea name="text" required rows="9" placeholder="Tipp: „Begriff: Erklärung“ pro Zeile wird eine Karteikarte."></textarea></label>
    ${sheetButtons('Karten erzeugen')}`,
  (fd) => { const d = S.addDoc(t.id, fd.get('name'), 'text', fd.get('text')); toast(`${plural(addGenerated(t.id, d), 'neue Karte', 'neue Karten')}`); route(); });
  $$('[data-read]').forEach((b) => b.onclick = () => readDoc(b.dataset.read));
  $$('[data-del]').forEach((b) => b.onclick = () => {
    const d = S.get().docs.find((x) => x.id === b.dataset.del);
    confirmSheet(`„${d.name}“ und die Karten daraus entfernen?`, 'Entfernen', () => { S.deleteDoc(d.id, true); route(); });
  });
}

async function handleFiles(t, files) {
  const prog = $('#progress');
  let total = 0;
  for (const f of files) {
    prog.innerHTML = `<div class="sheet progress-line"><b>${h(f.name)}</b><span class="muted small" id="pstat">Wird gelesen …</span><div class="bar"><i class="indet"></i></div></div>`;
    try {
      const r = await extractFile(f, (s) => { const p = $('#pstat'); if (p) p.textContent = s; });
      if (!r.text.trim()) throw new Error('Kein Text gefunden. Foto gerade, scharf und hell aufnehmen.');
      const d = S.addDoc(t.id, f.name === 'image.jpg' ? `Foto ${fmtDate(Date.now())}` : f.name, r.kind, r.text);
      d.highlights = r.highlights; S.save();
      total += addGenerated(t.id, d);
    } catch (e) { console.error(e); toast(`${f.name}: ${e.message}`); }
  }
  prog.innerHTML = '';
  toast(`${plural(total, 'neue Karte', 'neue Karten')} erstellt`);
  route();
}

function readDoc(id) {
  const d = S.get().docs.find((x) => x.id === id);
  let body = h(d.text);
  for (const m of (d.highlights || []).slice().sort((a, b) => b.length - a.length)) {
    const e = h(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body = body.replace(new RegExp(`(?<!<span class="mk">[^<]*)${e}`), `<span class="mk">${h(m)}</span>`);
  }
  body = body.split(/\n\s*\n/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  const f = openSheet(`<h2>${h(d.name)}</h2><div class="reader-text">${body}</div>
    <div class="row end"><button type="button" class="btn" id="editDoc">Text korrigieren</button><button type="button" class="btn primary" data-close>Schließen</button></div>`, () => {});
  $('#editDoc', f).onclick = () => openSheet(`<h2>Text korrigieren</h2><p class="small muted">Fehler der Texterkennung verbessern. Danach werden die Karten aus diesem Dokument neu erzeugt.</p>
    <textarea name="text" rows="14">${h(d.text)}</textarea>${sheetButtons('Speichern')}`,
  (fd) => {
    d.text = fd.get('text');
    S.get().cards.filter((c) => c.docId === d.id && !['manuell', 'import'].includes(c.type)).forEach((c) => S.deleteCard(c.id));
    toast(`${plural(addGenerated(d.testId, d), 'Karte', 'Karten')} neu erzeugt`); route();
  });
}

// Karten
let filter = 'alle', query = '';
function tabCards(el, t) {
  const all = S.cardsOf(t.id);
  const list = all.filter((c) => (filter === 'alle' || (filter === 'wichtig' ? c.star : ['manuell', 'import'].includes(c.type)))
    && (!query || (c.q + ' ' + c.a).toLowerCase().includes(query.toLowerCase())));
  el.innerHTML = `
    <div class="row"><input type="search" id="q" placeholder="Karten durchsuchen" value="${h(query)}" aria-label="Karten durchsuchen" style="flex:1"><button class="btn" id="add">+ Eigene</button></div>
    <div class="chips" role="group" aria-label="Filter">
      ${[['alle', `Alle ${all.length}`], ['wichtig', `★ Wichtig ${all.filter((c) => c.star).length}`], ['eigene', 'Eigene']].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}
    </div>
    <p class="small muted">Automatisch erzeugte Karten können Fehler haben – unpassende einfach löschen.</p>
    <div class="clist">
      ${list.map((c) => `<article class="sheet citem">
        <div class="ctop"><span class="t">${TYPE_LABEL[c.type] || ''} · Fach ${S.progressOf(c.id).box}/5</span>
          <button class="starbtn ${c.star ? 'on' : ''}" data-star="${c.id}" aria-pressed="${!!c.star}" aria-label="Als wichtig markieren">${c.star ? '★' : '☆'}</button></div>
        <div class="cq">${h(c.q)}</div><div class="ca">${h(c.a)}</div>
        <button class="btn ghost small" data-delc="${c.id}">Löschen</button>
      </article>`).join('') || '<p class="muted">Keine Karte gefunden.</p>'}
    </div>`;
  const q = $('#q');
  q.oninput = () => { query = q.value; const pos = q.selectionStart; tabCards(el, t); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-f]', el).forEach((b) => b.onclick = () => { filter = b.dataset.f; tabCards(el, t); });
  $$('[data-star]', el).forEach((b) => b.onclick = () => { const c = all.find((x) => x.id === b.dataset.star); S.updateCard(c.id, { star: !c.star }); tabCards(el, t); });
  $$('[data-delc]', el).forEach((b) => b.onclick = () => { S.deleteCard(b.dataset.delc); b.closest('.citem').remove(); });
  $('#add').onclick = () => openSheet(`<h2>Eigene Karten</h2>
    <p class="small muted">Eine Karte pro Zeile: <b>Frage | Antwort</b></p>
    <textarea name="list" rows="7" required placeholder="Gilde | Zusammenschluss von Kaufleuten&#10;Was ist Reputation? | Das Ansehen einer Person"></textarea>
    ${sheetButtons('Hinzufügen')}`,
  (fd) => {
    const rows = fd.get('list').split('\n').map((l) => l.split(/\s*(?:\||\t|;)\s*/)).filter((p) => p.length >= 2 && p[0].trim() && p[1].trim());
    if (!rows.length) { toast('Bitte so schreiben: Frage | Antwort'); return false; }
    const n = S.addCards(rows.map(([qq, ...a]) => ({ testId: t.id, type: 'manuell', q: qq.trim(), a: a.join('; ').trim() })));
    toast(`${plural(n, 'Karte', 'Karten')} hinzugefügt`); filter = 'eigene'; tabCards(el, t);
  });
}

// Spickzettel
function tabCheat(el, t) {
  const docs = S.docsOf(t.id);
  if (!docs.length) { el.innerHTML = '<p class="muted">Lade zuerst Material hoch.</p>'; return; }
  const text = docs.map((d) => d.text).join('\n\n');
  const hl = docs.flatMap((d) => d.highlights || []);
  const kws = keywords(text, hl, 24);
  const sents = keySentences(text, hl, 12);
  const gloss = S.cardsOf(t.id).filter((c) => ['begriff', 'abkuerzung'].includes(c.type) && c.a.length < 160);
  const colors = ['gelb', 'gruen', 'pink', 'blau', 'orange', 'lila'];
  const mark = (s) => {
    let out = h(s);
    kws.slice(0, 18).forEach((k, i) => {
      const re = new RegExp(`(^|[^\\wäöüÄÖÜß])(${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^\\wäöüÄÖÜß]|$)`, 'g');
      out = out.replace(re, `$1<span class="mk" data-c="${colors[i % 6]}">$2</span>`);
    });
    return out;
  };
  el.innerHTML = `<article class="sheet cheat">
    <h3>Schlüsselbegriffe</h3>
    <div class="terms">${kws.map((k, i) => `<span class="mk" data-c="${colors[i % 6]}">${h(k)}</span>`).join('')}</div>
    ${gloss.length ? `<h3>Begriffe</h3><dl class="glossary">${gloss.map((c) => `<dt>${h(c.q.replace(/^Wofür steht die Abkürzung |\?$/g, ''))}</dt><dd>${h(c.a)}</dd>`).join('')}</dl>` : ''}
    <h3>Kernaussagen</h3>
    <ol>${sents.map((s) => `<li>${mark(s)}</li>`).join('')}</ol>
  </article>`;
}

// ---------- Mehr ----------
function viewMore() {
  const theme = (() => { try { return localStorage.getItem('lernapp.theme') || 'auto'; } catch { return 'auto'; } })();
  main.innerHTML = `
    <header class="nav-head"><h1>Mehr</h1></header>
    <section class="sheet pad stack">
      <h2>Sicherung</h2>
      <p class="muted">Dein Lernstand liegt nur in diesem Browser. Lade ab und zu eine Sicherung herunter – z. B. bevor du den Browser-Verlauf löschst oder das Handy wechselst.</p>
      <button class="btn primary" id="backup">Sicherung herunterladen</button>
      <label class="btn">Sicherung laden<input type="file" accept=".json,application/json" id="restore" hidden></label>
    </section>
    <section class="sheet pad stack">
      <h2>Darstellung</h2>
      <div class="chips" role="group" aria-label="Farbschema">${[['auto', 'Wie Handy'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<button class="chip" data-theme-set="${k}" aria-pressed="${theme === k}">${l}</button>`).join('')}</div>
    </section>
    <section class="sheet pad stack">
      <h2>Beispiel</h2>
      <p class="muted">Deutsch-Test „Eine Frage der Ehre“ mit Lesetext und Kurzarbeit-Fragen.</p>
      <button class="btn" id="demo">Beispiel laden</button>
    </section>
    <section class="sheet pad stack">
      <h2>Am PC lernen</h2>
      <p class="muted">Die große Version mit Seitenleiste – gleiche Funktionen, eigener Speicher.</p>
      <a class="btn" href="../">PC-Version öffnen</a>
    </section>`;
  $('#backup').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([S.exportJSON()], { type: 'application/json' }));
    a.download = `lernapp-sicherung-${isoDate()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#restore').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const text = await f.text();
    openSheet(`<h2>Sicherung laden</h2><p class="muted">Mit deinen vorhandenen Daten zusammenführen oder alles ersetzen?</p>
      <div class="row end"><button type="submit" class="btn" value="replace">Ersetzen</button><button class="btn primary" value="merge">Zusammenführen</button></div>`,
    (fd, btn) => { try { S.importJSON(text, btn === 'replace' ? 'replace' : 'merge'); toast('Sicherung geladen'); go('#/'); } catch (err) { toast(err.message); } });
  };
  $$('[data-theme-set]').forEach((b) => b.onclick = () => { setTheme(b.dataset.themeSet); viewMore(); });
  $('#demo').onclick = () => { const t = loadBeispiel(); if (!t) toast('Beispiel ist schon da'); else go(`#/test/${t.id}`); };
}
function setTheme(k) {
  try { localStorage.setItem('lernapp.theme', k); } catch {}
  if (k === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = k;
}
try { setTheme(localStorage.getItem('lernapp.theme') || 'auto'); } catch {}

document.addEventListener('lernapp:savefail', () => toast('Speichern nicht möglich – Speicher voll oder privater Modus.'));
migrate();
route();
