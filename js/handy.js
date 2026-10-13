// Handy-Version: ein Lernset, Tab-Leiste unten, große Knöpfe.
import * as S from './store.js';
import { generate, keywords, keySentences, TYPE_LABEL } from './gen.js';
import { BEISPIEL, KURZARBEIT } from './beispiel.js';
import { startSession, MODES, modeAvailable } from './learn.js';
import { h, $, $$, toast, plural, ICON } from './util.js';

const main = $('#main');
const nav = $('#tabbar');

// ---------- Lernset beim ersten Öffnen anlegen ----------
function ensureSet() {
  const st = S.get();
  let t = st.tests.find((x) => x.title === BEISPIEL.test.title);
  if (t) return t;
  const s = st.subjects.find((x) => x.name === BEISPIEL.subject.name) || S.addSubject(BEISPIEL.subject.name, BEISPIEL.subject.color);
  t = S.addTest(s.id, BEISPIEL.test.title, '', BEISPIEL.test.notes);
  for (const bd of BEISPIEL.docs) {
    const d = S.addDoc(t.id, bd.name, bd.kind, bd.text);
    d.highlights = bd.highlights;
    const gen = generate(d.text, { highlights: d.highlights });
    S.addCards(gen.map((c) => ({ ...c, testId: t.id, docId: d.id, star: bd === KURZARBEIT && c.type === 'frage' })));
  }
  S.save();
  return t;
}
const T = ensureSet();

// ---------- Router ----------
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [view, , mode] = parts;
  window.scrollTo(0, 0);
  if (view === 'lernen') {
    document.body.classList.add('in-session');
    nav.hidden = true;
    return startSession(main, T.id, mode);
  }
  document.body.classList.remove('in-session');
  nav.hidden = false;
  const tab = ['karten', 'text', 'spick'].includes(view) ? view : 'start';
  $$('a', nav).forEach((a) => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
  ({ start: viewStart, karten: viewCards, text: viewText, spick: viewCheat })[tab]();
}
window.addEventListener('hashchange', route);

const stats = () => {
  const cards = S.cardsOf(T.id);
  const sure = cards.filter((c) => S.progressOf(c.id).box >= 3).length;
  const due = cards.filter((c) => S.isDue(c.id)).length;
  return { cards, sure, due, pct: cards.length ? Math.round(sure / cards.length * 100) : 0 };
};

// ---------- Start ----------
function viewStart() {
  const { cards, sure, due, pct } = stats();
  const stars = cards.filter((c) => c.star);
  const last = S.resultsOf(T.id).at(-1);
  const streak = S.streakDays();
  const ring = 2 * Math.PI * 34;
  main.innerHTML = `
    <header class="hero">
      <span class="subject"><span class="mk" data-c="lila">D – Deutsch</span> · Kurzarbeit</span>
      <h1>Eine Frage der Ehre</h1>
      <p class="muted">Der ehrbare Kaufmann – Tugenden, Eigenschaften, Gemeinschaft</p>
      <div class="progress-row">
        <svg class="ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="ring-bg"/><circle cx="40" cy="40" r="34" class="ring-fg" stroke-dasharray="${ring}" stroke-dashoffset="${ring * (1 - pct / 100)}"/><text x="40" y="46" text-anchor="middle">${pct}%</text></svg>
        <div>
          <b>${sure} von ${cards.length} Karten sicher</b>
          <div class="muted small">${due ? `${due} heute dran` : 'Für heute alles wiederholt'}${last ? ` · letzter Probetest: Note ${last.grade}` : ''}</div>
          ${streak ? `<span class="margin-note blue">${streak} ${streak === 1 ? 'Tag' : 'Tage'} am Stück</span>` : ''}
        </div>
      </div>
      <a class="btn primary big" href="#/lernen/${T.id}/wiederholen">${sure ? 'Weiterlernen' : 'Loslernen'}</a>
    </header>

    <section>
      <h2>Kommt in der Kurzarbeit dran</h2>
      <div class="stars">
        ${stars.map((c) => `<details class="sheet star-q"><summary><span class="star-icon" aria-hidden="true">★</span><span>${h(c.q)}</span></summary>
          <div class="star-a">${h(c.a)}</div></details>`).join('')}
      </div>
      <a class="btn wide" href="#/lernen/${T.id}/schreiben">Diese Fragen selbst beantworten</a>
    </section>

    <section>
      <h2>Üben</h2>
      <div class="mode-list">
        ${MODES.filter((m) => m.key !== 'wiederholen').map((m) => {
          const ok = modeAvailable(m.key, cards);
          return `<a class="mode-row ${m.key === 'probetest' ? 'exam' : ''}" href="#/lernen/${T.id}/${m.key}" style="--c:var(--m-${m.color})" ${ok ? '' : 'aria-disabled="true"'}>
            <span class="ico">${ICON[m.icon]}</span>
            <span class="txt"><b>${m.title}</b><span>${m.text}</span></span>
            <span class="chev" aria-hidden="true">›</span></a>`;
        }).join('')}
      </div>
    </section>`;
}

