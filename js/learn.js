// Lernmodi: Karteikarten, Wiederholen, Quiz, Wahr/Falsch, Lückentext, Zuordnen, Schreiben, Probetest
import * as S from './store.js';
import { keywords, similarity, listScore, gradeFor, TYPE_LABEL } from './gen.js';

// Antwort bewerten: Aufzählungen nach Anzahl genannter Punkte, sonst Textähnlichkeit
const score = (given, c) => (c.need ? listScore(given, c.a, c.need).score : similarity(given, c.a));
import { h, $, $$, shuffle, sample, toast, cvar, plural, ICON } from './util.js';

const CLOZE = new Set(['lueckentext', 'zeit', 'markiert']);
const isCloze = (c) => CLOZE.has(c.type) || c.q.includes('_____');
const shortQA = (c) => !isCloze(c) && c.a.length <= 110 && c.q.length <= 140;

export const MODES = [
  { key: 'karteikarten', title: 'Karteikarten', icon: 'cards', color: 'gelb', text: 'Karte umdrehen, ehrlich bewerten. Was du nicht wusstest, kommt nochmal.', count: (c) => plural(c.length, 'Karte', 'Karten'), missing: '' },
  { key: 'wiederholen', title: 'Lernkartei', icon: 'repeat', color: 'gruen', text: 'Nur was heute dran ist. Gewusste Karten kommen seltener, vergessene öfter.', count: (c, due) => due ? `${due} heute fällig` : 'Alles wiederholt', missing: '' },
  { key: 'quiz', title: 'Quiz', icon: 'quiz', color: 'blau', text: 'Alles zum Anklicken: eine richtige Antwort oder mehrere ankreuzen.', count: (c) => `${Math.min(15, c.length)} Fragen`, missing: 'Braucht mindestens 4 Karten' },
  { key: 'ankreuzen', title: 'Ankreuzen', icon: 'check', color: 'gruen', text: 'Aufzählungen und lange Antworten: alle richtigen anklicken.', count: (c) => plural(c.filter(multiCapable).length, 'Aufgabe', 'Aufgaben'), missing: 'Keine Aufzählungen vorhanden' },
  { key: 'wahrfalsch', title: 'Wahr oder falsch', icon: 'tf', color: 'pink', text: 'Schnelle Runde: Stimmt die Aussage oder nicht?', count: () => '12 Aussagen', missing: 'Braucht mindestens 4 Karten' },
  { key: 'lueckentext', title: 'Lückentext', icon: 'gap', color: 'orange', text: 'Das fehlende Wort aus vier Möglichkeiten anklicken.', count: (c) => plural(c.filter(isCloze).length, 'Lücke', 'Lücken'), missing: 'Keine Lückentext-Karten vorhanden' },
  { key: 'zuordnen', title: 'Zuordnen', icon: 'match', color: 'lila', text: 'Begriffe und Erklärungen paarweise verbinden.', count: (c) => `${Math.min(3, Math.floor(c.filter(shortQA).length / 4))} Runden`, missing: 'Braucht mindestens 4 Begriff-Karten' },
  { key: 'schreiben', title: 'Antwort schreiben', icon: 'write', color: 'gelb', text: 'Freiwillig: Antwort selbst formulieren und mit der Lösung vergleichen.', count: (c) => plural(c.filter((x) => !isCloze(x)).length, 'Frage', 'Fragen'), missing: 'Keine Frage-Karten vorhanden' },
  { key: 'probetest', title: 'Probetest', icon: 'exam', color: 'blau', text: 'Gemischte Aufgaben zum Anklicken – mit Punkten und Note nach IHK-Schlüssel.', count: () => 'Ergebnis mit Note', missing: 'Braucht mindestens 6 Karten' },
  { key: 'klassenarbeit', title: 'Klassenarbeit', icon: 'exam', color: 'lila', text: 'Wie vom Lehrer: Ankreuzen, Begriffe, Fälle mit Punkten. Jedes Mal eine neue Variante.', count: () => 'Neue Variante', missing: 'Braucht mindestens 8 Karten' },
];

export function modeAvailable(key, cards) {
  if (key === 'karteikarten' || key === 'wiederholen') return cards.length > 0;
  if (key === 'quiz' || key === 'wahrfalsch') return cards.length >= 4;
  if (key === 'lueckentext') return cards.some(isCloze);
  if (key === 'ankreuzen') return cards.some(multiCapable);
  if (key === 'zuordnen') return cards.filter(shortQA).length >= 4;
  if (key === 'schreiben') return cards.some((c) => !isCloze(c));
  if (key === 'probetest') return cards.length >= 6;
  if (key === 'klassenarbeit') return cards.length >= 8;
  return false;
}

let cleanup = null;
function onKey(fn) {
  if (cleanup) cleanup();
  const handler = (e) => { if (!e.target.closest('input,textarea,[contenteditable]') || e.key === 'Enter') fn(e); };
  document.addEventListener('keydown', handler);
  cleanup = () => document.removeEventListener('keydown', handler);
}
window.addEventListener('hashchange', () => { if (cleanup) { cleanup(); cleanup = null; } });

// ---------- Einstieg ----------
export function startSession(main, testId, mode, extra) {
  const all = testId === 'alle';
  const t = all ? null : S.test(testId);
  if (!all && !t) { location.hash = '#/'; return; }
  const cards = all ? S.get().cards : S.cardsOf(testId);
  const back = all ? '#/' : `#/test/${testId}`;
  const info = mode === 'thema' ? { key: 'thema', title: 'Abfrage' } : mode === 'fehler' ? { key: 'fehler', title: 'Fehler wiederholen' } : MODES.find((m) => m.key === mode);
  if (!info || (!['thema', 'fehler'].includes(mode) && !modeAvailable(mode, cards)) || !cards.length) { location.hash = back; return; }

  const docsText = (all ? S.get().docs : S.docsOf(testId)).map((d) => d.text).join('\n\n');
  const years = [...new Set(docsText.match(/\b(1[0-9]{3}|20[0-9]{2})\b/g) || [])];
  const centuries = [...new Set(docsText.match(/\b\d{1,2}\. Jahrhundert/g) || [])];
  const hl = [...new Set((all ? S.get().docs : S.docsOf(testId)).flatMap((d) => d.highlights || []))].filter((x) => x.split(' ').length <= 5);
  const ctx = { main, t, cards, back, mode, extra, info, hl, kws: keywords(docsText, [], 80), years, centuries, title: all ? 'Alle Fächer' : t.title };

  if (mode === 'thema') return thema(ctx, extra);
  if (mode === 'fehler') {
    const wrong = cards.filter((c) => S.progressOf(c.id).wrong > 0 && S.progressOf(c.id).box < 3)
      .sort((a, b) => S.progressOf(b.id).wrong - S.progressOf(a.id).wrong);
    if (!wrong.length) { location.hash = back; return; }
    return runFlash(ctx, wrong.slice(0, 30));
  }
  ({ karteikarten: flashcards, wiederholen: review, quiz, ankreuzen, wahrfalsch: trueFalse, lueckentext: cloze, zuordnen: matching, schreiben: writing, probetest: exam, klassenarbeit })[mode](ctx);
}

function frame(ctx, i, n, body) {
  ctx.main.innerHTML = `
    <div class="session">
      <div class="session-top">
        <a class="btn small ghost" href="${ctx.back}">Beenden</a>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${i}"><i style="width:${n ? i / n * 100 : 0}%;background:var(--blue)"></i></div>
        <span class="counter">${Math.min(i + 1, n)} / ${n}</span>
      </div>
      <div><span class="small muted">${h(ctx.title)}</span><h2>${ctx.info.title}</h2></div>
      <div id="stage">${body}</div>
    </div>`;
  return $('#stage');
}

function finish(ctx, right, total, extra = '') {
  if (cleanup) { cleanup(); cleanup = null; }
  const pct = total ? Math.round(right / total * 100) : 0;
  const msg = pct >= 90 ? 'Stark! Das sitzt.' : pct >= 70 ? 'Gut dabei – noch ein Durchgang?' : pct >= 50 ? 'Halbe Miete. Nochmal üben lohnt sich.' : 'Dranbleiben – Wiederholung macht’s.';
  ctx.main.innerHTML = `
    <div class="session">
      <div class="sheet result">
        <span class="small muted">${h(ctx.title)} · ${ctx.info.title}</span>
        <div class="due-num">${right} / ${total}</div>
        <span class="margin-note">${msg}</span>
        ${extra}
        <div class="row" style="justify-content:center">
          <a class="btn primary" href="#/lernen/${ctx.t ? ctx.t.id : 'alle'}/${ctx.mode}" data-again>Nochmal</a>
          <a class="btn" href="${ctx.back}">Zurück</a>
        </div>
      </div>
    </div>`;
  $('[data-again]').onclick = (e) => { e.preventDefault(); startSession(ctx.main, ctx.t ? ctx.t.id : 'alle', ctx.mode, ctx.extra); };
}

