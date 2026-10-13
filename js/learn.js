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
  { key: 'quiz', title: 'Quiz', icon: 'quiz', color: 'blau', text: 'Multiple Choice: eine von vier Antworten ist richtig.', count: (c) => `${Math.min(12, c.length)} Fragen`, missing: 'Braucht mindestens 4 Karten' },
  { key: 'wahrfalsch', title: 'Wahr oder falsch', icon: 'tf', color: 'pink', text: 'Schnelle Runde: Stimmt die Aussage oder nicht?', count: () => '12 Aussagen', missing: 'Braucht mindestens 4 Karten' },
  { key: 'lueckentext', title: 'Lückentext', icon: 'gap', color: 'orange', text: 'Das fehlende Wort selbst eintippen – wie in der Klassenarbeit.', count: (c) => plural(c.filter(isCloze).length, 'Lücke', 'Lücken'), missing: 'Keine Lückentext-Karten vorhanden' },
  { key: 'zuordnen', title: 'Zuordnen', icon: 'match', color: 'lila', text: 'Begriffe und Erklärungen paarweise verbinden.', count: (c) => `${Math.min(3, Math.floor(c.filter(shortQA).length / 4))} Runden`, missing: 'Braucht mindestens 4 Begriff-Karten' },
  { key: 'schreiben', title: 'Antwort schreiben', icon: 'write', color: 'gelb', text: 'Frage lesen, Antwort frei formulieren, mit der Lösung vergleichen.', count: (c) => plural(c.filter((x) => !isCloze(x)).length, 'Frage', 'Fragen'), missing: 'Keine Frage-Karten vorhanden' },
  { key: 'probetest', title: 'Probetest', icon: 'exam', color: 'blau', text: 'Gemischte Aufgaben wie in einer echten Arbeit – mit Punkten und Note nach IHK-Schlüssel.', count: () => 'Ergebnis mit Note', missing: 'Braucht mindestens 6 Karten' },
];

