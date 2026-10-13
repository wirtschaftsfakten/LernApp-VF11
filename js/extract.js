// Text aus hochgeladenen Dateien holen – komplett lokal im Browser.
// PDF: pdf.js (Textebene, bei Scans OCR) · Word/PowerPoint/OpenOffice: ZIP+XML · Bilder: Tesseract OCR (Deutsch)
// Bei Fotos werden zusätzlich farbig markierte Wörter (Textmarker) erkannt.

const abs = (p) => new URL(p, location.href).href;

export const ACCEPT = '.pdf,.docx,.pptx,.odt,.odp,.txt,.md,.csv,.rtf,.png,.jpg,.jpeg,.webp,.bmp,.gif,.heic';

export async function extractFile(file, onStatus = () => {}) {
  const name = file.name;
  const ext = name.split('.').pop().toLowerCase();
  if (['txt', 'md', 'csv'].includes(ext)) return { kind: 'text', text: await file.text(), highlights: [] };
  if (ext === 'rtf') return { kind: 'text', text: rtfToText(await file.text()), highlights: [] };
  if (ext === 'pdf') return extractPdf(file, onStatus);
  if (['docx', 'pptx', 'odt', 'odp'].includes(ext)) return { kind: ext, text: await extractOffice(file, ext), highlights: [] };
  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext)) {
    onStatus('Bild wird gelesen (Texterkennung) …');
    const bmp = await loadImage(file);
    return { kind: 'bild', ...(await ocrCanvas(bmp, onStatus)) };
  }
  throw new Error(`Dateityp .${ext} wird nicht unterstützt.`);
}

// ---------- PDF ----------
let pdfjs;
async function extractPdf(file, onStatus) {
  if (!pdfjs) {
    pdfjs = await import(abs('lib/pdfjs/pdf.min.mjs'));
    pdfjs.GlobalWorkerOptions.workerSrc = abs('lib/pdfjs/pdf.worker.min.mjs');
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const parts = [];
  const highlights = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onStatus(`PDF Seite ${i} von ${doc.numPages} …`);
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let text = '';
    for (const it of tc.items) text += it.str + (it.hasEOL ? '\n' : (it.str.endsWith(' ') ? '' : ' '));
    if (text.replace(/\s/g, '').length < 40) {
      // gescannte Seite → rendern und OCR
      const vp = page.getViewport({ scale: 2.2 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const r = await ocrCanvas(canvas, (s) => onStatus(`PDF Seite ${i}: ${s}`));
      text = r.text; highlights.push(...r.highlights);
    }
    parts.push(text);
  }
  return { kind: 'pdf', text: parts.join('\n\n'), highlights };
}

// ---------- Office (ZIP + XML) ----------
async function extractOffice(file, ext) {
  const zip = await readZip(await file.arrayBuffer());
  const xmlText = (xml, paraTag, textTag) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const out = [];
    for (const p of doc.getElementsByTagName(paraTag)) {
      let line = '';
      const walk = (n) => {
        for (const c of n.childNodes) {
          if (c.nodeType !== 1) continue;
          if (c.tagName === textTag) line += c.textContent;
          else if (c.localName === 'tab') line += '\t';
          else if (c.localName === 'br' || c.localName === 'line-break') line += '\n';
          else walk(c);
        }
      };
      walk(p);
      out.push(line);
    }
    return out.join('\n');
  };
  if (ext === 'docx') {
    const xml = await zip.text('word/document.xml');
    // Tabellenzellen in einer Zeile mit Tab trennen
    const prepared = xml.replace(/<\/w:p>\s*<\/w:tc>\s*<w:tc>/g, '</w:p><w:p><w:r><w:t>\u0001</w:t></w:r></w:p>');
    return xmlText(prepared, 'w:p', 'w:t').replace(/\n\u0001\n/g, '\t').replace(/\u0001/g, '\t');
  }
  if (ext === 'pptx') {
    const slides = zip.names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
    const out = [];
    for (const s of slides) out.push(xmlText(await zip.text(s), 'a:p', 'a:t'));
    return out.join('\n\n');
  }
  // ODT / ODP
  const xml = await zip.text('content.xml');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const out = [];
  const all = doc.getElementsByTagName('*');
  for (const el of all) if (el.localName === 'p' || el.localName === 'h') out.push(el.textContent);
  return out.join('\n');
}

async function readZip(buf) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Datei ist beschädigt oder kein Office-Dokument.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = {};
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
    entries[name] = { method, csize, local };
    p += 46 + nlen + xlen + clen;
  }
  return {
    names: Object.keys(entries),
    async text(name) {
      const e = entries[name];
      if (!e) throw new Error(`${name} fehlt im Dokument.`);
      const lnl = dv.getUint16(e.local + 26, true), lxl = dv.getUint16(e.local + 28, true);
      const data = new Uint8Array(buf, e.local + 30 + lnl + lxl, e.csize);
      if (e.method === 0) return dec.decode(data);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    },
  };
}