// ---------- Karteikarten & Lernkartei ----------
function flashcards(ctx) {
  const due = ctx.cards.filter((c) => S.isDue(c.id));
  const rest = ctx.cards.filter((c) => !S.isDue(c.id));
  const star = (l) => [...shuffle(l.filter((c) => c.star)), ...shuffle(l.filter((c) => !c.star))];
  runFlash(ctx, [...star(due), ...star(rest)].slice(0, 40));
}
function review(ctx) {
  const seen = ctx.cards.filter((c) => S.progressOf(c.id).last && S.isDue(c.id));
  const fresh = ctx.cards.filter((c) => !S.progressOf(c.id).last);
  const starFirst = (l) => [...l.filter((c) => c.star), ...l.filter((c) => !c.star)];
  const list = [...starFirst(shuffle(seen)).slice(0, 30), ...starFirst(shuffle(fresh)).slice(0, Math.max(5, 20 - seen.length))];
  if (!list.length) {
    ctx.main.innerHTML = `<div class="session"><div class="sheet result"><span class="margin-note">Für heute alles erledigt!</span><p class="muted">Morgen sind wieder Karten fällig. Bis dahin: Quiz oder Probetest?</p><a class="btn" href="${ctx.back}">Zurück</a></div></div>`;
    return;
  }
  runFlash(ctx, list);
}

function runFlash(ctx, queue) {
  let i = 0, right = 0, total = queue.length;
  const again = new Set();
  const show = () => {
    if (i >= queue.length) return finish(ctx, right, total);
    const c = queue[i];
    const p = S.progressOf(c.id);
    const front = isCloze(c) ? h(c.q).replace('_____', '<span style="border-bottom:2.5px solid #1A2550;display:inline-block;min-width:4em">&nbsp;</span>') : h(c.q);
    const stage = frame(ctx, i, queue.length, `
      <div class="stack">
        <div class="flash" id="flash" role="button" tabindex="0" aria-label="Karte umdrehen">
          <div class="flash-inner">
            <div class="face front"><span class="type">${c.star ? '★ Wichtig · ' : ''}${TYPE_LABEL[c.type] || ''}${again.has(c.id) ? ' · nochmal' : ''}</span><div class="front-text">${front}</div><span class="hint">Antippen zum Umdrehen<span class="kbd-hint"> · <kbd>Leertaste</kbd></span></span></div>
            <div class="face back"><span class="type">Antwort</span>${isCloze(c)
              ? `<div class="back-text">${h(c.q).replace('_____', `<span class="mk" data-c="gelb">${h(c.a)}</span>`)}</div>`
              : `<div class="back-q">${h(c.q)}</div><div class="back-text ${c.a.length > 180 ? 'long' : ''}">${h(c.a)}</div>`}</div>
          </div>
        </div>
        <div class="boxes" aria-label="Lernkartei-Fach ${p.box} von 5">${[1, 2, 3, 4, 5].map((b) => `<span class="${p.box >= b ? 'on' : ''}"></span>`).join('')}</div>
        <div class="answer-row three" id="ans" hidden>
          <button class="btn dont" data-r="0">Wiederholen <kbd>1</kbd></button>
          <button class="btn hard" data-r="h">Schwierig <kbd>2</kbd></button>
          <button class="btn know" data-r="1">Wusste ich <kbd>3</kbd></button>
        </div>
      </div>`);
    const flash = $('#flash', stage), ans = $('#ans', stage);
    const flip = () => { flash.classList.toggle('flipped'); ans.hidden = false; };
    flash.onclick = flip;
    const rate = (ok) => {
      S.grade(c.id, ok);
      if (ok === 'hard') { if (!again.has(c.id)) right++; }
      else if (ok) { if (!again.has(c.id)) right++; }
      else if (!again.has(c.id)) { again.add(c.id); queue.push(c); }
      i++; show();
    };
    $$('[data-r]', stage).forEach((b) => b.onclick = () => rate(b.dataset.r === 'h' ? 'hard' : b.dataset.r === '1'));
    onKey((e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
      else if (!ans.hidden && (e.key === '1' || e.key === 'ArrowLeft')) rate(false);
      else if (!ans.hidden && e.key === '2') rate('hard');
      else if (!ans.hidden && (e.key === '3' || e.key === 'ArrowRight')) rate(true);
    });
    flash.focus({ preventScroll: true });
  };
  show();
}

// ---------- Ablenker (falsche Antworten) ----------
// Falsche Antwortmöglichkeiten bei Zahlen: nur andere Jahreszahlen/Jahrhunderte aus den eigenen Unterlagen
function numericDistractors(a, ctx) {
  const century = /^\d{1,2}\. Jahrhunderts?$/.test(a);
  const year = /^\d{3,4}$/.test(a);
  if (!century && !year) return null;
  const pool = century ? ctx.centuries : ctx.years;
  const base = a.replace(/s$/, '');
  return shuffle(pool.filter((x) => x !== base)).slice(0, 3).map((x) => (century && a.endsWith('s') ? x + 's' : x));
}
function distractors(card, ctx, n = 3) {
  const num = numericDistractors(card.a, ctx);
  if (num) return num.slice(0, n);
  const norm = (s) => s.toLowerCase().trim();
  const a = norm(card.a);
  let pool = ctx.cards.filter((c) => c.id !== card.id && isCloze(c) === isCloze(card)).map((c) => c.a);
  if (isCloze(card)) pool = pool.concat(ctx.kws);
  pool = [...new Set(pool)].filter((x) => { const y = norm(x); return y && y !== a && !y.includes(a) && !a.includes(y) && !/^\d/.test(x) === !/^\d/.test(card.a); });
  // ähnlich lange Antworten bevorzugen, damit die richtige nicht heraussticht
  pool.sort((x, y) => Math.abs(x.length - card.a.length) - Math.abs(y.length - card.a.length));
  let pick = sample(pool.slice(0, Math.max(n * 3, 8)), n);
  if (pick.length < n) pick = pick.concat(sample(ctx.kws.filter((k) => norm(k) !== a && !pick.includes(k)), n - pick.length));
  return pick;
}

function questionHtml(c) {
  return isCloze(c) ? h(c.q).replace('_____', '<span class="gap">&nbsp;</span>') : h(c.q);
}
// Berichtigung: falsche Antwort durchgestrichen, darunter die richtige und warum
function fixHtml(c, ctx, { given = '', right = c.a, note = '', full = false, link = false } = {}) {
  const other = given && given !== right ? ctx.cards.find((x) => x.id !== c.id && x.a === given) : null;
  const doc = c.docId ? S.get().docs.find((d) => d.id === c.docId) : null;
  return `<div class="fix">
    ${given ? `<div class="fix-row no"><span class="fix-label">Deine Antwort</span><s>${h(given)}</s></div>` : ''}
    <div class="fix-row ok"><span class="fix-label">Richtig</span><span class="fix-right">${h(right)}</span></div>
    ${note ? `<div class="fix-why">${note}</div>` : ''}
    ${other ? `<div class="fix-why">Warum falsch? Deine Antwort gehört zu „${h(other.q)}“, nicht zu dieser Frage.</div>` : ''}
    ${full && right !== c.a ? `<div class="fix-why">Vollständige Antwort: ${h(c.a)}</div>` : ''}
    ${sourceHtml(c)}
    ${doc ? (link ? `<a class="fix-doc" href="#/lesen/${doc.testId}/${doc.id}">Nachlesen: ${h(doc.name)} →</a>` : `<div class="fix-doc">Steht in: ${h(doc.name)}</div>`) : ''}
  </div>`;
}

function sourceHtml(c) {
  return c.source && !c.source.startsWith('Antwort aus') && c.source !== c.q ? `<div class="src">Aus dem Text: „${h(c.source.length > 260 ? c.source.slice(0, 260) + '…' : c.source)}“</div>` : '';
}

// ---------- Ankreuz-Aufgaben (mehrere richtige) ----------
const stems = (s) => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 4);
const overlaps = (x, y) => { const b = stems(y); return stems(x).some((w) => b.some((v) => v.slice(0, 5) === w.slice(0, 5))); };