export function modeAvailable(key, cards) {
  if (key === 'karteikarten' || key === 'wiederholen') return cards.length > 0;
  if (key === 'quiz' || key === 'wahrfalsch') return cards.length >= 4;
  if (key === 'lueckentext') return cards.some(isCloze);
  if (key === 'zuordnen') return cards.filter(shortQA).length >= 4;
  if (key === 'schreiben') return cards.some((c) => !isCloze(c));
  if (key === 'probetest') return cards.length >= 6;
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
export function startSession(main, testId, mode) {
  const all = testId === 'alle';
  const t = all ? null : S.test(testId);
  if (!all && !t) { location.hash = '#/'; return; }
  const cards = all ? S.get().cards : S.cardsOf(testId);
  const back = all ? '#/' : `#/test/${testId}`;
  const info = MODES.find((m) => m.key === mode);
  if (!info || !modeAvailable(mode, cards)) { location.hash = back; return; }

  const docsText = (all ? S.get().docs : S.docsOf(testId)).map((d) => d.text).join('\n\n');
  const years = [...new Set(docsText.match(/\b(1[0-9]{3}|20[0-9]{2})\b/g) || [])];
  const centuries = [...new Set(docsText.match(/\b\d{1,2}\. Jahrhundert/g) || [])];
  const ctx = { main, t, cards, back, mode, info, kws: keywords(docsText, [], 80), years, centuries, title: all ? 'Alle Fächer' : t.title };

  ({ karteikarten: flashcards, wiederholen: review, quiz, wahrfalsch: trueFalse, lueckentext: cloze, zuordnen: matching, schreiben: writing, probetest: exam })[mode](ctx);
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
  $('[data-again]').onclick = (e) => { e.preventDefault(); startSession(ctx.main, ctx.t ? ctx.t.id : 'alle', ctx.mode); };
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
        <div class="answer-row" id="ans" hidden>
          <button class="btn dont" data-r="0">Nicht gewusst <kbd>1</kbd></button>
          <button class="btn know" data-r="1">Gewusst <kbd>2</kbd></button>
        </div>
      </div>`);
    const flash = $('#flash', stage), ans = $('#ans', stage);
    const flip = () => { flash.classList.toggle('flipped'); ans.hidden = false; };
    flash.onclick = flip;
    const rate = (ok) => {
      S.grade(c.id, ok);
      if (ok) { if (!again.has(c.id)) right++; }
      else if (!again.has(c.id)) { again.add(c.id); queue.push(c); }
      i++; show();
    };
    $$('[data-r]', stage).forEach((b) => b.onclick = () => rate(b.dataset.r === '1'));
    onKey((e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
      else if (!ans.hidden && (e.key === '1' || e.key === 'ArrowLeft')) rate(false);
      else if (!ans.hidden && (e.key === '2' || e.key === 'ArrowRight')) rate(true);
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
function sourceHtml(c) {
  return c.source && !c.source.startsWith('Antwort aus') && c.source !== c.q ? `<div class="src">Aus dem Text: „${h(c.source.length > 260 ? c.source.slice(0, 260) + '…' : c.source)}“</div>` : '';
}

// ---------- Quiz ----------
function quiz(ctx) {
  const list = sample(ctx.cards.filter((c) => c.a.length <= 160), 12);
  let i = 0, right = 0;
  const wrongs = [];
  const show = () => {
    if (i >= list.length) return finish(ctx, right, list.length, reviewList(wrongs));
    const c = list[i];
    const opts = shuffle([c.a, ...distractors(c, ctx)]);
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
      if (ok) right++; else wrongs.push({ c, given: opts[k] });
      S.grade(c.id, ok);
      $$('.opt', stage).forEach((b, j) => { b.disabled = true; if (opts[j] === c.a) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
      $('#fb', stage).innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}"><b>${ok ? 'Richtig!' : 'Leider falsch.'}</b> ${ok ? '' : `Richtig ist: ${h(c.a)}`}${sourceHtml(c)}</div>
        <div class="row end" style="margin-top:14px"><button class="btn primary" id="next">Weiter <kbd>Enter</kbd></button></div>`;
      $('#next').onclick = () => { i++; show(); };
      $('#next').focus();
    };
    $$('.opt', stage).forEach((b) => b.onclick = () => pick(+b.dataset.o));
    onKey((e) => {
      const k = 'abcd'.indexOf(e.key.toLowerCase());
      if (!answered && k >= 0) pick(k);
      else if (!answered && /^[1-4]$/.test(e.key)) pick(+e.key - 1);
    });
  };
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
    if (i >= list.length) return finish(ctx, right, list.length, reviewList(wrongs));
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
      if (ok) right++; else wrongs.push({ c, given: shown });
      S.grade(c.id, ok);
      $$('[data-v]', stage).forEach((b) => b.disabled = true);
      $('#fb', stage).innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}"><b>${ok ? 'Richtig!' : 'Falsch.'}</b> Die Aussage ist ${truth ? 'wahr' : 'falsch'}.${truth ? '' : ` Richtig: ${h(c.a)}`}${sourceHtml(c)}</div>
        <div class="row end" style="margin-top:14px"><button class="btn primary" id="next">Weiter <kbd>Enter</kbd></button></div>`;
      $('#next').onclick = () => { i++; show(); };
      $('#next').focus();
    };
    $$('[data-v]', stage).forEach((b) => b.onclick = () => pick(b.dataset.v === '1'));
    onKey((e) => { const k = e.key.toLowerCase(); if (k === 'w' || k === 'arrowleft') pick(true); else if (k === 'f' || k === 'arrowright') pick(false); });
  };
  show();
}

// ---------- Lückentext ----------
function cloze(ctx) {
  const list = sample(ctx.cards.filter(isCloze), 12);
  let i = 0, right = 0;
  const wrongs = [];
  const show = () => {
    if (i >= list.length) return finish(ctx, right, list.length, reviewList(wrongs));
    const c = list[i];
    const hint = c.a.length > 3 ? `${c.a[0]}${'·'.repeat(Math.min(c.a.length - 1, 14))}` : '';
    const stage = frame(ctx, i, list.length, `
      <form class="sheet question" id="f">
        <div class="qtext">${questionHtml(c)}</div>
        <label class="field">Fehlendes Wort<input type="text" id="inp" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${h(hint)}"></label>
        <div class="row end"><button type="button" class="btn ghost" id="skip">Weiß ich nicht</button><button class="btn primary">Prüfen <kbd>Enter</kbd></button></div>
        <div id="fb"></div>
      </form>`);
    const inp = $('#inp', stage);
    inp.focus();
    let answered = false;
    const check = (given) => {
      if (answered) { i++; return show(); }
      answered = true;
      const sim = similarity(given, c.a);
      const ok = sim >= 0.85;
      const close = !ok && sim >= 0.6;
      if (ok) right++; else wrongs.push({ c, given: given || '–' });
      S.grade(c.id, ok);
      inp.readOnly = true;
      $('#skip', stage).hidden = true;
      $('#fb', stage).innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}"><b>${ok ? (sim < 1 ? 'Richtig (kleiner Tippfehler)!' : 'Richtig!') : close ? 'Knapp daneben.' : 'Nicht ganz.'}</b> Lösung: <b>${h(c.a)}</b></div>
        ${!ok && given ? '<div class="row end" style="margin-top:10px"><button type="button" class="btn small ghost" id="override">Meine Antwort war auch richtig</button></div>' : ''}`;
      $('#override', stage)?.addEventListener('click', () => { right++; wrongs.pop(); S.grade(c.id, true); toast('Als richtig gewertet'); i++; show(); });
      $('button.primary', stage).innerHTML = 'Weiter <kbd>Enter</kbd>';
    };
    $('#f', stage).onsubmit = (e) => { e.preventDefault(); check(inp.value.trim()); };
    $('#skip', stage).onclick = () => check('');
    onKey(() => {});
  };
  show();
}

