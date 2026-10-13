// Lernmaterial aus Text erzeugen – regelbasiert, ohne Internet.
// Erkennt: Fragen mit Antworten (Arbeitsblätter), Begriff–Erklärung-Paare, Definitionssätze,
// Abkürzungen, Jahreszahlen, Schlüsselbegriffe (deutsche Substantive) und markierte Stellen.

const STOP = new Set(('der die das den dem des ein eine einer eines einem einen und oder aber doch denn sondern als wie wenn weil dass daß ob so auch noch nur schon sehr mehr nicht kein keine keinen keiner ' +
  'ich du er sie es wir ihr man sich mich dich uns euch ihm ihn ihnen ihre ihr ihren ihrem ihres sein seine seinen seinem seiner seines mein dein unser euer ' +
  'ist sind war waren wird werden wurde wurden worden hat haben hatte hatten habe kann können konnte konnten muss müssen musste mussten soll sollen sollte sollten will wollen wollte darf dürfen mag ' +
  'in im ins an am auf aus bei mit nach von vom vor zu zum zur über unter um durch für gegen ohne bis seit während wegen trotz zwischen hinter neben ' +
  'dies diese dieser dieses diesen diesem jene jener jenes welche welcher welches was wer wo wann warum wieso weshalb wieviel ' +
  'da dann damit dazu dabei daher darum davon dafür dagegen darauf daraus darin hier dort heute immer wieder sowie bzw etc usw ca z.b. zb ' +
  'alle allem allen aller alles andere anderen anderer anderes viel viele vielen einige einigen jeder jede jedes jeden jedem etwa eben ganz gar sehr zudem ' +
  'sagt sagte erklärt betont nun also zwar jedoch dennoch somit sodass seien sei gewesen').split(' '));