// Aufzählung in einzelne Punkte zerlegen ("Ehrlichkeit, Vorsicht, …")
function listItems(a, min = 4) {
  const body = a.replace(/^[^:]{2,45}:\s*/, '');
  if (/[.!?]\s+[A-ZÄÖÜ„]/.test(body)) return [];
  const items = body.split(/\s*[,;]\s*/).map((x) => x.replace(/^(und|sowie)\s+/i, '').replace(/\.$/, '').trim()).filter((x) => x.length >= 3 && x.length <= 60);
  return items.length >= min ? [...new Set(items)] : [];
}
// Lange Antwort in einzelne Aussagen zerlegen
function statements(a) {
  return a.split(/(?<=[.!?“])\s+(?=[A-ZÄÖÜ„])|;\s+/).map((s) => s.trim())
    .filter((s) => s.length >= 30 && s.length <= 280 && (s.match(/,/g) || []).length < 4);
}
const multiCapable = (c) => !isCloze(c) && (listItems(c.a).length > 0 || (c.a.length > 110 && statements(c.a).length >= 2));

// Falsche Kreuze kommen nur aus den eigenen Unterlagen (andere Karten, Schlüsselbegriffe)
function multiTask(c, ctx) {
  const items = listItems(c.a);
  if (items.length) {
    const nOk = Math.min(items.length, c.need || 6);
    // zuerst Punkte aus anderen Antworten und markierte Begriffe, nur notfalls einzelne Schlüsselwörter
    const fits = (x) => x.length <= 60 && !items.some((i) => overlaps(i, x)) && !overlaps(c.q, x);
    let pool = [];
    for (const o of ctx.cards) if (o.id !== c.id && !isCloze(o)) pool.push(...listItems(o.a, 2));
    pool.push(...ctx.hl);
    pool = [...new Set(pool)].filter(fits);
    const want = Math.min(5, Math.max(3, Math.round(nOk / 2)));
    let wrong = sample(pool, want);
    if (wrong.length < want) {
      const kw = ctx.kws.filter((k) => fits(k) && !/(ischen|lichen|igen|alen|ens)$/.test(k) && !wrong.includes(k));
      wrong = wrong.concat(sample(kw, want - wrong.length));
    }
    if (wrong.length < 2) return null;
    return { prompt: `Wähle alle richtigen aus – ${nOk} sind richtig.`, options: shuffle([...sample(items, nOk).map((t) => ({ t, ok: true })), ...wrong.map((t) => ({ t, ok: false }))]) };
  }
  const st = statements(c.a);
  if (st.length < 2) return null;
  let pool = [];
  for (const o of ctx.cards) if (o.id !== c.id && !isCloze(o)) pool.push(...statements(o.a));
  pool = [...new Set(pool)].filter((x) => !st.includes(x));
  const wrong = sample(pool, 2);
  if (!wrong.length) return null;
  const right = sample(st, Math.min(3, st.length));
  return { prompt: `Welche Aussagen gehören zur Antwort? ${right.length} sind richtig.`, options: shuffle([...right.map((t) => ({ t, ok: true })), ...wrong.map((t) => ({ t, ok: false }))]) };
}
// Bewertung: richtige Kreuze minus falsche Kreuze, bezogen auf die Zahl der richtigen
function multiScore(task, sel) {
  const nOk = task.options.filter((o) => o.ok).length;
  let hit = 0, bad = 0;
  task.options.forEach((o, i) => { if (sel.has(i)) { if (o.ok) hit++; else bad++; } });
  return Math.max(0, (hit - bad) / nOk);
}
const multiHtml = (task, sel, solved = false) => `<p class="small muted">${h(task.prompt)}</p><div class="opts multi">${task.options.map((o, k) => {
  const cls = !solved ? (sel.has(k) ? 'on' : '') : o.ok && sel.has(k) ? 'right' : !o.ok && sel.has(k) ? 'wrong' : o.ok ? 'missed' : '';
  return `<button type="button" class="opt check ${cls}" data-m="${k}" aria-pressed="${sel.has(k)}" ${solved ? 'disabled' : ''}><span class="key">${sel.has(k) ? '✓' : ''}</span><span>${h(o.t)}</span></button>`;
}).join('')}</div>`;

// ---------- Quiz (alles zum Anklicken) ----------
function quiz(ctx) {
  const stars = shuffle(ctx.cards.filter((c) => c.star));
  const rest = shuffle(ctx.cards.filter((c) => !c.star));
  const list = [];
  for (const c of [...stars.slice(0, 3), ...rest]) {
    if (list.length >= 15) break;
    const multi = (c.need || c.a.length > 110 || (listItems(c.a).length && Math.random() < 0.6)) ? multiTask(c, ctx) : null;
    if (multi) list.push({ c, multi });
    else if (c.a.length <= 160) list.push({ c });
  }
  runChoice(ctx, list);
}

function ankreuzen(ctx) {
  const cand = [...shuffle(ctx.cards.filter((c) => c.star)), ...shuffle(ctx.cards.filter((c) => !c.star))].filter(multiCapable);
  const list = [];
  for (const c of cand) {
    if (list.length >= 10) break;
    const multi = multiTask(c, ctx);
    if (multi) list.push({ c, multi });
  }
  runChoice(ctx, list);
}