// ---------- Zuordnen ----------
function matching(ctx) {
  const pool = shuffle(ctx.cards.filter(shortQA));
  const rounds = [];
  for (let r = 0; r < 3 && pool.length >= 4; r++) rounds.push(pool.splice(0, Math.min(5, pool.length)));
  let ri = 0, right = 0, total = 0;
  const showRound = () => {
    if (ri >= rounds.length) return finish(ctx, right, total);
    const set = rounds[ri];
    const left = shuffle(set), rightCol = shuffle(set);
    const misses = new Set();
    const stage = frame(ctx, ri, rounds.length, `
      <p class="muted" style="margin-bottom:14px">Erst links eine Frage oder einen Begriff wählen, dann rechts die passende Erklärung.</p>
      <div class="match">
        <div class="col">${left.map((c) => `<button class="tile" data-l="${c.id}">${h(c.q)}</button>`).join('')}</div>
        <div class="col">${rightCol.map((c) => `<button class="tile" data-r="${c.id}">${h(c.a)}</button>`).join('')}</div>
      </div>`);
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
        if (done === set.length) setTimeout(() => { ri++; showRound(); }, 650);
      } else {
        misses.add(sel);
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
  const show = () => {
    if (i >= list.length) return finish(ctx, right, list.length);
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
      $$('[data-r]', stage).forEach((b) => b.onclick = () => { const ok = b.dataset.r === '1'; if (ok) right++; S.grade(c.id, ok); i++; show(); });
    };
    onKey(() => {});
  };
  show();
}

