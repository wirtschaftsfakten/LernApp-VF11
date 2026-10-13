// Originaldateien (Fotos, PDFs …) im Browser speichern – IndexedDB, weil localStorage dafür zu klein ist.
// Bleibt wie alles andere nur auf diesem Gerät.
const DB = 'lernapp-dateien';
let dbp;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('files', mode);
    const req = fn(t.objectStore('files'));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
}
export async function putFile(id, blob) {
  try { await tx('readwrite', (s) => s.put(blob, id)); return true; } catch (e) { console.warn('Original nicht gespeichert', e); return false; }
}
export async function getFile(id) {
  try { return await tx('readonly', (s) => s.get(id)); } catch { return null; }
}
export async function deleteFile(id) {
  try { await tx('readwrite', (s) => s.delete(id)); } catch {}
}