function runChoice(ctx, list) {
  let i = 0, right = 0;
  const wrongs = [];
  const next = () => { i++; show(); };
  const after = (stage, ok, c, fix = {}) => {
    if (ok) right++; else wrongs.push({ c, fix });
    if (c.id) S.grade(c.id, ok);
    $('#fb', stage).innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}"><b>${ok ? 'Richtig!' : 'Nicht ganz – so ist es richtig:'}</b>${ok ? sourceHtml(c) : fixHtml(c, ctx, fix)}</div>
      <div class="row end" style="margin-top:14px"><button class="btn primary" id="next">Weiter <kbd>Enter</kbd></button></div>`;
    $('#next').onclick = next;
    $('#next').focus();
  };
  const show = () => {
    if (i >= list.length) return finish(ctx, right, list.length, reviewList(wrongs, ctx));
    const item = list[i];
    const { c, multi } = item;
    if (item.tf) {
      const { truth, text } = item.tf;
      const stage = frame(ctx, i, list.length, `
        <div class="sheet question">
          <span class="small muted">Stimmt das?</span>
          <div class="qtext">${h(text)}</div>
          <div class="tf"><button class="btn know" data-v="1">Wahr</button><button class="btn dont" data-v="0">Falsch</button></div>
          <div id="fb"></div>
        </div>`);
      let done = false;
      const pick = (v) => {
        if (done) return; done = true;
        $$('[data-v]', stage).forEach((b) => b.disabled = true);
        const fix = truth
          ? { right: text, note: 'Die Aussage stimmt – du hast „falsch“ gewählt.' }
          : { given: text, right: c.id ? c.a : c.a.replace(/^falsch – /, ''), note: 'Die Aussage ist falsch.' };
        after(stage, v === truth, { ...c, q: text, a: truth ? 'wahr' : (c.id ? `falsch – richtig: ${c.a}` : 'falsch') }, fix);
      };
      $$('[data-v]', stage).forEach((b) => b.onclick = () => pick(b.dataset.v === '1'));
      onKey((e) => { const k = e.key.toLowerCase(); if (k === 'w') pick(true); else if (k === 'f') pick(false); });
      return;
    }
    if (multi) {
      const sel = new Set();
      const stage = frame(ctx, i, list.length, `
        <div class="sheet question">
          <div class="qtext">${questionHtml(c)}</div>
          <div id="mbox">${multiHtml(multi, sel)}</div>
          <div class="row end" id="act"><button class="btn primary" id="check">Prüfen</button></div>
          <div id="fb"></div>
        </div>`);
      const bind = () => $$('[data-m]', stage).forEach((b) => b.onclick = () => {
        const k = +b.dataset.m; if (sel.has(k)) sel.delete(k); else sel.add(k);
        $('#mbox', stage).innerHTML = multiHtml(multi, sel); bind();
      });
      bind();
      $('#check', stage).onclick = () => {
        const nOk = multi.options.filter((o) => o.ok).length;
        const hit = multi.options.filter((o, k) => o.ok && sel.has(k)).length;
        const ok = multiScore(multi, sel) === 1;
        $('#mbox', stage).innerHTML = multiHtml(multi, sel, true);
        $('#act', stage).hidden = true;
        const bad = multi.options.filter((o, k) => !o.ok && sel.has(k)).map((o) => o.t);
        after(stage, ok, c, {
          given: bad.join(' · '),
          right: multi.options.filter((o) => o.ok).map((o) => o.t).join(' · '),
          note: `${hit} von ${nOk} richtigen gefunden${bad.length ? `, ${plural(bad.length, 'falsches Kreuz', 'falsche Kreuze')} (durchgestrichen)` : ''}. Grün umrandet = hättest du ankreuzen müssen.`,
          full: true,
        });
      };
      onKey((e) => { if (e.key === 'Enter' && !$('#act', stage).hidden) $('#check', stage).click(); });
      return;
    }
    const opts = item.opts || shuffle([c.a, ...distractors(c, ctx)]);
    const stage = frame(ctx, i, list.length, `
      <div class="sheet question">
        <div class="qtext">${questionHtml(c)}</div>
        <div class="opts">${opts.map((o, k) => `<button class="opt" data-o="${k}"><span class="key">${'ABCD'[k]}</span><span>${h(o)}</span></button>`).join('')}</div>
        <div id="fb"></div>
      </div>`);
    let answered = false;
    const pick = (k) => {
      if (answered || k >= opts.length) return;
      answered = true;
      const ok = opts[k] === c.a;
      $$('.opt', stage).forEach((b, j) => { b.disabled = true; if (opts[j] === c.a) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
      after(stage, ok, c, { given: opts[k] });
    };
    $$('.opt', stage).forEach((b) => b.onclick = () => pick(+b.dataset.o));
    onKey((e) => {
      const k = 'abcd'.indexOf(e.key.toLowerCase());
      if (!answered && k >= 0) pick(k);
      else if (!answered && /^[1-4]$/.test(e.key)) pick(+e.key - 1);
    });
  };
  if (!list.length) { finish(ctx, 0, 0); return; }
  show();
}

// ---------- Wahr / Falsch ----------
function trueFalse(ctx) {
  const list = sample(ctx.cards.filter((c) => c.a.length <= 140), 12).map((c) => {
    const truth = Math.random() < 0.5;
    const shown = truth ? c.a : (distractors(c, ctx, 1)[0] || c.a);
    return { c, truth: truth || shown === c.a, shown };
  });
  let i = 0, right = 0;
  const wrongs = [];
  const show = () => {
    if (i >= list.length) return finish(ctx, right, list.length, reviewList(wrongs, ctx));
    const { c, truth, shown } = list[i];
    const stmt = isCloze(c)
      ? h(c.q).replace('_____', `<span class="mk" data-c="pink">${h(shown)}</span>`)
      : `${h(c.q)}<div style="margin-top:12px;font-weight:400" class="hand-answer">→ <span class="mk" data-c="pink">${h(shown)}</span></div>`;
    const stage = frame(ctx, i, list.length, `
      <div class="sheet question">
        <span class="small muted">Stimmt das?</span>
        <div class="qtext">${stmt}</div>
        <div class="tf"><button class="btn know" data-v="1">Wahr <kbd>W</kbd></button><button class="btn dont" data-v="0">Falsch <kbd>F</kbd></button></div>
        <div id="fb"></div>
      </div>`);
    let answered = false;
    const pick = (v) => {
      if (answered) return; answered = true;
      const ok = v === truth;
      const fix = truth ? { note: 'Die Aussage stimmt – du hast „falsch“ gewählt.' } : { given: shown, note: 'Die Aussage ist falsch.' };
      if (ok) right++; else wrongs.push({ c, fix });
      S.grade(c.id, ok);
      $$('[data-v]', stage).forEach((b) => b.disabled = true);
      $('#fb', stage).innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}"><b>${ok ? 'Richtig!' : 'Falsch – so ist es richtig:'}</b>${ok ? `Die Aussage ist ${truth ? 'wahr' : `falsch. Richtig: ${h(c.a)}`}.${sourceHtml(c)}` : fixHtml(c, ctx, fix)}</div>
        <div class="row end" style="margin-top:14px"><button class="btn primary" id="next">Weiter <kbd>Enter</kbd></button></div>`;
      $('#next').onclick = () => { i++; show(); };
      $('#next').focus();
    };
    $$('[data-v]', stage).forEach((b) => b.onclick = () => pick(b.dataset.v === '1'));
    onKey((e) => { const k = e.key.toLowerCase(); if (k === 'w' || k === 'arrowleft') pick(true); else if (k === 'f' || k === 'arrowright') pick(false); });
  };
  show();
}

// ---------- Themen-Abfragen ----------
const GLOSSAR = new Set(['begriff', 'abkuerzung', 'definition']);
const NOT_TOPIC = /^(Nenne|Nennen|Welche|Welcher|Welches|Was|Wie|Warum|Wann|Wo|Wer|Inwiefern|Zähle|Beschreibe|Erkläre|Mittelalter|Jahrhundert|Text|Arbeitsblatt|Aufgabe)$/;

// Thema einer Aufzählungs-Frage: letztes Substantiv der Frage ("Nenne 8 Tugenden." → "Tugenden")
function topicLabel(q) {
  const nouns = (q.match(/[A-ZÄÖÜ][a-zäöüß]{3,}/g) || []).filter((w) => !NOT_TOPIC.test(w));
  return nouns.at(-1) || null;
}

export function topicsOf(cards, docs = []) {
  const out = [];
  const gl = cards.filter((c) => GLOSSAR.has(c.type) && c.a.length <= 140);
  if (gl.length >= 4) out.push({ key: 'begriffe', label: 'Begriffe', sub: `${gl.length} Begriffe und ihre Bedeutung` });
  const lists = new Map();
  for (const c of cards) {
    if (isCloze(c) || !listItems(c.a).length) continue;
    const label = topicLabel(c.q);
    if (!label) continue;
    const key = label.toLowerCase();
    if (!lists.has(key)) lists.set(key, { label, items: [] });
    for (const it of listItems(c.a)) if (!lists.get(key).items.some((x) => overlaps(x, it) || x === it)) lists.get(key).items.push(it);
  }
  for (const [key, v] of lists) out.push({ key: 'liste:' + key, label: v.label, sub: `${v.items.length} Punkte – was gehört dazu, was nicht?` });
  const zeit = cards.filter((c) => c.type === 'zeit');
  if (zeit.length >= 4) out.push({ key: 'zeit', label: 'Jahreszahlen', sub: `${zeit.length} Zeitangaben aus dem Text` });
  for (const d of docs) {
    const n = cards.filter((c) => c.docId === d.id).length;
    if (n >= 4) out.push({ key: 'doc:' + d.id, label: d.name.replace(/^(Lesetext|Arbeitsblatt|Kurzarbeit): ?/, ''), sub: `Abfrage zu „${d.name}“ · ${plural(n, 'Karte', 'Karten')}` });
  }
  return out;
}

const askTerm = (c) => (c.type === 'begriff' ? `Was bedeutet „${c.q}“?` : c.q);

function topicQuestions(key, ctx) {
  const cards = ctx.cards;
  const list = [];
  if (key === 'begriffe') {
    const gl = shuffle(cards.filter((c) => GLOSSAR.has(c.type) && c.a.length <= 140));
    gl.slice(0, 14).forEach((c, i) => {
      const others = gl.filter((o) => o.id !== c.id);
      const form = i % 3;
      if (form === 0 || others.length < 3) list.push({ c: { ...c, q: askTerm(c) }, opts: shuffle([c.a, ...sample(others.map((o) => o.a), 3)]) });
      else if (form === 1 && c.type === 'begriff') list.push({ c: { ...c, q: `Welcher Begriff passt zu: „${c.a}“?`, a: c.q }, opts: shuffle([c.q, ...sample(others.filter((o) => o.type === 'begriff').map((o) => o.q), 3)]) });
      else if (c.type === 'begriff') {
        const truth = Math.random() < 0.5;
        const shown = truth ? c.a : sample(others, 1)[0].a;
        list.push({ c, tf: { truth, text: `„${c.q}“ bedeutet: ${shown}` } });
      } else list.push({ c: { ...c, q: askTerm(c) }, opts: shuffle([c.a, ...sample(others.map((o) => o.a), 3)]) });
    });
    return list;
  }
  if (key.startsWith('liste:')) {
    const topicKey = key.slice(6);
    const src = cards.filter((c) => !isCloze(c) && listItems(c.a).length && topicLabel(c.q)?.toLowerCase() === topicKey);
    if (!src.length) return list;
    const label = topicLabel(src[0].q);
    const items = [];
    for (const c of src) for (const it of listItems(c.a)) if (!items.some((x) => overlaps(x, it) || x === it)) items.push(it);
    const fits = (x) => x.length <= 60 && !items.some((i) => overlaps(i, x)) && !overlaps(label, x);
    let pool = [];
    for (const o of cards) if (!src.includes(o) && !isCloze(o)) pool.push(...listItems(o.a, 2));
    pool.push(...ctx.hl);
    pool = [...new Set(pool)].filter(fits);
    if (pool.length < 4) pool = pool.concat(ctx.kws.filter((k) => fits(k) && !/(ischen|lichen|igen|alen|ens)$/.test(k) && !pool.includes(k)));
    if (pool.length < 3) return list;
    const base = src[0];
    const its = shuffle(items);
    for (let i = 0; i < Math.min(4, its.length); i++) {
      const ok = its[i];
      list.push({ c: { id: null, q: `Was gehört zu den ${label}?`, a: ok, source: '' }, opts: shuffle([ok, ...sample(pool, 3)]) });
    }
    for (let i = 0; i < 3; i++) {
      const odd = sample(pool, 1)[0];
      list.push({ c: { id: null, q: `Was gehört NICHT zu den ${label}?`, a: odd, source: '' }, opts: shuffle([odd, ...sample(items, 3)]) });
    }
    for (let i = 0; i < 4; i++) {
      const truth = Math.random() < 0.5;
      const x = truth ? its[(i + 4) % its.length] : sample(pool, 1)[0];
      list.push({ c: { id: null, q: `„${x}“ gehört zu den ${label}.`, a: truth ? 'wahr' : `falsch – „${x}“ gehört nicht dazu`, source: '' }, tf: { truth, text: `„${x}“ gehört zu den ${label}.` } });
    }
    const m = multiTask(base, ctx);
    if (m) list.push({ c: base, multi: m });
    // Textstellen, in denen die Punkte vorkommen
    for (const c of shuffle(cards.filter((c) => isCloze(c) && items.some((it) => overlaps(it, c.a)))).slice(0, 3)) list.push({ c });
    return shuffle(list);
  }
  if (key === 'zeit') return sample(cards.filter((c) => c.type === 'zeit'), 12).map((c) => ({ c }));
  if (key.startsWith('doc:')) {
    const id = key.slice(4);
    for (const c of shuffle(cards.filter((c) => c.docId === id))) {
      if (list.length >= 15) break;
      const multi = (c.need || c.a.length > 110) ? multiTask(c, ctx) : null;
      if (multi) list.push({ c, multi });
      else if (c.a.length <= 160) list.push({ c: c.type === 'begriff' ? { ...c, q: askTerm(c) } : c });
    }
    return list;
  }
  return list;
}