// ---------- Probetest ----------
function exam(ctx) {
  const max = ctx.cards.length;
  ctx.main.innerHTML = `
    <div class="session">
      <div class="session-top" style="grid-template-columns:auto 1fr"><a class="btn small ghost" href="${ctx.back}">Zurück</a><span></span></div>
      <div class="sheet pad stack">
        <span class="small muted">${h(ctx.title)}</span>
        <h1>Probetest</h1>
        <p>Gemischte Aufgaben: Multiple Choice, Wahr/Falsch, Lückentext und offene Fragen. Du siehst die Lösungen erst am Ende – wie in einer echten Arbeit. Bewertet wird nach dem IHK-Notenschlüssel.</p>
        <form id="cfg" class="stack">
          <div class="field"><span style="font:600 .92rem var(--font-ui)">Anzahl Aufgaben</span>
            <div class="row" role="radiogroup">${[10, 15, 20, 30].filter((n) => n <= Math.max(max, 10)).map((n, k) => `<label class="chip"><input type="radio" name="n" value="${n}" ${k === 0 ? 'checked' : ''} style="margin-right:6px">${Math.min(n, max)}</label>`).join('')}</div></div>
          <label class="row"><input type="checkbox" name="timer" checked> Zeit stoppen</label>
          <div class="row"><button class="btn primary">Probetest starten</button></div>
        </form>
      </div>
    </div>`;
  $('#cfg').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    runExam(ctx, Math.min(+fd.get('n'), max), !!fd.get('timer'));
  };
}

