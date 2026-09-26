import { create } from 'zustand';
import { exportData, useStore } from '../store/useStore';
import { normalizeData } from './defaults';
import { toKey, weekStartKey } from './dates';
import type { AppData } from './types';

/**
 * Sincronización con la nube cuando la app se abre como Artifact en claude.ai
 * (capacidad `db`). Fuera de claude.ai no hace nada y los datos se quedan en el
 * navegador (localStorage), que además sirve siempre de copia local.
 *
 * Los datos se reparten en documentos pequeños (máx. 256 KiB cada uno):
 *   app/core            ajustes, semestres, asignaturas, actividades, temporizador
 *   sessions/w-<lunes>  sesiones de cada semana
 *   tasks/w-<lunes>     tareas agrupadas por semana de creación
 *   exams/w-<lunes>     exámenes por semana de la fecha
 *   notes/<id>          una nota por documento
 * Solo se escriben los documentos que han cambiado.
 */

type Doc = Record<string, unknown>;

interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Doc): Promise<void>;
  delete(): Promise<void>;
}
interface CloudDB {
  doc(path: string): DocRef;
  collection(path: string): { limit(n: number): { get(): Promise<{ docs: DocSnap[] }> } };
}

declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}

const MAX_DOC_BYTES = 200_000;
const COLLECTIONS = ['sessions', 'tasks', 'exams', 'notes'] as const;

function weekId(dateLike: string | undefined): string {
  if (!dateLike) return 'w-none';
  const d = dateLike.length === 10 ? new Date(`${dateLike}T12:00:00`) : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return 'w-none';
  return `w-${weekStartKey(toKey(d), 1)}`;
}

function safeId(id: string): string {
  const s = id.replace(/[^A-Za-z0-9_\-.~:@+]/g, '_').slice(0, 180);
  return s === '' || s === '.' || s === '..' ? `id_${s.length}` : s;
}

/** Agrupa elementos por semana y parte los grupos demasiado grandes. */
function chunk<T>(collection: string, items: T[], dateOf: (x: T) => string | undefined, out: Map<string, Doc>) {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const k = weekId(dateOf(it));
    const g = groups.get(k);
    if (g) g.push(it);
    else groups.set(k, [it]);
  }
  for (const [k, list] of groups) {
    if (JSON.stringify(list).length <= MAX_DOC_BYTES) {
      out.set(`${collection}/${k}`, { items: list });
      continue;
    }
    let part: T[] = [];
    let size = 0;
    let n = 1;
    for (const it of list) {
      const s = JSON.stringify(it).length + 1;
      if (part.length > 0 && size + s > MAX_DOC_BYTES) {
        out.set(`${collection}/${k}.p${n++}`, { items: part });
        part = [];
        size = 0;
      }
      part.push(it);
      size += s;
    }
    if (part.length) out.set(`${collection}/${k}.p${n}`, { items: part });
  }
}

export function toDocs(data: AppData): Map<string, Doc> {
  const out = new Map<string, Doc>();
  out.set('app/core', {
    version: data.version,
    settings: data.settings,
    semesters: data.semesters,
    subjects: data.subjects,
    activities: data.activities,
    timer: data.timer,
  });
  chunk('sessions', data.sessions, (s) => s.start, out);
  chunk('tasks', data.tasks, (t) => t.createdAt, out);
  chunk('exams', data.exams, (e) => e.date, out);
  for (const n of data.notes) out.set(`notes/${safeId(n.id)}`, { ...n });
  return out;
}

export function fromDocs(docs: Map<string, Doc>): AppData {
  const core = (docs.get('app/core') ?? {}) as Doc;
  const items = (col: string) =>
    [...docs.entries()]
      .filter(([p]) => p.startsWith(`${col}/`))
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([, d]) => (Array.isArray(d.items) ? d.items : []));
  const notes = [...docs.entries()].filter(([p]) => p.startsWith('notes/')).map(([, d]) => d);
  return normalizeData({
    ...core,
    sessions: items('sessions'),
    tasks: items('tasks'),
    exams: items('exams'),
    notes,
  });
}

/* ------------------------------------------------------------------ Estado visible */

export type CloudStatus = 'off' | 'loading' | 'synced' | 'saving' | 'error';

export const useCloud = create<{ status: CloudStatus; message: string }>()(() => ({
  status: 'off',
  message: '',
}));

function setStatus(status: CloudStatus, message = '') {
  useCloud.setState({ status, message });
}

/* ------------------------------------------------------------------ Motor */

