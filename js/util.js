export const COLORS = ['lila', 'gelb', 'gruen', 'pink', 'blau', 'orange'];
export const COLOR_NAME = { lila: 'Lila', gelb: 'Gelb', gruen: 'Grün', pink: 'Pink', blau: 'Blau', orange: 'Orange' };
export const cvar = (c) => `var(--m-${c || 'lila'})`;

export const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const sample = (a, n) => shuffle(a).slice(0, n);

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

const DAY = 864e5;
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / DAY);
}
export function countdownText(dateStr) {
  const n = daysUntil(dateStr);
  if (n === null) return '';
  if (n < 0) return n === -1 ? 'war gestern' : `vor ${-n} Tagen`;
  if (n === 0) return 'heute!';
  if (n === 1) return 'morgen!';
  return `noch ${n} Tage`;
}
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export function dateParts(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return { wd: WD[d.getDay()], day: d.getDate(), mon: MON[d.getMonth()] };
}
export const fmtDate = (ts) => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const isoDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICON = {
  cards: P('<rect x="3" y="6" width="14" height="12" rx="1.5"/><path d="M7 3h13a1 1 0 0 1 1 1v11"/><path d="M3 10h14"/>'),
  repeat: P('<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>'),
  quiz: P('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6V14"/><path d="M12 17.5v.01"/>'),
  tf: P('<path d="M4 12l4 4 8-9"/><path d="M15 15l5 5M20 15l-5 5"/>'),
  gap: P('<path d="M3 7h6M15 7h6M3 12h4M13 12h8M3 17h9"/><path d="M9 14v-4h4v4"/>'),
  match: P('<rect x="3" y="4" width="7" height="5" rx="1"/><rect x="3" y="15" width="7" height="5" rx="1"/><rect x="14" y="4" width="7" height="5" rx="1"/><rect x="14" y="15" width="7" height="5" rx="1"/><path d="M10 6.5l4 11M10 17.5l4-11"/>'),
  write: P('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
  exam: P('<path d="M7 3h10l3 3v15H4V3z"/><path d="M8 9h8M8 13h8M8 17h5"/><path d="M15 17l1.5 1.5L20 15"/>'),
  upload: P('<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  menu: P('<path d="M4 7h16M4 12h16M4 17h16"/>'),
};