// Arbeitsaufträge wie in Klassenarbeiten
const TASK = /^(Nenne|Nennen Sie|Zähle|Zählen Sie|Erkläre|Erklären Sie|Erläutere|Erläutern Sie|Beschreibe|Beschreiben Sie|Begründe|Begründen Sie|Definiere|Definieren Sie|Vergleiche|Vergleichen Sie|Stelle .* dar|Fasse .* zusammen)\b.{4,}$/;
const NUM_WORDS = { zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10 };
export function neededCount(q) {
  const m = q.match(/^(?:Nenne|Nennen Sie|Zähle|Zählen Sie)\s+(?:mindestens\s+)?(\d+|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\b/i);
  return m ? (+m[1] || NUM_WORDS[m[1].toLowerCase()]) : 0;
}

const DEF_VERBS =/\s(ist|sind|war|waren|bezeichnet|bedeutet|beschreibt|meint|umfasst)\s/;

export function normalize(raw) {
  let t = String(raw || '')
    .replace(/\r/g, '')
    .replace(/­/g, '')
    .replace(/([a-zäöüß])-\n\s*([a-zäöüß])/g, '$1$2'); // Silbentrennung am Zeilenende
  // Zeilennummern am Rand (Lesetexte: 5, 10, 15 …) nur entfernen, wenn sie gehäuft vorkommen
  const lineNo = /^[ \t]*\d{1,3}[ \t]+(?=[A-Za-zÄÖÜäöüß„"])/gm;
  if ((t.match(lineNo) || []).length >= 3) t = t.replace(lineNo, '');
  return t.replace(/ {3,}/g, '\t').replace(/[ \t]*\t[ \t]*/g, '\t').replace(/ +/g, ' ').replace(/^ | $/gm, '').trim();
}

// Zeilen zu Absätzen zusammenführen, Sätze trennen
export function sentences(text) {
  const paras = [];
  for (const block of text.split(/\n\s*\n/)) {
    const ls = block.split('\n').map((l) => l.trim()).filter(Boolean);
    let buf = '';
    ls.forEach((l, i) => {
      const heading = i < ls.length - 1 && l.length < 70 && l.split(' ').length <= 8 && !/[.!?:;,"“”-]$/.test(l);
      const listItem = /^([-•*>]|\d+[.)]\s|[a-z]\)\s)/.test(l);
      if (heading || listItem) { if (buf) paras.push(buf); buf = ''; paras.push(l); }
      else buf = buf ? buf + ' ' + l : l;
    });
    if (buf) paras.push(buf);
  }
  const out = [];
  for (const p of paras) {
    const parts = p
      .replace(/\b(z|u|d|bzw|ca|vgl|ggf|usw|etc|Nr|Dr|Prof|St|Abs|Art|bspw|evtl|inkl|max|min|sog)\./gi, '$1․')
      .replace(/(\d)\.(\s+(Jahrhundert|Jh|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Klasse|Stunde|Weltkrieg))/g, '$1․$2')
      .split(/(?<=[.!?…])\s+(?=[„"A-ZÄÖÜ0-9])/);
    for (let s of parts) {
      s = s.replace(/․/g, '.').trim();
      if (s.length > 2) out.push(s);
    }
  }
  return out;
}

const words = (s) => s.match(/[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\-]*[A-Za-zÄÖÜäöüß]|\d{3,4}/g) || [];
const clean = (s) => {
  s = s.replace(/\s+/g, ' ').replace(/^[\s„"“»\-–•*>]+|[\s“"”«,;:]+$/g, '').trim();
  if (s.startsWith('(') && !s.includes(')')) s = s.slice(1);
  if (s.endsWith(')') && !s.includes('(')) s = s.slice(0, -1);
  return s.trim();
};
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Schlüsselbegriffe: groß geschriebene Wörter, die nicht am Satzanfang stehen, + markierte Stellen
export function keywords(text, highlights = [], limit = 60) {
  const sents = sentences(text);
  const freq = new Map();
  for (const s of sents) {
    const ws = words(s);
    ws.forEach((w, i) => {
      const lw = w.toLowerCase();
      if (STOP.has(lw) || w.length < 4) return;
      const isNoun = /^[A-ZÄÖÜ]/.test(w) && i > 0;
      const isYear = /^\d{3,4}$/.test(w);
      if (!isNoun && !isYear) return;
      freq.set(w, (freq.get(w) || 0) + 1);
    });
  }
  const scored = [...freq].map(([w, f]) => [w, f * (1 + Math.min(w.length, 16) / 8)]);
  for (const h of highlights) {
    const key = clean(h);
    if (key.split(' ').length <= 5) scored.push([key, 20 + key.length / 4]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  const seen = new Set();
  const out = [];
  for (const [w] of scored) {
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(w);
    if (out.length >= limit) break;
  }
  return out;
}

// Wichtigste Sätze (für Spickzettel)
export function keySentences(text, highlights = [], n = 12) {
  const kws = keywords(text, highlights, 40);
  const weight = new Map(kws.map((k, i) => [k.toLowerCase(), 40 - i]));
  const sents = sentences(text).filter((s) => s.length > 40 && s.length < 360 && !/\?$/.test(s));
  const scored = sents.map((s, i) => {
    const lw = s.toLowerCase();
    let sc = 0;
    for (const [k, w] of weight) if (lw.includes(k)) sc += w;
    return { s, i, sc: sc / Math.sqrt(s.length / 60) };
  });
  return scored.sort((a, b) => b.sc - a.sc).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
}

// Hauptfunktion: liefert Kartenvorschläge {type, q, a, source}
export function generate(rawText, { highlights = [] } = {}) {
  const text = normalize(rawText);
  const lines = text.split('\n').map((l) => l.trim());
  const cards = [];
  const push = (type, q, a, source = '') => {
    q = clean(q); a = clean(a);
    if (q.length < 2 || a.length < 1 || q.toLowerCase() === a.toLowerCase()) return;
    cards.push({ type, q, a, source });
  };

  // 1) Fragen mit Antworten (Arbeitsblatt): Zeile endet mit "?" oder ist ein Arbeitsauftrag ("Nenne 8 …")
  const sents = sentences(text);
  const answerLines = new Set();
  const isTask = (s) => /\?\s*$/.test(s) || TASK.test(s);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].replace(/^(\d+|[a-z])[.)]\s*/, '');
    if (!isTask(l) || l.length < 8) continue;
    const ans = [];
    for (let j = i + 1; j < lines.length && ans.length < 6; j++) {
      const n = lines[j];
      if (!n) { if (ans.length) break; else continue; }
      if (isTask(n) || /^\d+[.)]\s+\S/.test(n)) break;
      ans.push(n.replace(/^[>•\-*]\s*/, ''));
    }
    ans.forEach((x) => answerLines.add(x));
    if (ans.length) {
      push('frage', l, ans.join('; '));
      const need = neededCount(l);
      if (need && cards.at(-1)?.q === clean(l)) cards.at(-1).need = need;
    }
    else {
      const best = bestSentenceFor(l, sents);
      if (best) push('frage', l, best, 'Antwort aus dem Text vorgeschlagen');
    }
  }

  // 2) Begriff – Erklärung (Glossare, Vokabeln, Tabellen)
  lines.forEach((raw, i) => {
    const l = raw.replace(/^([a-z]|\d+)[.)]\s*/, '');
    if (isTask(l) || answerLines.has(raw.replace(/^[>•\-*]\s*/, ''))) return;
    const m = l.match(/^([^:=–—\t]{2,60}?)\s*(:|=|\s[–—-]\s|\t+|\s->\s)\s*(.{2,300})$/);
    if (!m) return;
    const term = clean(m[1]), expl = clean(m[3]);
    const strong = /[:=\t]/.test(m[2]);
    // Fließtext-Zeilen mit Gedankenstrich sind keine Begriffspaare
    const prev = lines[i - 1] || '';
    const inProse = prev.length > 50 && !/[.:!?]$/.test(prev) && l.length > 50;
    if (!strong && (inProse || /^(Der|Die|Das|Ein|Eine|Im|In|Als|Wenn|Doch|Und)\s+[a-zäöüß]/.test(term))) return;
    if (m[2] === ':' && /\d$/.test(term)) return; // Uhrzeiten, Bibelstellen
    if (term.split(' ').length > 6 || /^(http|www)/i.test(term) || /[.!]$/.test(term)) return;
    if (/^(quelle|datum|name|klasse|thema|eintrag|seite|autor|lehrer)$/i.test(term) || /^quelle\b/i.test(expl)) return;
    push('begriff', term, expl);
  });

  // 3) Definitionssätze
  for (const s of sents) {
    if (s.length > 260 || /\?$/.test(s)) continue;
    let m = s.match(/^Unter (.{2,60}?) versteht man (.+?)[.!]?$/i);
    if (m) { push('definition', `Was versteht man unter ${m[1]}?`, cap1(m[2]), s); continue; }
    m = s.match(/^(.{2,60}?) (?:wird|werden) (?:als|auch) (.{2,80}?) bezeichnet[.!]?$/);
    if (m) { push('definition', `Wie wird ${m[1].replace(/^(Der|Die|Das|Ein|Eine) /, (x) => x.toLowerCase())} bezeichnet?`, cap1(m[2]), s); continue; }
    m = s.match(/^((?:Der|Die|Das|Ein|Eine) [A-ZÄÖÜ][\wäöüß-]+(?: [a-zäöüß]+ [A-ZÄÖÜ][\wäöüß-]+)?|[A-ZÄÖÜ][\wäöüß-]{3,}(?: \([^)]+\))?) (ist|sind|bezeichnet|bedeutet|beschreibt|meint|umfasst) (.{8,200}?)[.!]?$/);
    if (m && !STOP.has(m[1].toLowerCase())) {
      const subj = m[1];
      const q = m[2] === 'sind' ? `Was sind ${subj.replace(/^Die /, 'die ')}?` : `Was ${m[2] === 'ist' ? 'ist' : m[2]} ${subj.replace(/^(Der|Die|Das|Ein|Eine) /, (x) => x.toLowerCase())}?`;
      push('definition', q, cap1(m[3]), s);
    }
  }

  // 4) Abkürzungen: "Industrie- und Handelskammer (IHK)"
  const abbr = /((?:[A-ZÄÖÜ][\wäöüß-]*[\s-]+(?:und\s+|für\s+|der\s+|des\s+)?){1,5})\(([A-ZÄÖÜ]{2,6})\)/g;
  for (const m of text.matchAll(abbr)) {
    const ab = m[2];
    const ws = clean(m[1]).split(/\s+/);
    const content = (arr) => arr.filter((w) => !/^(und|für|der|des)$/.test(w)).length;
    let start = -1;
    for (let i = ws.length - 1; i >= 0; i--) {
      if (ws[i][0] !== ab[0] || ws[i] === ab) continue;
      start = i;
      if (content(ws.slice(i)) >= Math.min(2, ab.length - 1)) break;
    }
    if (start < 0) continue;
    const full = ws.slice(start).join(' ');
    if (full.length > 4) push('abkuerzung', `Wofür steht die Abkürzung „${ab}“?`, full);
  }

  // 5) Lückentexte aus wichtigen Sätzen
  const kws = keywords(text, highlights, 50);
  const kwSet = kws.map((k) => k.toLowerCase());
  let clozeCount = 0;
  const maxCloze = Math.min(60, Math.max(10, Math.round(sents.length * 0.6)));
  for (const s of sents) {
    if (clozeCount >= maxCloze) break;
    const wc = s.split(' ').length;
    if (wc < 6 || wc > 45 || isTask(s)) continue;
    if ([...answerLines].some((a) => a.includes(s) || s.includes(a))) continue; // Antworten sind schon Frage-Karten
    const lower = s.toLowerCase();
    let pick = null;
    for (let k = 0; k < kws.length; k++) {
      const idx = lower.indexOf(kwSet[k]);
      if (idx > 0 && /[^A-Za-zÄÖÜäöüß]/.test(lower[idx - 1] || ' ') && !/[A-Za-zÄÖÜäöüß-]/.test(lower[idx + kwSet[k].length] || ' ')) {
        pick = s.substr(idx, kws[k].length); break;
      }
    }
    if (!pick) continue;
    const q = s.replace(pick, '_____');
    push('lueckentext', q, pick, s);
    clozeCount++;
  }

  // 6) Jahreszahlen / Zeitangaben
  for (const s of sents) {
    const m = s.match(/\b(1[0-9]{3}|20[0-9]{2}|\d{1,2}\. Jahrhundert(?:s)?)\b/);
    if (!m || s.length > 220 || s.split(' ').length < 6) continue;
    if (cards.some((c) => c.type === 'lueckentext' && c.source === s && c.a === m[1])) continue;
    push('zeit', s.replace(m[1], '_____'), m[1], s);
  }

  // 7) Markierte Stellen → Kontextfrage
  for (const h of highlights) {
    const hk = clean(h);
    if (hk.split(' ').length > 8) continue;
    const s = sents.find((x) => x.includes(hk));
    if (s && !cards.some((c) => c.source === s && c.a === hk)) push('markiert', s.replace(hk, '_____'), hk, s);
  }

  // doppelte entfernen
  const seen = new Set();
  return cards.filter((c) => {
    const k = (c.q + '|' + c.a).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

// Satz finden, der eine Frage am besten beantwortet (Wortüberlappung)
function bestSentenceFor(question, sents) {
  const qw = words(question).map((w) => w.toLowerCase()).filter((w) => !STOP.has(w) && w.length > 3);
  if (!qw.length) return null;
  let best = null, bestSc = 0;
  for (const s of sents) {
    if (/\?$/.test(s)) continue;
    const lw = s.toLowerCase();
    let sc = 0;
    for (const w of qw) if (lw.includes(w.slice(0, Math.max(4, w.length - 2)))) sc++;
    sc = sc / qw.length;
    if (sc > bestSc) { bestSc = sc; best = s; }
  }
  return bestSc >= 0.5 ? best : null;
}

export const TYPE_LABEL = {
  frage: 'Frage', begriff: 'Begriff', definition: 'Definition', abkuerzung: 'Abkürzung',
  lueckentext: 'Lückentext', zeit: 'Zeitangabe', markiert: 'Markiert', manuell: 'Eigene Karte', import: 'Import',
};

// Antwortvergleich für Freitext: tolerant gegenüber Groß/Klein, Umlauten, Tippfehlern
// Aufzählungen ("Nenne 8 …"): wie viele der geforderten Punkte stecken in der Antwort?
export function listScore(given, answer, need) {
  const n = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const items = answer.split(/[,;]|\bund\b/).map(n).filter(Boolean);
  const g = n(given);
  const gw = g.split(' ');
  const found = items.filter((it) => {
    let core = it.split(' ').filter((w) => w.length > 4 && !STOP.has(w) && !/^(richtigen|moment|gute|guten|guter)$/.test(w));
    if (!core.length) core = it.split(' ').filter((w) => w.length > 2);
    return core.length && core.some((w) => gw.some((v) => v === w || (v.length > 4 && w.length > 4 && levenshtein(v.slice(0, w.length + 1), w) <= 1) || v.startsWith(w.slice(0, Math.max(5, w.length - 2)))));
  });
  return { found: found.length, need, score: Math.min(1, found.length / need) };
}

export function similarity(a, b) {
  const n = (s) => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const x = n(a), y = n(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const lev = levenshtein(x, y);
  const charSim = 1 - lev / Math.max(x.length, y.length);
  const tx = new Set(x.split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
  const ty = new Set(y.split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
  let hit = 0;
  for (const w of ty) if ([...tx].some((v) => v === w || (w.length > 4 && levenshtein(v, w) <= 1))) hit++;
  const tokSim = ty.size ? hit / ty.size : 0;
  return Math.max(charSim, tokSim);
}
function levenshtein(a, b) {
  if (a.length > 300 || b.length > 300) return Math.abs(a.length - b.length) + Math.min(a.length, b.length) / 2;
  const v = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = v[0]; v[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = v[j];
      v[j] = Math.min(v[j] + 1, v[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return v[b.length];
}

// IHK-Notenschlüssel (Punkte in %)
export function gradeFor(pct) {
  if (pct >= 92) return { note: 1, text: 'sehr gut' };
  if (pct >= 81) return { note: 2, text: 'gut' };
  if (pct >= 67) return { note: 3, text: 'befriedigend' };
  if (pct >= 50) return { note: 4, text: 'ausreichend' };
  if (pct >= 30) return { note: 5, text: 'mangelhaft' };
  return { note: 6, text: 'ungenügend' };
}
