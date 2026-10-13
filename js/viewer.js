// Originalblatt anzeigen: Fotos und PDFs direkt, andere Dateien zum Öffnen in der passenden App.
import { getFile } from './files.js';
import { loadPdfjs } from './extract.js';
import { h, toast } from './util.js';

let box;
function shell() {
  if (box) return box;
  box = document.createElement('dialog');
  box.className = 'viewer';
  box.innerHTML = `<div class="viewer-bar"><b class="viewer-title"></b><span class="row"><button class="btn small" data-zoom>Vergrößern</button><a class="btn small" data-dl>Herunterladen</a><button class="btn small primary" data-x>Schließen</button></span></div><div class="viewer-body"></div>`;
  document.body.appendChild(box);
  box.querySelector('[data-x]').onclick = () => box.close();
  box.querySelector('[data-zoom]').onclick = () => {
    const z = box.classList.toggle('zoomed');
    box.querySelector('[data-zoom]').textContent = z ? 'Einpassen' : 'Vergrößern';
  };
  box.addEventListener('close', () => {
    box.querySelectorAll('[data-url]').forEach((el) => URL.revokeObjectURL(el.dataset.url));
    box.querySelector('.viewer-body').innerHTML = '';
    box.classList.remove('zoomed');
  });
  return box;
}

// doc.files: Liste von IDs im Gerätespeicher; doc.urls: öffentlich mitgelieferte Bilder (Beispiel-Set)
export function hasOriginal(doc) {
  return !!(doc.fileIds?.length || doc.urls?.length);
}

export async function openOriginal(doc) {
  const v = shell();
  const body = v.querySelector('.viewer-body');
  v.querySelector('.viewer-title').textContent = doc.name;
  const dl = v.querySelector('[data-dl]');
  body.innerHTML = '<p class="muted viewer-wait">Blatt wird geladen …</p>';
  v.showModal();
  const items = [];
  for (const u of doc.urls || []) items.push({ url: new URL(u, location.href).href, type: 'image/jpeg', name: doc.name });
  for (const id of doc.fileIds || []) {
    const f = await getFile(id);
    if (f) items.push({ blob: f, url: URL.createObjectURL(f), type: f.type, name: f.name || doc.name, own: true });
  }
  if (!items.length) {
    body.innerHTML = '<p class="muted viewer-wait">Das Original ist auf diesem Gerät nicht gespeichert. Es liegt nur auf dem Gerät, auf dem es hochgeladen wurde.</p>';
    dl.hidden = true;
    return;
  }
  dl.hidden = false;
  dl.href = items[0].url; dl.download = items[0].name;
  body.innerHTML = '';
  for (const it of items) {
    if (it.type.startsWith('image/')) {
      const img = new Image();
      img.src = it.url; img.alt = it.name; img.className = 'viewer-page';
      if (it.own) img.dataset.url = it.url;
      body.appendChild(img);
    } else if (it.type === 'application/pdf' || /\.pdf$/i.test(it.name)) {
      await renderPdf(it, body);
    } else {
      const p = document.createElement('div');
      p.className = 'viewer-wait';
      p.innerHTML = `<p>Diese Datei (${h(it.name)}) kann hier nicht angezeigt werden.</p><a class="btn primary" href="${it.url}" download="${h(it.name)}" data-url="${it.url}">In Word/PowerPoint öffnen</a>`;
      body.appendChild(p);
    }
  }
}

async function renderPdf(it, body) {
  try {
    const pdfjs = await loadPdfjs();
    const data = new Uint8Array(await (it.blob || await (await fetch(it.url)).blob()).arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 2 });
      const c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height; c.className = 'viewer-page';
      body.appendChild(c);
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    }
  } catch (e) {
    console.error(e);
    toast('PDF konnte nicht angezeigt werden – über „Herunterladen“ öffnen.');
  }
}