const DIRTY_KEY = 'studium-cloud-dirty';
function markDirty(v: boolean) {
  try {
    if (v) localStorage.setItem(DIRTY_KEY, '1');
    else localStorage.removeItem(DIRTY_KEY);
  } catch {
    // almacenamiento no disponible
  }
}
function isDirty(): boolean {
  try {
    return localStorage.getItem(DIRTY_KEY) === '1';
  } catch {
    return false;
  }
}

let db: CloudDB | null = null;
let lastWritten = new Map<string, string>();
let applyingRemote = false;
let flushing = false;
let again = false;
let timer: number | undefined;
let retried = false;

function errCode(e: unknown): string {
  return typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : 'unavailable';
}

async function loadAll(d: CloudDB): Promise<Map<string, Doc>> {
  const out = new Map<string, Doc>();
  const core = await d.doc('app/core').get();
  if (core.exists) out.set('app/core', clone(core.data()));
  for (const c of COLLECTIONS) {
    const snap = await d.collection(c).limit(1000).get();
    for (const s of snap.docs) if (s.exists) out.set(`${c}/${s.id}`, clone(s.data()));
  }
  return out;
}

function clone(x: unknown): Doc {
  return JSON.parse(JSON.stringify(x ?? {}));
}

function jsonMap(docs: Map<string, Doc>): Map<string, string> {
  return new Map([...docs].map(([p, d]) => [p, JSON.stringify(d)]));
}

function schedule(ms = 1200) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void flush(), ms);
}

async function flush() {
  if (!db) return;
  if (flushing) {
    again = true;
    return;
  }
  flushing = true;
  setStatus('saving');
  try {
    const next = jsonMap(toDocs(exportData()));
    // Una escritura cada vez y solo de lo que ha cambiado.
    for (const [path, json] of next) {
      if (lastWritten.get(path) === json) continue;
      await db.doc(path).set(JSON.parse(json));
      lastWritten.set(path, json);
    }
    for (const path of [...lastWritten.keys()]) {
      if (next.has(path)) continue;
      await db.doc(path).delete();
      lastWritten.delete(path);
    }
    markDirty(false);
    retried = false;
    setStatus('synced');
  } catch (e) {
    const code = errCode(e);
    if (code === 'unavailable' && !retried) {
      retried = true;
      again = true;
    } else if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled') {
      db = null;
      setStatus('error', 'La nube no está disponible. Tus datos siguen guardados en este navegador.');
    } else if (code === 'quota_exceeded') {
      setStatus('error', 'Se ha llenado el espacio en la nube. Borra datos antiguos o descarga una copia.');
    } else {
      setStatus('error', 'No se han podido guardar los cambios en la nube. Se reintentará.');
      again = true;
    }
  } finally {
    flushing = false;
    if (again && db) {
      again = false;
      schedule(retried ? 3000 + Math.random() * 3000 : 800);
    }
  }
}

/** Trae los cambios hechos en otro dispositivo (al volver a la pestaña). */
async function refresh() {
  if (!db || flushing || isDirty()) return;
  try {
    const remote = await loadAll(db);
    if (!remote.has('app/core') || isDirty() || flushing) return;
    const remoteJson = jsonMap(remote);
    const same =
      remoteJson.size === lastWritten.size && [...remoteJson].every(([p, j]) => lastWritten.get(p) === j);
    if (same) return;
    applyingRemote = true;
    useStore.getState().replaceData(fromDocs(remote));
    applyingRemote = false;
    lastWritten = remoteJson;
    setStatus('synced');
  } catch {
    applyingRemote = false;
  }
}

let started = false;

/** Arranca la sincronización si la app corre dentro de claude.ai. */
export async function initCloud() {
  if (started || typeof window === 'undefined' || typeof window.claude?.use !== 'function') return;
  started = true;
  setStatus('loading');
  let ns: unknown = null;
  try {
    ns = await window.claude.use('db');
  } catch {
    ns = null;
  }
  if (!ns) {
    setStatus('off');
    return;
  }
  db = ns as CloudDB;
  try {
    const remote = await loadAll(db);
    lastWritten = jsonMap(remote);
    const local = useStore.getState();
    if (remote.has('app/core') && !isDirty()) {
      applyingRemote = true;
      local.replaceData(fromDocs(remote));
      applyingRemote = false;
    } else if (local.settings.onboarded) {
      // Primera vez en la nube (o cambios locales sin subir): se suben los datos locales.
      schedule(0);
    }
    setStatus('synced');
  } catch (e) {
    applyingRemote = false;
    db = null;
    setStatus('error', `No se han podido cargar tus datos de la nube (${errCode(e)}). Se usan los de este navegador.`);
    return;
  }

  useStore.subscribe((s, prev) => {
    if (applyingRemote || !db) return;
    if (s === prev) return;
    markDirty(true);
    schedule();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh();
    else if (isDirty()) void flush();
  });
}