function thema(ctx, key) {
  const list = topicQuestions(key, ctx);
  const tp = topicsOf(ctx.cards, ctx.t ? S.docsOf(ctx.t.id) : []).find((x) => x.key === key);
  ctx.info = { ...ctx.info, title: tp ? `Abfrage: ${tp.label}` : 'Abfrage' };
  runChoice(ctx, list);
}

// ---------- Lückentext (Wort anklicken) ----------
function cloze(ctx) {
  runChoice(ctx, sample(ctx.cards.filter(isCloze), 15).map((c) => ({ c })));
}

// ---------- Zuordnen ----------
function matching(ctx) {
  const pool = shuffle(ctx.cards.filter(shortQA));
  const rounds = [];
  for (let r = 0; r < 3 && pool.length >= 4; r++) rounds.push(pool.splice(0, Math.min(5, pool.length)));
  let ri = 0, right = 0, total = 0;
  const wrongs = [];
  const showRound = () => {
    if (ri >= rounds.length) return finish(ctx, right, total, reviewList(wrongs, ctx));
    const set = rounds[ri];
    const left = shuffle(set), rightCol = shuffle(set);
    const misses = new Set();
    const stage = frame(ctx, ri, rounds.length, `
      <p class="muted" style="margin-bottom:14px">Erst links eine Frage oder einen Begriff wählen, dann rechts die passende Erklärung.</p>
      <div class="match">
        <div class="col">${left.map((c) => `<button class="tile" data-l="${c.id}">${h(c.q)}</button>`).join('')}</div>
        <div class="col">${rightCol.map((c) => `<button class="tile" data-r="${c.id}">${h(c.a)}</button>`).join('')}</div>
      </div>
      <div id="fb" style="margin-top:16px"></div>`);
    let sel = null, done = 0;
    const colors = ['gruen', 'gelb', 'blau', 'pink', 'orange'];
    $$('[data-l]', stage).forEach((b) => b.onclick = () => { $$('[data-l]', stage).forEach((x) => x.classList.remove('sel')); sel = b.dataset.l; b.classList.add('sel'); });
    $$('[data-r]', stage).forEach((b) => b.onclick = () => {
      if (!sel) { toast('Wähle zuerst links einen Begriff'); return; }
      const lb = $(`[data-l="${sel}"]`, stage);
      if (b.dataset.r === sel) {
        const col = `var(--m-${colors[done % 5]})`;
        [lb, b].forEach((x) => { x.classList.remove('sel'); x.classList.add('done'); x.disabled = true; x.style.setProperty('--c', col); });
        if (!misses.has(sel)) right++;
        total++;
        S.grade(sel, !misses.has(sel));
        sel = null; done++;
        $('#fb', stage).innerHTML = '';
        if (done === set.length) setTimeout(() => { ri++; showRound(); }, 650);
      } else {
        const c = set.find((x) => x.id === sel);
        if (!misses.has(sel)) wrongs.push({ c, fix: { given: b.textContent } });
        misses.add(sel);
        $('#fb', stage).innerHTML = `<div class="feedback no"><b>Passt nicht – zu „${h(c.q)}“ gehört:</b>${fixHtml(c, ctx, { given: b.textContent })}</div>`;
        b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400);
      }
    });
    onKey(() => {});
  };
  showRound();
}

// ---------- Antwort schreiben ----------
function writing(ctx) {
  const open = ctx.cards.filter((c) => !isCloze(c));
  const list = [...shuffle(open.filter((c) => c.star)), ...sample(open.filter((c) => !c.star), 10)].slice(0, Math.max(10, open.filter((c) => c.star).length));
  let i = 0, right = 0;
  const wrongs = [];
  const show = () => {
    if (i >= list.length) return finish(ctx, right, list.length, reviewList(wrongs, ctx));
    const c = list[i];
    const stage = frame(ctx, i, list.length, `
      <form class="sheet question" id="f">
        <div class="qtext">${h(c.q)}</div>
        <label class="field">Deine Antwort<textarea id="inp" rows="4" placeholder="${c.need ? `${c.need} Punkte nennen, mit Komma getrennt …` : 'In eigenen Worten …'}"></textarea></label>
        <div class="row end"><button class="btn primary" id="go">Lösung zeigen</button></div>
        <div id="fb"></div>
      </form>`);
    const inp = $('#inp', stage);
    inp.focus();
    $('#f', stage).onsubmit = (e) => {
      e.preventDefault();
      const given = inp.value.trim();
      const sim = given ? score(given, c) : 0;
      const ls = c.need && given ? listScore(given, c.a, c.need) : null;
      const verdict = ls ? `${Math.min(ls.found, ls.need)} von ${ls.need} geforderten Punkten erkannt.` : sim >= 0.75 ? 'Sieht richtig aus.' : sim >= 0.45 ? 'Teilweise passend.' : given ? 'Weicht deutlich ab.' : '';
      inp.readOnly = true;
      $('#go', stage).hidden = true;
      $('#fb', stage).innerHTML = `
        <div class="feedback ${sim >= 0.75 ? 'ok' : 'no'}"><span class="small muted">Musterlösung</span><div style="font-size:1.08rem;margin-top:4px">${h(c.a)}</div>${verdict ? `<div class="src">Vergleich: ${verdict}${ls ? '' : ` (${Math.round(sim * 100)} % Übereinstimmung)`}</div>` : ''}</div>
        <p class="small muted" style="margin:14px 0 8px">Wie gut war deine Antwort?</p>
        <div class="answer-row"><button type="button" class="btn dont" data-r="0">Falsch / unvollständig</button><button type="button" class="btn know" data-r="1">Richtig</button></div>`;
      $$('[data-r]', stage).forEach((b) => b.onclick = () => { const ok = b.dataset.r === '1'; if (ok) right++; else wrongs.push({ c, fix: { given } }); S.grade(c.id, ok); i++; show(); });
    };
    onKey(() => {});
  };
  show();
}

// ---------- Probetest ----------
// Lösung direkt nach jeder Aufgabe zeigen (Standard an, zum Lernen); aus = wie in einer echten Arbeit
const sofortPref = {
  get() { try { return localStorage.getItem('lernapp.sofort') !== '0'; } catch { return true; } },
  set(v) { try { localStorage.setItem('lernapp.sofort', v ? '1' : '0'); } catch {} },
};
const leer = (g) => g === null || g === '' || (g instanceof Set && !g.size);
const examScore = (tk) => tk.kind === 'mc' ? (tk.given !== null && tk.opts[tk.given] === tk.c.a ? tk.pts : 0)
  : tk.kind === 'tf' ? (tk.given === tk.truth ? tk.pts : 0)
  : Math.round(tk.pts * multiScore(tk.multi, tk.given) * 2) / 2;