// ---------- Karten ----------
let filter = 'alle', query = '';
function viewCards() {
  const all = S.cardsOf(T.id);
  const list = all.filter((c) => (filter === 'alle' || (filter === 'wichtig' ? c.star : filter === 'eigene' ? ['manuell', 'import'].includes(c.type) : true))
    && (!query || (c.q + ' ' + c.a).toLowerCase().includes(query.toLowerCase())));
  main.innerHTML = `
    <header class="page-title"><h1>Karten</h1><button class="btn small" id="add">+ Eigene</button></header>
    <input type="search" id="q" placeholder="Karten durchsuchen" value="${h(query)}" aria-label="Karten durchsuchen">
    <div class="chips" role="group" aria-label="Filter">
      ${[['alle', `Alle ${all.length}`], ['wichtig', `★ Wichtig ${all.filter((c) => c.star).length}`], ['eigene', 'Eigene']].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}
    </div>
    <div class="clist">
      ${list.map((c) => `<article class="sheet citem">
        <div class="ctop"><span class="t">${TYPE_LABEL[c.type] || ''} · Fach ${S.progressOf(c.id).box}/5</span>
          <button class="starbtn ${c.star ? 'on' : ''}" data-star="${c.id}" aria-pressed="${!!c.star}" aria-label="Als wichtig markieren">${c.star ? '★' : '☆'}</button></div>
        <div class="cq">${h(c.q)}</div><div class="ca">${h(c.a)}</div>
        ${['manuell', 'import'].includes(c.type) ? `<button class="btn ghost small" data-del="${c.id}">Löschen</button>` : ''}
      </article>`).join('') || '<p class="muted">Keine Karte gefunden.</p>'}
    </div>`;
  const q = $('#q');
  q.oninput = () => { query = q.value; const pos = q.selectionStart; viewCards(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-f]').forEach((b) => b.onclick = () => { filter = b.dataset.f; viewCards(); });
  $$('[data-star]').forEach((b) => b.onclick = () => { const c = all.find((x) => x.id === b.dataset.star); S.updateCard(c.id, { star: !c.star }); viewCards(); });
  $$('[data-del]').forEach((b) => b.onclick = () => { S.deleteCard(b.dataset.del); viewCards(); });
  $('#add').onclick = openAdd;
}

function openAdd() {
  const dlg = $('#sheet');
  dlg.innerHTML = `<form id="addf" class="stack">
    <h2>Eigene Karten</h2>
    <p class="small muted">Eine Karte pro Zeile: <b>Frage | Antwort</b></p>
    <textarea id="list" rows="7" required placeholder="Gilde | Zusammenschluss von Kaufleuten&#10;Was ist Reputation? | Das Ansehen einer Person"></textarea>
    <div class="row end"><button type="button" class="btn ghost" id="cancel">Abbrechen</button><button class="btn primary">Hinzufügen</button></div>
  </form>`;
  dlg.showModal();
  $('#cancel').onclick = () => dlg.close();
  $('#addf').onsubmit = (e) => {
    e.preventDefault();
    const rows = $('#list').value.split('\n').map((l) => l.split(/\s*(?:\||\t|;)\s*/)).filter((p) => p.length >= 2 && p[0].trim() && p[1].trim());
    if (!rows.length) { toast('Bitte so schreiben: Frage | Antwort'); return; }
    const n = S.addCards(rows.map(([q, ...a]) => ({ testId: T.id, type: 'manuell', q: q.trim(), a: a.join('; ').trim() })));
    dlg.close(); toast(`${plural(n, 'Karte', 'Karten')} hinzugefügt`); filter = 'eigene'; viewCards();
  };
}

// ---------- Texte ----------
let docIdx = 0;
function viewText() {
  const docs = S.docsOf(T.id);
  docIdx = Math.min(docIdx, docs.length - 1);
  const d = docs[docIdx];
  let body = h(d.text);
  for (const m of (d.highlights || []).slice().sort((a, b) => b.length - a.length)) {
    const e = h(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body = body.replace(new RegExp(`(?<!<span class="mk">[^<]*)${e}`), `<span class="mk">${h(m)}</span>`);
  }
  body = body.split(/\n\s*\n/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  main.innerHTML = `
    <header class="page-title"><h1>Texte</h1></header>
    <div class="chips scroll" role="tablist">${docs.map((x, i) => `<button class="chip" role="tab" data-d="${i}" aria-selected="${i === docIdx}" aria-pressed="${i === docIdx}">${h(x.name.replace(/^(Lesetext|Arbeitsblatt|Kurzarbeit): ?/, ''))}</button>`).join('')}</div>
    <article class="sheet reader"><h2>${h(d.name)}</h2>${body}</article>`;
  $$('[data-d]').forEach((b) => b.onclick = () => { docIdx = +b.dataset.d; viewText(); });
}

// ---------- Spickzettel ----------
function viewCheat() {
  const docs = S.docsOf(T.id);
  const text = docs.map((d) => d.text).join('\n\n');
  const hl = docs.flatMap((d) => d.highlights || []);
  const kws = keywords(text, hl, 24);
  const sents = keySentences(text, hl, 12);
  const gloss = S.cardsOf(T.id).filter((c) => ['begriff', 'abkuerzung'].includes(c.type) && c.a.length < 160);
  const colors = ['gelb', 'gruen', 'pink', 'blau', 'orange', 'lila'];
  const mark = (s) => {
    let out = h(s);
    kws.slice(0, 18).forEach((k, i) => {
      const re = new RegExp(`(^|[^\\wäöüÄÖÜß])(${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^\\wäöüÄÖÜß]|$)`, 'g');
      out = out.replace(re, `$1<span class="mk" data-c="${colors[i % 6]}">$2</span>`);
    });
    return out;
  };
  main.innerHTML = `
    <header class="page-title"><h1>Spickzettel</h1></header>
    <article class="sheet cheat">
      <h3>Schlüsselbegriffe</h3>
      <div class="terms">${kws.map((k, i) => `<span class="mk" data-c="${colors[i % 6]}">${h(k)}</span>`).join('')}</div>
      <h3>Begriffe</h3>
      <dl class="glossary">${gloss.map((c) => `<dt>${h(c.q.replace(/^Wofür steht die Abkürzung |\?$/g, ''))}</dt><dd>${h(c.a)}</dd>`).join('')}</dl>
      <h3>Kernaussagen</h3>
      <ol>${sents.map((s) => `<li>${mark(s)}</li>`).join('')}</ol>
    </article>`;
}

document.addEventListener('lernapp:savefail', () => toast('Speichern nicht möglich – privater Modus?'));
route();
