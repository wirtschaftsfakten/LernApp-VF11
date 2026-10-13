// Handy-Version – Aufbau wie eine native iPhone-App: Navigationsleiste, große Titel, gruppierte Listen, Sheets.
import * as S from './store.js';
import { keywords, keySentences, TYPE_LABEL } from './gen.js';
import { extractFile, ACCEPT } from './extract.js';
import { addGenerated, loadBeispiel, migrate } from './setup.js';
import { startSession } from './learn.js';
import * as V from './views.js';
import { putFile } from './files.js';
import { openOriginal, hasOriginal } from './viewer.js';
import { h, $, $$, toast, plural, cvar, COLORS, COLOR_NAME, countdownText, daysUntil, fmtDate, isoDate, ICON } from './util.js';

const main = $('#main');
const nav = $('#tabbar');
const sheet = $('#sheet');
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// ---------- Router ----------
function route() {
  const [view, id, sub, extra] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  window.scrollTo(0, 0);
  if (sheet.open) sheet.close();
  if (view === 'lernen') {
    document.body.classList.add('in-session'); nav.hidden = true;
    return startSession(main, id, sub, extra);
  }
  document.body.classList.remove('in-session'); nav.hidden = false;
  const tab = view === 'mehr' ? 'mehr' : 'start';
  $$('a', nav).forEach((a) => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
  if (view === 'fach' && S.subject(id)) viewSubject(id);
  else if (view === 'test' && S.test(id)) viewTest(id, sub || 'lernen');
  else if (view === 'mehr') viewMore();
  else viewHome();
  onScroll();
}
window.addEventListener('hashchange', route);
const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

// Kleiner Titel in der Leiste erscheint, sobald der große Titel wegscrollt
function onScroll() { document.body.classList.toggle('scrolled', window.scrollY > 44); }
window.addEventListener('scroll', onScroll, { passive: true });

const navbar = ({ back = '', backLabel = '', title = '', right = '' }) => `
  <div class="navbar">
    ${back ? `<a class="nav-back" href="${back}">${V.BACK}<span>${h(backLabel)}</span></a>` : '<span></span>'}
    <span class="nav-title">${title}</span>
    <span class="nav-actions">${right}</span>
  </div>`;
const navBtn = (id, label, icon) => `<button class="nav-btn" id="${id}" aria-label="${label}">${icon}</button>`;

// ---------- Sheets ----------
function openSheet(html, onSubmit) {
  sheet.innerHTML = `<div class="grabber" aria-hidden="true"></div><form class="stack" id="sf">${html}</form>`;
  sheet.showModal();
  const f = $('#sf');
  $$('[data-close]', f).forEach((b) => b.onclick = () => sheet.close());
  f.onsubmit = (e) => {
    e.preventDefault();
    if (onSubmit(new FormData(f), e.submitter?.value) !== false) sheet.close();
  };
  return f;
}
const sheetButtons = (ok, extra = '') => `<div class="sheet-actions">${extra}<button type="button" class="btn" data-close>Abbrechen</button><button class="btn primary" value="ok">${ok}</button></div>`;
const swatches = (cur) => `<div class="swatches" role="radiogroup" aria-label="Farbe">${COLORS.map((c) => `<label title="${COLOR_NAME[c]}"><input type="radio" name="color" value="${c}" ${c === cur ? 'checked' : ''} aria-label="${COLOR_NAME[c]}"><span class="dot-ico" data-tone="${c}"></span></label>`).join('')}</div>`;

// Aktionsliste wie das iOS-Aktionsmenü
function actionSheet(title, actions) {
  sheet.innerHTML = `<div class="grabber" aria-hidden="true"></div><div class="stack">
    <p class="sheet-title">${h(title)}</p>
    <div class="rv-rows">${actions.map((a, i) => `<button class="rv-row ${a.danger ? 'danger' : ''}" data-i="${i}"><span class="row-txt"><span class="row-title">${a.label}</span></span></button>`).join('')}</div>
    <button class="btn big" data-close>Abbrechen</button></div>`;
  sheet.showModal();
  $$('[data-close]', sheet).forEach((b) => b.onclick = () => sheet.close());
  $$('[data-i]', sheet).forEach((b) => b.onclick = () => { sheet.close(); actions[+b.dataset.i].run(); });
}
function confirmSheet(text, label, action) {
  actionSheet(text, [{ label, danger: true, run: action }]);
}

// ---------- Start ----------
const topBtn = (attrs, icon, label) => `<${attrs.startsWith('href') ? 'a' : 'button'} class="rv-icon-btn" ${attrs} aria-label="${label}">${icon}</${attrs.startsWith('href') ? 'a' : 'button'}>`;
const subTop = (back, title, right = '') => `${topBtn(`href="${back}"`, V.BACK, 'Zurück')}<span class="rv-top-title">${title}</span>${right || '<span></span>'}`;

function viewHome() {
  const st = S.get();
  const upcoming = st.tests.filter((t) => t.date && daysUntil(t.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const top = `<span class="rv-avatar" aria-hidden="true">L</span>
    <label class="rv-search">${V.SEARCH}<input type="search" id="find" placeholder="Suchen" aria-label="Fächer und Tests durchsuchen"></label>
    ${topBtn('id="newSubject"', V.PLUS, 'Fach anlegen')}`;
  main.innerHTML = `
    ${V.homeHero(top)}
    <div class="rv-body">
      <div id="results" hidden></div>
      <div id="homeBody" class="stack-l">
        ${V.statTiles()}
        ${upcoming.length ? V.group('Nächste Tests', upcoming.slice(0, 3).map(V.testCell).join('')) : ''}
        ${V.group('Fächer', st.subjects.map(V.subjectCell).join(''), '', '<button class="rv-link" id="addSubject">Hinzufügen</button>')}
      </div>
    </div>`;
  $('#newSubject').onclick = newSubject;
  $('#addSubject').onclick = newSubject;
  const find = $('#find'), res = $('#results'), body = $('#homeBody');
  find.oninput = () => {
    const q = find.value.trim().toLowerCase();
    body.hidden = !!q; res.hidden = !q;
    if (q) res.innerHTML = V.searchHtml(q);
  };
}

function newSubject() {
  const used = S.get().subjects.map((s) => s.color);
  openSheet(`<h2 class="sheet-h">Neues Fach</h2>
    <label class="field">Name<input type="text" name="name" required placeholder="z. B. BGP – Geschäftsprozesse"></label>
    <div class="field"><span>Farbe</span>${swatches(COLORS.find((c) => !used.includes(c)) || COLORS[0])}</div>${sheetButtons('Anlegen')}`,
  (fd) => { const s = S.addSubject(fd.get('name'), fd.get('color')); go(`#/fach/${s.id}`); });
}

// ---------- Fach ----------
function viewSubject(id) {
  const s = S.subject(id);
  const tests = S.testsOf(id).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const cards = S.get().cards.filter((c) => tests.some((t) => t.id === c.testId));
  const { sure, pct } = V.cardStats(cards);
  main.innerHTML = `
    ${V.hero({
      cls: 'small', top: subTop('#/', h(V.longName(s.name)), topBtn('id="editS"', V.PEN, 'Fach bearbeiten')),
      label: `${h(V.abbr(s.name))} · ${h(V.longName(s.name))}`, big: String(pct), unit: '% sicher',
      chip: `<span class="rv-chip static">${plural(tests.length, 'Test', 'Tests')} · ${sure} von ${cards.length} Karten</span>`,
      actions: [V.action({ act: 'x', icon: V.PLUS, label: 'Neuer Test', cls: 'new-test' })],
    })}
    <div class="rv-body stack-l">
      ${tests.length ? V.group('Tests', tests.map(V.testCell).join('')) : '<div class="rv-card empty"><p class="empty-title">Noch kein Test</p><p>Lege einen Test an und fotografiere dann deine Arbeitsblätter.</p></div>'}
    </div>`;
  $('.new-test').onclick = () => openSheet(`<h2 class="sheet-h">Neuer Test</h2>
    <label class="field">Thema<input type="text" name="title" required placeholder="z. B. Kaufvertrag, Unit 3"></label>
    <label class="field">Datum <span class="muted small">(optional)</span><input type="date" name="date" min="${isoDate()}"></label>
    ${sheetButtons('Anlegen')}`,
  (fd) => { const t = S.addTest(id, fd.get('title'), fd.get('date')); go(`#/test/${t.id}/material`); });
  $('#editS').onclick = () => openSheet(`<h2 class="sheet-h">Fach bearbeiten</h2>
    <label class="field">Name<input type="text" name="name" required value="${h(s.name)}"></label>
    <div class="field"><span>Farbe</span>${swatches(s.color)}</div>
    ${sheetButtons('Sichern', '<button type="submit" class="btn plain danger-text" value="delete" formnovalidate>Löschen</button>')}`,
  (fd, btn) => {
    if (btn === 'delete') { setTimeout(() => confirmSheet(`„${s.name}“ mit allen Tests löschen?`, 'Fach löschen', () => { S.deleteSubject(id); go('#/'); })); return; }
    S.updateSubject(id, { name: fd.get('name').trim(), color: fd.get('color') }); route();
  });
}

// ---------- Test ----------
const TABS = [['lernen', 'Lernen'], ['material', 'Material'], ['karten', 'Karten'], ['spick', 'Spickzettel']];
function viewTest(id, tab) {
  const t = S.test(id); const s = S.subject(t.subjectId);
  main.innerHTML = `
    ${V.testHero(t, subTop(`#/fach/${s.id}`, h(V.longName(s.name)), topBtn('id="editT"', V.PEN, 'Test bearbeiten')))}
    <div class="rv-body stack-l">
      <nav class="rv-pills" aria-label="Bereiche">${TABS.map(([k, l]) => `<a href="#/test/${id}/${k}" aria-current="${k === tab ? 'page' : 'false'}">${l}</a>`).join('')}</nav>
      <div id="tab" class="stack-l"></div>
    </div>`;
  $('#editT').onclick = () => openSheet(`<h2 class="sheet-h">Test bearbeiten</h2>
    <label class="field">Thema<input type="text" name="title" required value="${h(t.title)}"></label>
    <label class="field">Datum<input type="date" name="date" value="${h(t.date)}"></label>
    ${sheetButtons('Sichern', '<button type="submit" class="btn plain danger-text" value="delete" formnovalidate>Löschen</button>')}`,
  (fd, btn) => {
    if (btn === 'delete') { setTimeout(() => confirmSheet(`„${t.title}“ löschen?`, 'Test löschen', () => { S.deleteTest(id); go(`#/fach/${s.id}`); })); return; }
    S.updateTest(id, { title: fd.get('title').trim(), date: fd.get('date') }); route();
  });
  const el = $('#tab');
  ({ lernen: tabLearn, material: tabMaterial, karten: tabCards, spick: tabCheat }[tab] || tabLearn)(el, t);
}

function tabLearn(el, t) {
  if (!S.cardsOf(t.id).length) {
    el.innerHTML = `<div class="rv-card empty"><p class="empty-title">Noch keine Karten</p><p>Fotografiere deine Arbeitsblätter oder lade PDF- und Word-Dateien hoch. Daraus entstehen die Abfragen.</p>
      <a class="btn primary big" href="#/test/${t.id}/material">Material hinzufügen</a></div>`;
    return;
  }
  el.innerHTML = V.learnHtml(t);
}

// Material
const CAM = '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const DOC = '<svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>';
const TXT = '<svg viewBox="0 0 24 24"><path d="M5 6h14M5 11h14M5 16h9"/></svg>';
function tabMaterial(el, t) {
  const docs = S.docsOf(t.id);
  el.innerHTML = `
    ${V.group('Hinzufügen', [
      `<label class="rv-row">${`<span class="dot-ico" data-tone="blau">${CAM}</span>`}<span class="row-txt"><span class="row-title">Foto aufnehmen</span><span class="row-sub">Arbeitsblatt, Heftseite, Tafelbild</span></span>${V.CHEV}<input type="file" id="cam" accept="image/*" capture="environment" hidden></label>`,
      `<label class="rv-row"><span class="dot-ico" data-tone="gruen">${DOC}</span><span class="row-txt"><span class="row-title">Datei auswählen</span><span class="row-sub">PDF, Word, PowerPoint, Bilder – auch aus GoodNotes</span></span>${V.CHEV}<input type="file" id="files" multiple accept="${ACCEPT}" hidden></label>`,
      V.cell({ act: 'x', icon: `<span class="dot-ico" data-tone="grau">${TXT}</span>`, title: 'Text einfügen', sub: 'Mitschrift oder Vokabeln abtippen', cls: 'paste-row' }),
    ].join(''), 'Dateien werden nur auf diesem Gerät gelesen und gespeichert.')}
    <div id="progress"></div>
    ${docs.length ? V.group('Dokumente', docs.map((d) => V.cell({ act: 'x', icon: `<span class="dot-ico" data-tone="${hasOriginal(d) ? 'blau' : 'grau'}">${hasOriginal(d) ? CAM : TXT}</span>`, title: h(d.name), sub: `${plural(S.get().cards.filter((c) => c.docId === d.id).length, 'Karte', 'Karten')}${hasOriginal(d) ? ' · Blatt vorhanden' : ''}`, cls: 'doc-row" data-doc="' + d.id })).join('')) : ''}`;
  $('#cam').onchange = (e) => handleFiles(t, [...e.target.files]);
  $('#files').onchange = (e) => handleFiles(t, [...e.target.files]);
  $('.paste-row').onclick = () => openSheet(`<h2 class="sheet-h">Text einfügen</h2>
    <label class="field">Titel<input type="text" name="name" required value="Mitschrift ${fmtDate(Date.now())}"></label>
    <label class="field">Text<textarea name="text" required rows="9" placeholder="Tipp: „Begriff: Erklärung“ pro Zeile wird eine Karteikarte."></textarea></label>
    ${sheetButtons('Karten erzeugen')}`,
  (fd) => { const d = S.addDoc(t.id, fd.get('name'), 'text', fd.get('text')); toast(`${plural(addGenerated(t.id, d), 'neue Karte', 'neue Karten')}`); route(); });
  $$('[data-doc]').forEach((b) => b.onclick = () => {
    const d = S.get().docs.find((x) => x.id === b.dataset.doc);
    actionSheet(d.name, [
      ...(hasOriginal(d) ? [{ label: 'Blatt ansehen', run: () => openOriginal(d) }] : []),
      { label: 'Text lesen', run: () => readDoc(d.id) },
      { label: 'Text korrigieren', run: () => editDoc(d) },
      { label: 'Entfernen', danger: true, run: () => setTimeout(() => confirmSheet(`„${d.name}“ und die Karten daraus entfernen?`, 'Entfernen', () => { S.deleteDoc(d.id, true); route(); })) },
    ]);
  });
}

async function handleFiles(t, files) {
  const prog = $('#progress');
  let total = 0;
  for (const f of files) {
    prog.innerHTML = `<div class="progress-card"><b>${h(f.name)}</b><span class="row-sub" id="pstat">Wird gelesen …</span><div class="meter"><i class="indet"></i></div></div>`;
    try {
      const r = await extractFile(f, (s) => { const p = $('#pstat'); if (p) p.textContent = s; });
      if (!r.text.trim()) throw new Error('Kein Text gefunden. Foto gerade, scharf und hell aufnehmen.');
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

function readDoc(id) {
  const d = S.get().docs.find((x) => x.id === id);
  let body = h(d.text);
  for (const m of (d.highlights || []).slice().sort((a, b) => b.length - a.length)) {
    const e = h(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body = body.replace(new RegExp(`(?<!<span class="mk">[^<]*)${e}`), `<span class="mk">${h(m)}</span>`);
  }
  body = body.split(/\n\s*\n/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  openSheet(`<h2 class="sheet-h">${h(d.name)}</h2><div class="reader-text">${body}</div>
    <div class="sheet-actions"><button type="button" class="btn primary" data-close>Fertig</button></div>`, () => {});
}
function editDoc(d) {
  openSheet(`<h2 class="sheet-h">Text korrigieren</h2><p class="row-sub">Fehler der Texterkennung verbessern. Danach werden die Karten aus diesem Dokument neu erzeugt.</p>
    <textarea name="text" rows="14">${h(d.text)}</textarea>${sheetButtons('Sichern')}`,
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
    <label class="search">${V.SEARCH}<input type="search" id="q" placeholder="${all.length} Karten durchsuchen" value="${h(query)}" aria-label="Karten durchsuchen"></label>
    <div class="seg small" role="group" aria-label="Filter">
      ${[['alle', 'Alle'], ['wichtig', 'Wichtig'], ['eigene', 'Eigene']].map(([k, l]) => `<button data-f="${k}" aria-current="${filter === k ? 'page' : 'false'}">${l}</button>`).join('')}
    </div>
    ${V.group('', V.cell({ act: 'x', icon: `<span class="dot-ico add" aria-hidden="true">${V.PLUS}</span>`, title: '<span class="link">Eigene Karten hinzufügen</span>', chev: false, cls: 'add-row' }))}
    ${list.length ? `<section class="rv-card"><div class="rv-rows">${list.slice(0, 200).map((c) => `<div class="rv-row card-cell" data-card="${c.id}">
        <span class="row-txt"><span class="row-sub">${TYPE_LABEL[c.type] || ''} · Fach ${S.progressOf(c.id).box}/5</span><span class="row-title">${h(c.q)}</span><span class="row-sub clamp">${h(c.a)}</span></span>
        <button class="starbtn ${c.star ? 'on' : ''}" data-star="${c.id}" aria-pressed="${!!c.star}" aria-label="Als wichtig markieren">${c.star ? '★' : '☆'}</button></div>`).join('')}</div>
      <p class="rv-foot">Automatisch erzeugte Karten können Fehler haben. Karte antippen zum Löschen.</p></section>` : '<p class="empty-note">Keine Karte gefunden.</p>'}`;
  const q = $('#q');
  q.oninput = () => { query = q.value; const pos = q.selectionStart; tabCards(el, t); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-f]', el).forEach((b) => b.onclick = () => { filter = b.dataset.f; tabCards(el, t); });
  $$('[data-star]', el).forEach((b) => b.onclick = (e) => { e.stopPropagation(); const c = all.find((x) => x.id === b.dataset.star); S.updateCard(c.id, { star: !c.star }); tabCards(el, t); });
  $$('[data-card]', el).forEach((row) => row.onclick = () => {
    const c = all.find((x) => x.id === row.dataset.card);
    actionSheet(c.q, [
      { label: c.star ? 'Nicht mehr als wichtig markieren' : 'Als wichtig markieren', run: () => { S.updateCard(c.id, { star: !c.star }); tabCards(el, t); } },
      { label: 'Karte löschen', danger: true, run: () => { S.deleteCard(c.id); tabCards(el, t); } },
    ]);
  });
  $('.add-row', el).onclick = () => openSheet(`<h2 class="sheet-h">Eigene Karten</h2>
    <p class="row-sub">Eine Karte pro Zeile: <b>Frage | Antwort</b></p>
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
  if (!docs.length) { el.innerHTML = '<p class="empty-note">Füge zuerst Material hinzu.</p>'; return; }
  const text = docs.map((d) => d.text).join('\n\n');
  const hl = docs.flatMap((d) => d.highlights || []);
  const kws = keywords(text, hl, 24);
  const sents = keySentences(text, hl, 12);
  const gloss = S.cardsOf(t.id).filter((c) => ['begriff', 'abkuerzung'].includes(c.type) && c.a.length < 160);
  const mark = (s) => {
    let out = h(s);
    kws.slice(0, 18).forEach((k) => {
      const re = new RegExp(`(^|[^\\wäöüÄÖÜß])(${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^\\wäöüÄÖÜß]|$)`, 'g');
      out = out.replace(re, '$1<span class="mk">$2</span>');
    });
    return out;
  };
  el.innerHTML = `
    <section class="rv-card"><header class="rv-card-head"><h2>Schlüsselbegriffe</h2></header><div class="terms">${kws.map((k) => `<span class="term">${h(k)}</span>`).join('')}</div></section>
    ${gloss.length ? V.group('Begriffe', gloss.map((c) => V.cell({ title: h(c.q.replace(/^Wofür steht die Abkürzung |\?$/g, '')), sub: h(c.a), chev: false })).join('')) : ''}
    <section class="rv-card"><header class="rv-card-head"><h2>Kernaussagen</h2></header><ol class="sheet-paper">${sents.map((s) => `<li>${mark(s)}</li>`).join('')}</ol></section>`;
}

// ---------- Mehr ----------
function viewMore() {
  const theme = (() => { try { return localStorage.getItem('lernapp.theme') || 'auto'; } catch { return 'auto'; } })();
  main.innerHTML = `
    <header class="rv-plain-head"><h1>Mehr</h1></header>
    ${V.group('Darstellung', `<div class="rv-row"><span class="row-txt"><span class="row-title">Erscheinungsbild</span></span></div>
      <div class="rv-row plainrow"><div class="seg small full" role="group" aria-label="Farbschema">${[['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<button data-theme-set="${k}" aria-current="${theme === k ? 'page' : 'false'}">${l}</button>`).join('')}</div></div>`)}
    ${V.group('Sicherung', V.cell({ act: 'x', title: '<span class="link">Sicherung herunterladen</span>', chev: false, cls: 'backup-row' }) +
      `<label class="rv-row"><span class="row-txt"><span class="row-title link">Sicherung laden</span></span><input type="file" accept=".json,application/json" id="restore" hidden></label>`,
      'Dein Lernstand liegt nur in diesem Browser. Lade ab und zu eine Sicherung herunter, z. B. bevor du den Verlauf löschst oder das Handy wechselst.')}
    ${V.group('', V.cell({ act: 'x', title: 'Beispiel laden', sub: 'Deutsch: Eine Frage der Ehre', cls: 'demo-row' }) + V.cell({ href: '../', title: 'PC-Version öffnen', sub: 'Gleiche Funktionen, eigener Speicher' }))}`;
  $('.backup-row').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([S.exportJSON()], { type: 'application/json' }));
    a.download = `lernapp-sicherung-${isoDate()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#restore').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const text = await f.text();
    actionSheet('Sicherung laden', [
      { label: 'Mit vorhandenen Daten zusammenführen', run: () => { try { S.importJSON(text, 'merge'); toast('Sicherung geladen'); go('#/'); } catch (err) { toast(err.message); } } },
      { label: 'Alles ersetzen', danger: true, run: () => { try { S.importJSON(text, 'replace'); toast('Sicherung geladen'); go('#/'); } catch (err) { toast(err.message); } } },
    ]);
  };
  $$('[data-theme-set]').forEach((b) => b.onclick = () => { setTheme(b.dataset.themeSet); viewMore(); });
  $('.demo-row').onclick = () => { const t = loadBeispiel(); if (!t) toast('Beispiel ist schon da'); else go(`#/test/${t.id}`); };
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