const examGiven = (tk) => {
  if (leer(tk.given)) return '– (leer)';
  if (tk.kind === 'multi') return [...tk.given].map((k) => tk.multi.options[k].t).join(' · ');
  if (tk.kind === 'mc') return tk.opts[tk.given];
  if (tk.kind === 'tf') return tk.given ? 'wahr' : 'falsch';
  return tk.given;
};

function exam(ctx) {
  const max = ctx.cards.length;
  ctx.main.innerHTML = `
    <div class="session">
      <div class="session-top" style="grid-template-columns:auto 1fr"><a class="btn small ghost" href="${ctx.back}">Zurück</a><span></span></div>
      <div class="sheet pad stack">
        <span class="small muted">${h(ctx.title)}</span>
        <h1>Probetest</h1>
        <p>Gemischte Aufgaben zum Anklicken: eine richtige Antwort, mehrere ankreuzen, wahr oder falsch. Kein Tippen. Bewertet wird nach dem IHK-Notenschlüssel.</p>
        <form id="cfg" class="stack">
          <div class="field"><span style="font:600 .92rem var(--font-ui)">Anzahl Aufgaben</span>
            <div class="row" role="radiogroup">${[10, 15, 20, 30].filter((n) => n <= Math.max(max, 10)).map((n, k) => `<label class="chip"><input type="radio" name="n" value="${n}" ${k === 0 ? 'checked' : ''} style="margin-right:6px">${Math.min(n, max)}</label>`).join('')}</div></div>
          <label class="row"><input type="checkbox" name="sofort" ${sofortPref.get() ? 'checked' : ''}> Lösung nach jeder Aufgabe sofort zeigen</label>
          <label class="row"><input type="checkbox" name="timer" checked> Zeit stoppen</label>
          <div class="row"><button class="btn primary">Probetest starten</button></div>
        </form>
      </div>
    </div>`;
  $('#cfg').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    sofortPref.set(!!fd.get('sofort'));
    runExam(ctx, Math.min(+fd.get('n'), max), !!fd.get('timer'), !!fd.get('sofort'));
  };
}