function rtfToText(rtf) {
  return rtf.replace(/\\par[d]?/g, '\n').replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').trim();
}

// ---------- Bilder / OCR ----------
async function loadImage(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Bild konnte nicht geöffnet werden (HEIC bitte vorher als JPG speichern).');
  }
}

let workerPromise;
function getWorker(onStatus) {
  if (!workerPromise) {
    onStatus('Texterkennung wird geladen …');
    workerPromise = (async () => {
      await loadScript(abs('lib/tesseract/tesseract.min.js'));
      return window.Tesseract.createWorker('deu', 1, {
        workerPath: abs('lib/tesseract/worker.min.js'),
        corePath: abs('lib/tesseract/core'),
        langPath: abs('lib/tesseract/lang'),
        gzip: true,
        workerBlobURL: false,
        logger: (m) => {
          if (m.status === 'recognizing text') currentStatus(`Texterkennung ${Math.round(m.progress * 100)} %`);
        },
      });
    })();
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}
let currentStatus = () => {};

function loadScript(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some((s) => s.src === src)) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Texterkennung konnte nicht geladen werden.'));
    document.head.appendChild(s);
  });
}

async function ocrCanvas(source, onStatus) {
  currentStatus = onStatus;
  const worker = await getWorker(onStatus);
  // auf sinnvolle Größe bringen: lange Seite ca. 2400 px
  const w0 = source.width, h0 = source.height;
  const scale = Math.min(2.5, 2400 / Math.max(w0, h0));
  const W = Math.round(w0 * scale), H = Math.round(h0 * scale);
  const color = document.createElement('canvas');
  color.width = W; color.height = H;
  const cctx = color.getContext('2d', { willReadFrequently: true });
  cctx.drawImage(source, 0, 0, W, H);
  const rgba = cctx.getImageData(0, 0, W, H);

  // Graustufen + Kontrast; Textmarker-Farbe wird zu Weiß, damit sie die Erkennung nicht stört
  const gray = document.createElement('canvas');
  gray.width = W; gray.height = H;
  const gctx = gray.getContext('2d');
  const out = gctx.createImageData(W, H);
  const mark = new Uint8Array(W * H);
  const d = rgba.data, o = out.data;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;
    let y = 0.299 * r + 0.587 * g + 0.114 * b;
    if (sat > 0.18 && max > 120) { mark[j] = 1; y = Math.min(255, y * 1.25 + 20); }
    o[i] = o[i + 1] = o[i + 2] = y; o[i + 3] = 255;
  }
  gctx.putImageData(out, 0, 0);

  onStatus('Texterkennung läuft …');
  const { data } = await worker.recognize(gray, {}, { text: true, blocks: true });
  const highlights = findHighlights(data, mark, W);
  return { text: cleanOcr(data.text), highlights };
}

function findHighlights(data, mark, W) {
  const phrases = [];
  let cur = [];
  const flush = () => { if (cur.length) phrases.push(cur.join(' ')); cur = []; };
  for (const block of data.blocks || []) for (const para of block.paragraphs) for (const line of para.lines) {
    for (const word of line.words) {
      const { x0, y0, x1, y1 } = word.bbox;
      let hit = 0, n = 0;
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { n++; hit += mark[y * W + x]; }
      const clean = word.text.replace(/^[„"“(»]+|[“"”),.;:!?«]+$/g, '');
      if (n && hit / n > 0.22 && word.confidence > 55 && clean.length > 1) cur.push(clean);
      else flush();
    }
    flush();
  }
  return [...new Set(phrases.filter((p) => p.length > 3 && /[A-Za-zÄÖÜäöüß]{3}/.test(p)))];
}

function cleanOcr(t) {
  return t
    .replace(/[|]/g, '')
    .split('\n')
    .map((l) => l.replace(/^(?:[IiOo'=\-_~,.:;]{1,2}\s+)+(?=\S{3})/, '').replace(/(?:\s+[IiOo'=\-_~,.:;]{1,2})+$/, '').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}