function runExam(ctx, n, timer) {
  const starred = shuffle(ctx.cards.filter((c) => c.star)).slice(0, n);
  const picked = [...starred, ...sample(ctx.cards.filter((c) => !c.star), n - starred.length)];
  const tasks = picked.map((c, k) => {
    const r = k / n;
    let kind;
    if (isCloze(c)) kind = r < 0.35 ? 'mc' : 'gap';
    else if (c.a.length > 110 || c.need || c.star) kind = 'open';
    else kind = r < 0.5 ? 'mc' : r < 0.75 ? 'tf' : 'open';
    const task = { c, kind, pts: { mc: 2, tf: 1, gap: 2, open: 3 }[kind], given: null };
    if (kind === 'mc') task.opts = shuffle([c.a, ...distractors(c, ctx)]);
    if (kind === 'tf') { task.truth = Math.random() < 0.5; task.shown = task.truth ? c.a : (distractors(c, ctx, 1)[0] || c.a); if (task.shown === c.a) task.truth = true; }
    return task;
  });
  shuffle(tasks);
  const start = Date.now();
  let i = 0, tick;
  const show = () => {
    clearInterval(tick);
    if (i >= tasks.length) return gradeExam(ctx, tasks, Date.now() - start);
    const tk = tasks[i], c = tk.c;
    const label = { mc: 'Kreuze die richtige Antwort an', tf: 'Wahr oder falsch?', gap: 'Ergänze die Lücke', open: 'Beantworte die Frage' }[tk.kind];
    let body = '';
    if (tk.kind === 'mc') body = `<div class="opts">${tk.opts.map((o, k) => `<button type="button" class="opt" data-o="${k}"><span class="key">${'ABCD'[k]}</span><span>${h(o)}</span></button>`).join('')}</div>`;
    if (tk.kind === 'tf') body = `<div class="tf"><button type="button" class="btn know" data-v="1">Wahr</button><button type="button" class="btn dont" data-v="0">Falsch</button></div>`;
    if (tk.kind === 'gap') body = `<input type="text" id="inp" autocomplete="off" spellcheck="false" aria-label="Lücke">`;
    if (tk.kind === 'open') body = `<textarea id="inp" rows="4" aria-label="Antwort"></textarea>`;
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
    $$('[data-o]', stage).forEach((b) => {
      if (tk.given === +b.dataset.o) b.classList.add('sel'), b.style.borderColor = 'var(--blue)';
      b.onclick = () => { tk.given = +b.dataset.o; $$('[data-o]', stage).forEach((x) => x.style.borderColor = ''); b.style.borderColor = 'var(--blue)'; };
    });
    $$('[data-v]', stage).forEach((b) => {
      if (tk.given === (b.dataset.v === '1')) b.style.outline = '3px solid var(--blue)';
      b.onclick = () => { tk.given = b.dataset.v === '1'; $$('[data-v]', stage).forEach((x) => x.style.outline = ''); b.style.outline = '3px solid var(--blue)'; };
    });
    const save = () => { if (inp) tk.given = inp.value.trim(); };
    $('#prev', stage)?.addEventListener('click', () => { save(); i--; show(); });
    $('#f', stage).onsubmit = (e) => {
      e.preventDefault(); save();
      if (i === tasks.length - 1) {
        const open = tasks.filter((t) => t.given === null || t.given === '').length;
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
    const c = tk.c;
    if (tk.kind === 'mc') tk.score = tk.given !== null && tk.opts[tk.given] === c.a ? tk.pts : 0;
    if (tk.kind === 'tf') tk.score = tk.given === tk.truth ? tk.pts : 0;
    if (tk.kind === 'gap') tk.score = tk.given && similarity(tk.given, c.a) >= 0.85 ? tk.pts : 0;
    if (tk.kind === 'open') { const s = tk.given ? score(tk.given, c) : 0; tk.score = s >= 0.75 ? 3 : s >= 0.5 ? 2 : s >= 0.3 ? 1 : 0; }
    points += tk.score;
    S.grade(c.id, tk.score === tk.pts, false);
  }
  const pct = Math.round(points / max * 100);
  const g = gradeFor(pct);
  if (ctx.t) S.addResult({ testId: ctx.t.id, points, max, grade: g.note, gradeText: g.text, mode: 'probetest', ms });
  else S.save();
  const min = Math.round(ms / 60000);
  const givenText = (tk) => {
    if (tk.given === null || tk.given === '') return '– (leer)';
    if (tk.kind === 'mc') return tk.opts[tk.given];
    if (tk.kind === 'tf') return tk.given ? 'wahr' : 'falsch';
    return tk.given;
  };
  ctx.main.innerHTML = `
    <div class="session">
      <div class="sheet result">
        <span class="small muted">${h(ctx.title)} · Probetest</span>
        <div class="grade" aria-label="Note ${g.note}">${g.note}</div>
        <h2>${g.text} – ${points} von ${max} Punkten (${pct} %)</h2>
        <p class="muted">${plural(tasks.length, 'Aufgabe', 'Aufgaben')}${min ? ` in ${min} Min.` : ''}. Offene Antworten wurden automatisch verglichen – prüf sie unten selbst nach.</p>
        <div class="review">
          ${tasks.map((tk, k) => `<div class="item ${tk.score === tk.pts ? 'ok' : ''}">
            <div class="row" style="justify-content:space-between"><span class="small muted">Aufgabe ${k + 1}</span><b class="small">${tk.score} / ${tk.pts}</b></div>
            <div style="font-weight:700;margin:4px 0">${tk.kind === 'tf' && isCloze(tk.c) ? h(tk.c.q).replace('_____', `<u>${h(tk.shown)}</u>`) : tk.kind === 'tf' ? `${h(tk.c.q)} → ${h(tk.shown)}` : questionHtml(tk.c)}</div>
            <div class="small">Deine Antwort: ${h(givenText(tk))}</div>
            ${tk.score === tk.pts ? '' : `<div class="small"><b>Richtig:</b> ${tk.kind === 'tf' ? (tk.truth ? 'wahr' : `falsch – richtig ist: ${h(tk.c.a)}`) : h(tk.c.a)}</div>`}
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

function reviewList(wrongs) {
  if (!wrongs.length) return '';
  return `<div class="review"><h3 style="margin-bottom:4px">Das solltest du dir nochmal ansehen</h3>${wrongs.map(({ c, given }) => `
    <div class="item"><div style="font-weight:700">${questionHtml(c)}</div><div class="small">Deine Antwort: ${h(given)}</div><div class="small"><b>Richtig:</b> ${h(c.a)}</div></div>`).join('')}</div>`;
}