function runExam(ctx, n, timer, sofort) {
  const order = [...shuffle(ctx.cards.filter((c) => c.star)), ...shuffle(ctx.cards.filter((c) => !c.star))];
  const tasks = [];
  for (const c of order) {
    if (tasks.length >= n) break;
    const r = tasks.length / n;
    let task = null;
    if (!isCloze(c) && (c.need || c.star || c.a.length > 110 || listItems(c.a).length)) {
      const m = multiTask(c, ctx);
      if (m) task = { c, kind: 'multi', pts: 3, multi: m, given: new Set() };
    }
    if (!task && c.a.length > 160) continue;
    if (!task) {
      const kind = !isCloze(c) && r >= 0.6 ? 'tf' : 'mc';
      task = { c, kind, pts: kind === 'mc' ? 2 : 1, given: null };
      if (kind === 'mc') task.opts = shuffle([c.a, ...distractors(c, ctx)]);
      else { task.truth = Math.random() < 0.5; task.shown = task.truth ? c.a : (distractors(c, ctx, 1)[0] || c.a); if (task.shown === c.a) task.truth = true; }
    }
    tasks.push(task);
  }
  shuffle(tasks);
  const start = Date.now();
  let i = 0, tick;
  const show = () => {
    clearInterval(tick);
    if (i >= tasks.length) return gradeExam(ctx, tasks, Date.now() - start);
    const tk = tasks[i], c = tk.c;
    const label = { mc: 'Kreuze die richtige Antwort an', tf: 'Wahr oder falsch?', multi: 'Kreuze alle richtigen an' }[tk.kind];
    const done = sofort && tk.done;
    let body = '';
    if (tk.kind === 'mc') body = `<div class="opts">${tk.opts.map((o, k) => `<button type="button" class="opt ${done ? (o === c.a ? 'right' : k === tk.given ? 'wrong' : '') : ''}" data-o="${k}" ${done ? 'disabled' : ''}><span class="key">${'ABCD'[k]}</span><span>${h(o)}</span></button>`).join('')}</div>`;
    if (tk.kind === 'tf') body = `<div class="tf"><button type="button" class="btn know" data-v="1" ${done ? 'disabled' : ''}>Wahr</button><button type="button" class="btn dont" data-v="0" ${done ? 'disabled' : ''}>Falsch</button></div>`;
    if (tk.kind === 'multi') body = `<div id="mbox">${multiHtml(tk.multi, tk.given, done)}</div>${sofort && !done ? '<div class="row end"><button type="button" class="btn" id="check">Prüfen</button></div>' : ''}`;
    if (done) {
      const sc = examScore(tk);
      body += sc === tk.pts
        ? `<div class="feedback ok"><b>Richtig! ${tk.pts} von ${tk.pts} ${tk.pts === 1 ? 'Punkt' : 'Punkten'}</b>${tk.kind === 'multi' ? '' : sourceHtml(c)}</div>`
        : `<div class="feedback no"><b>${sc ? `Teilweise richtig – ${sc.toLocaleString('de-DE')} von ${tk.pts} Punkten` : 'Nicht ganz – so ist es richtig:'}</b>${fixHtml(c, ctx, examFix(tk, examGiven(tk)))}</div>`;
    }
    const q = tk.kind === 'tf'
      ? (isCloze(c) ? h(c.q).replace('_____', `<u>${h(tk.shown)}</u>`) : `${h(c.q)}<div style="margin-top:10px;font-weight:400">→ ${h(tk.shown)}</div>`)
      : questionHtml(c);
    const stage = frame(ctx, i, tasks.length, `
      <form class="sheet question" id="f">
        <div class="row" style="justify-content:space-between"><span class="small muted">Aufgabe ${i + 1} · ${label}</span><span class="small muted">${tk.pts} ${tk.pts === 1 ? 'Punkt' : 'Punkte'}${timer ? ` · <span id="clock"></span>` : ''}</span></div>
        <div class="qtext">${q}</div>
        ${body}
        <div class="row end">${i > 0 ? '<button type="button" class="btn ghost" id="prev">Zurück</button>' : ''}<button class="btn primary">${i === tasks.length - 1 ? 'Abgeben' : 'Weiter'}</button></div>
      </form>`);
    if (timer) {
      const clock = $('#clock', stage);
      const upd = () => { const s = Math.floor((Date.now() - start) / 1000); clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
      upd(); tick = setInterval(upd, 1000);
    }
    const inp = $('#inp', stage);
    if (inp) { inp.value = tk.given ?? ''; inp.focus(); }
    // im Sofort-Modus ist jede Antwort endgültig, danach kommt gleich die Lösung
    const solve = () => { if (sofort) { tk.done = true; show(); } };
    $$('[data-o]', stage).forEach((b) => {
      if (tk.given === +b.dataset.o && !done) b.classList.add('sel'), b.style.borderColor = 'var(--blue)';
      b.onclick = () => { tk.given = +b.dataset.o; $$('[data-o]', stage).forEach((x) => x.style.borderColor = ''); b.style.borderColor = 'var(--blue)'; solve(); };
    });
    $$('[data-v]', stage).forEach((b) => {
      if (tk.given === (b.dataset.v === '1')) b.style.outline = `3px solid var(--${done ? (tk.given === tk.truth ? 'ok' : 'bad') : 'blue'})`;
      b.onclick = () => { tk.given = b.dataset.v === '1'; $$('[data-v]', stage).forEach((x) => x.style.outline = ''); b.style.outline = '3px solid var(--blue)'; solve(); };
    });
    const bindMulti = () => $$('[data-m]', stage).forEach((b) => b.onclick = () => {
      const k = +b.dataset.m; if (tk.given.has(k)) tk.given.delete(k); else tk.given.add(k);
      $('#mbox', stage).innerHTML = multiHtml(tk.multi, tk.given); bindMulti();
    });
    if (tk.kind === 'multi' && !done) bindMulti();
    $('#check', stage)?.addEventListener('click', solve);
    const save = () => { if (inp) tk.given = inp.value.trim(); };
    $('#prev', stage)?.addEventListener('click', () => { save(); i--; show(); });
    $('#f', stage).onsubmit = (e) => {
      e.preventDefault(); save();
      if (i === tasks.length - 1) {
        const open = tasks.filter((t) => t.given === null || t.given === '' || (t.given instanceof Set && !t.given.size)).length;
        const btn = $('#f button.primary', stage);
        // Rückfrage direkt im Knopf (Browser-Dialoge sind auf manchen Handys gesperrt)
        if (open && !btn.dataset.sure) {
          btn.dataset.sure = '1';
          btn.textContent = `${plural(open, 'Aufgabe ist', 'Aufgaben sind')} leer – trotzdem abgeben`;
          return;
        }
      }
      i++; show();
    };
    onKey(() => {});
  };
  show();
}

function gradeExam(ctx, tasks, ms) {
  let points = 0, max = 0;
  for (const tk of tasks) {
    max += tk.pts;
    tk.score = examScore(tk);
    points += tk.score;
    S.grade(tk.c.id, tk.score === tk.pts, false);
  }
  const pct = Math.round(points / max * 100);
  const g = gradeFor(pct);
  const num = (x) => x.toLocaleString('de-DE');
  if (ctx.t) S.addResult({ testId: ctx.t.id, points, max, grade: g.note, gradeText: g.text, mode: 'probetest', ms });
  else S.save();
  const min = Math.round(ms / 60000);
  const givenText = examGiven;
  ctx.main.innerHTML = `
    <div class="session">
      <div class="sheet result">
        <span class="small muted">${h(ctx.title)} · Probetest</span>
        <div class="grade" aria-label="Note ${g.note}">${g.note}</div>
        <h2>${g.text} – ${num(points)} von ${max} Punkten (${pct} %)</h2>
        <p class="muted">${plural(tasks.length, 'Aufgabe', 'Aufgaben')}${min ? ` in ${min} Min.` : ''}. Beim Ankreuzen gibt es Teilpunkte, falsche Kreuze ziehen ab.</p>
        <div class="review">
          ${tasks.map((tk, k) => `<div class="item ${tk.score === tk.pts ? 'ok' : ''}">
            <div class="row" style="justify-content:space-between"><span class="small muted">Aufgabe ${k + 1}</span><b class="small">${num(tk.score)} / ${tk.pts}</b></div>
            <div style="font-weight:700;margin:4px 0">${tk.kind === 'tf' && isCloze(tk.c) ? h(tk.c.q).replace('_____', `<u>${h(tk.shown)}</u>`) : tk.kind === 'tf' ? `${h(tk.c.q)} → ${h(tk.shown)}` : questionHtml(tk.c)}</div>
            ${tk.score === tk.pts ? `<div class="small">Deine Antwort: ${h(givenText(tk))}</div>` : fixHtml(tk.c, ctx, examFix(tk, givenText(tk)))}
          </div>`).join('')}
        </div>
        <div class="row" style="justify-content:center">
          <button class="btn primary" id="again">Neuer Probetest</button>
          <a class="btn" href="${ctx.back}">Zurück</a>
        </div>
      </div>
    </div>`;
  $('#again').onclick = () => exam(ctx);
  window.scrollTo(0, 0);
}

// ---------- Klassenarbeit: wie vom Lehrer, bei jedem Start neue Variante ----------
// Teil A Ankreuzen/Richtig-Falsch, Teil B Begriffe, Teil C Fälle und offene Fragen; offene Antworten selbst korrigieren
function klassenarbeit(ctx) {
  const subj = ctx.t ? S.subject(ctx.t.subjectId)?.name || '' : '';
  const en = /englisch/i.test(subj);
  const used = new Set();
  const take = (list, n) => { const out = []; for (const c of list) { if (out.length >= n) break; if (!used.has(c.id)) { used.add(c.id); out.push(c); } } return out; };
  const pri = (l) => [...shuffle(l.filter((c) => c.star)), ...shuffle(l.filter((c) => !c.star))];
  const open = ctx.cards.filter((c) => c.type === 'frage' && !isCloze(c) && c.a.length >= 20);
  const fall = (c) => /^(Fall|Situation|Case)\b/i.test(c.q) || c.q.length > 70;
  const partC = take([...pri(open.filter(fall)), ...pri(open.filter((c) => !fall(c)))], 3)
    .map((c) => ({ c, kind: 'open', pts: Math.min(6, c.need || Math.max(2, Math.round(c.a.length / 45))) }));
  const partB = take(pri(ctx.cards.filter((c) => ['begriff', 'definition', 'abkuerzung'].includes(c.type) && c.a.length <= 220)), 4)
    .map((c) => ({ c, kind: 'open', pts: en ? 1 : 2, prompt: c.type !== 'begriff' ? c.q : en ? `Translate into German: „${c.q}“` : `Erläutern Sie den Begriff „${c.q}“.` }));
  const short = pri(ctx.cards.filter((c) => c.a.length <= 160));
  const partA = [];
  for (const c of take(short, 5)) { const d = distractors(c, ctx); if (d.length >= 2) partA.push({ c, kind: 'mc', pts: 1, opts: shuffle([c.a, ...d]), prompt: c.type === 'begriff' ? (en ? `What does „${c.q}“ mean?` : askTerm(c)) : '' }); }
  for (const c of take(short.filter((x) => x.a.length <= 140), 4)) {
    const truth = Math.random() < 0.5; const shown = truth ? c.a : (distractors(c, ctx, 1)[0] || c.a);
    partA.push({ c, kind: 'tf', pts: 1, truth: truth || shown === c.a, shown });
  }
  const parts = [
    { title: en ? 'Part A – Multiple choice / true or false' : 'Teil A – Ankreuzen und Richtig/Falsch', tasks: partA },
    { title: en ? 'Part B – Vocabulary and terms' : 'Teil B – Fachbegriffe', tasks: partB },
    { title: en ? 'Part C – Questions and cases' : 'Teil C – Fälle und offene Fragen', tasks: partC },
  ].filter((p) => p.tasks.length);
  const tasks = parts.flatMap((p) => p.tasks);
  if (tasks.length < 4) { toast('Zu wenig Material für eine Klassenarbeit'); location.hash = ctx.back; return; }
  const max = tasks.reduce((s, t) => s + t.pts, 0);
  const min = Math.max(20, Math.min(90, Math.round(max * 1.6 / 5) * 5));
  const variante = Math.random().toString(36).slice(2, 5).toUpperCase();
  let n = 0;
  const taskHtml = (tk) => {
    const k = n++;
    const q = tk.kind === 'tf' ? (isCloze(tk.c) ? h(tk.c.q).replace('_____', `<u>${h(tk.shown)}</u>`) : `${h(tk.c.q)}<div class="ka-stmt">→ ${h(tk.shown)}</div>`) : tk.prompt ? h(tk.prompt) : questionHtml(tk.c);
    const body = tk.kind === 'mc' ? `<div class="ka-opts">${tk.opts.map((o, j) => `<label class="ka-opt"><input type="radio" name="t${k}" value="${j}"><span class="key">${'abcd'[j]})</span><span>${h(o)}</span></label>`).join('')}</div>`
      : tk.kind === 'tf' ? `<div class="ka-opts row"><label class="ka-opt"><input type="radio" name="t${k}" value="1"><span>${en ? 'true' : 'richtig'}</span></label><label class="ka-opt"><input type="radio" name="t${k}" value="0"><span>${en ? 'false' : 'falsch'}</span></label></div>`
      : `<textarea name="t${k}" rows="${tk.pts > 2 ? 6 : 3}" placeholder="${tk.c.need ? `${tk.c.need} Punkte nennen …` : 'Antwort …'}"></textarea><div class="row end ka-solbtn"><button type="button" class="btn small" data-sol="${k}">Lösung zeigen</button></div>`;
    tk.k = k;
    return `<div class="ka-task"><div class="ka-head"><b>${k + 1}.</b><span class="ka-q">${q}</span><span class="ka-pts">${tk.pts} P.</span></div>${body}<div class="ka-sol" id="sol${k}"></div></div>`;
  };
  // Sofort-Lösung: Ankreuzen wird direkt bewertet und gesperrt, offene Aufgaben per Knopf
  const solution = (tk, g) => {
    if (tk.kind === 'open') return `<div class="feedback ok"><b>Musterlösung</b><div class="fix-right">${h(tk.c.a)}</div>${sourceHtml(tk.c)}</div>`;
    const ok = tk.kind === 'mc' ? tk.opts[+g] === tk.c.a : (g === '1') === tk.truth;
    if (ok) return `<div class="feedback ok"><b>Richtig!</b>${sourceHtml(tk.c)}</div>`;
    const fix = tk.kind === 'mc' ? { given: tk.opts[+g] } : tk.truth ? { right: tk.shown, note: 'Die Aussage ist richtig.' } : { given: tk.shown, note: 'Die Aussage ist falsch.' };
    return `<div class="feedback no"><b>Nicht ganz – so ist es richtig:</b>${fixHtml(tk.c, ctx, { ...fix, link: true })}</div>`;
  };
  ctx.main.innerHTML = `
    <div class="session">
      <div class="session-top" style="grid-template-columns:auto 1fr"><a class="btn small ghost" href="${ctx.back}">Abbrechen</a><span></span></div>
      <form class="sheet pad ka" id="ka">
        <header class="ka-top">
          <div><span class="small muted">VF11 · 2. Ausbildungsjahr · ${h(subj)}</span><h1>${en ? 'Class test' : 'Klassenarbeit'}: ${h(ctx.title)}</h1></div>
          <div class="ka-meta"><span>Variante ${variante}</span><span>${max} Punkte</span><span>${min} Minuten</span></div>
        </header>
        <div class="ka-name"><span>Name: ______________________</span><span>Datum: ${new Date().toLocaleDateString('de-DE')}</span></div>
        <label class="row ka-switch"><input type="checkbox" id="sofort" ${sofortPref.get() ? 'checked' : ''}> Lösung sofort nach jeder Aufgabe zeigen (zum Lernen)</label>
        ${parts.map((p) => `<section class="ka-part"><h2>${p.title}</h2>${p.tasks.map(taskHtml).join('')}</section>`).join('')}
        <div class="row end"><button type="button" class="btn ghost" id="neu">Neue Variante</button><button class="btn primary">Abgeben und korrigieren</button></div>
      </form>
    </div>`;
  window.scrollTo(0, 0);
  const start = Date.now();
  $('#neu').onclick = () => klassenarbeit(ctx);
  const form = $('#ka');
  const sofort = () => $('#sofort').checked;
  form.classList.toggle('sofort', sofort());
  $('#sofort').onchange = () => { sofortPref.set(sofort()); form.classList.toggle('sofort', sofort()); };
  for (const tk of tasks) {
    if (tk.kind === 'open') continue;
    $$(`input[name="t${tk.k}"]`, form).forEach((r) => r.addEventListener('change', () => {
      if (!sofort()) return;
      // Antwort sperren; gesperrte Felder schickt das Formular nicht mit, daher merken
      $$(`input[name="t${tk.k}"]`, form).forEach((x) => {
        x.disabled = true;
        const right = tk.kind === 'mc' ? tk.opts[+x.value] === tk.c.a : (x.value === '1') === tk.truth;
        x.parentElement.classList.add(right ? 'right' : x === r ? 'wrong' : 'off');
      });
      tk.locked = r.value;
      $(`#sol${tk.k}`).innerHTML = solution(tk, r.value);
    }));
  }
  $$('[data-sol]', form).forEach((b) => b.onclick = () => {
    const tk = tasks.find((t) => t.k === +b.dataset.sol);
    $(`#sol${tk.k}`).innerHTML = solution(tk);
    b.remove();
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    for (const tk of tasks) tk.given = tk.locked ?? fd.get(`t${tk.k}`) ?? '';
    korrektur(ctx, { parts, tasks, max, en, subj, ms: Date.now() - start });
  };
}

function korrektur(ctx, { parts, tasks, max, en, ms }) {
  for (const tk of tasks) {
    const g = String(tk.given).trim();
    if (tk.kind === 'mc') tk.score = g !== '' && tk.opts[+g] === tk.c.a ? tk.pts : 0;
    else if (tk.kind === 'tf') tk.score = g !== '' && (g === '1') === tk.truth ? tk.pts : 0;
    else {
      const sim = g ? score(g, tk.c) : 0;
      tk.score = Math.round(tk.pts * Math.min(1, sim / 0.75) * 2) / 2;
    }
  }
  const num = (x) => x.toLocaleString('de-DE');
  const fixFor = (tk) => {
    const g = String(tk.given).trim();
    if (tk.kind === 'mc') return { given: g === '' ? '– (leer)' : tk.opts[+g], link: true };
    if (tk.kind === 'tf') return tk.truth ? { right: tk.shown, note: 'Die Aussage ist richtig.', link: true } : { given: tk.shown, note: 'Die Aussage ist falsch.', link: true };
    return { link: true };
  };
  const total = () => tasks.reduce((s, t) => s + t.score, 0);
  const sum = () => { const p = total(); const pct = Math.round(p / max * 100); const g = gradeFor(pct); return { p, pct, g }; };
  const head = () => { const { p, pct, g } = sum(); return `<div class="grade" aria-label="Note ${g.note}">${g.note}</div><h2>${g.text} – ${num(p)} von ${max} Punkten (${pct} %)</h2>`; };
  ctx.main.innerHTML = `
    <div class="session">
      <div class="sheet result">
        <span class="small muted">${h(ctx.title)} · Klassenarbeit</span>
        <div id="ka-sum">${head()}</div>
        <p class="muted">Ankreuzaufgaben sind automatisch bewertet. Bei offenen Aufgaben ist die Punktzahl geschätzt – vergleiche mit der Musterlösung und stell die Punkte selbst ein.</p>
        <div class="review">${parts.map((p) => `<h3>${p.title}</h3>${p.tasks.map((tk) => {
          const full = tk.score === tk.pts;
          const q = tk.kind === 'tf' ? `${h(tk.c.q)} → ${h(tk.shown)}` : tk.prompt ? h(tk.prompt) : questionHtml(tk.c);
          const pts = tk.kind === 'open'
            ? `<select class="ka-sel" data-k="${tk.k}" aria-label="Punkte für Aufgabe ${tk.k + 1}">${Array.from({ length: tk.pts * 2 + 1 }, (_, j) => j / 2).map((v) => `<option value="${v}" ${v === tk.score ? 'selected' : ''}>${num(v)}</option>`).join('')}</select> / ${tk.pts}`
            : `${num(tk.score)} / ${tk.pts}`;
          const body = tk.kind === 'open'
            ? `<div class="fix"><div class="fix-row"><span class="fix-label">Deine Antwort</span><span>${h(String(tk.given).trim() || '– (leer)')}</span></div><div class="fix-row ok"><span class="fix-label">Musterlösung</span><span class="fix-right">${h(tk.c.a)}</span></div>${sourceHtml(tk.c)}</div>`
            : full ? '' : fixHtml(tk.c, ctx, fixFor(tk));
          return `<div class="item ${full ? 'ok' : ''}" data-item="${tk.k}"><div class="row" style="justify-content:space-between"><span class="small muted">Aufgabe ${tk.k + 1}</span><b class="small">${pts}</b></div><div style="font-weight:700;margin:4px 0">${q}</div>${body}</div>`;
        }).join('')}`).join('')}</div>
        <div class="row" style="justify-content:center">
          <button class="btn primary" id="save">Ergebnis speichern</button>
          <button class="btn" id="again">Neue Klassenarbeit</button>
          <a class="btn" href="${ctx.back}">Zurück</a>
        </div>
      </div>
    </div>`;
  window.scrollTo(0, 0);
  $$('.ka-sel').forEach((s) => s.onchange = () => {
    const tk = tasks.find((t) => t.k === +s.dataset.k); tk.score = +s.value;
    $(`[data-item="${tk.k}"]`).classList.toggle('ok', tk.score === tk.pts);
    $('#ka-sum').innerHTML = head();
  });
  $('#save').onclick = () => {
    for (const tk of tasks) S.grade(tk.c.id, tk.score === tk.pts, false);
    const { p, g } = sum();
    if (ctx.t) S.addResult({ testId: ctx.t.id, points: p, max, grade: g.note, gradeText: `${g.text} · Klassenarbeit`, mode: 'klassenarbeit', ms });
    else S.save();
    $('#save').disabled = true; $('#save').textContent = 'Gespeichert';
    toast(`Klassenarbeit gespeichert: Note ${g.note}`);
  };
  $('#again').onclick = () => klassenarbeit(ctx);
}

// Berichtigung im Probetest je Aufgabenart
function examFix(tk, given) {
  const leer = given === '– (leer)';
  if (tk.kind === 'multi') {
    const bad = leer ? [] : [...tk.given].filter((k) => !tk.multi.options[k].ok).map((k) => tk.multi.options[k].t);
    return { given: leer ? given : bad.join(' · '), right: tk.multi.options.filter((o) => o.ok).map((o) => o.t).join(' · '), full: true, link: true };
  }
  if (tk.kind === 'tf') {
    if (tk.truth) return { given: leer ? given : '', right: tk.shown, note: leer ? 'Die Aussage stimmt.' : 'Die Aussage stimmt – du hast „falsch“ gewählt.', link: true };
    return { given: leer ? given : tk.shown, note: 'Die Aussage ist falsch.', link: true };
  }
  return { given, link: true };
}

function reviewList(wrongs, ctx) {
  if (!wrongs.length) return '';
  return `<div class="review"><h3 style="margin-bottom:4px">Berichtigung – das solltest du dir nochmal ansehen</h3>${wrongs.map(({ c, fix }) => `
    <div class="item"><div style="font-weight:700">${questionHtml(c)}</div>${fixHtml(c, ctx, { ...fix, link: true })}</div>`).join('')}</div>`;
}
