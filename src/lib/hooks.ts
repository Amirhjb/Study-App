import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { todayKey } from './dates';
import { buildIndex, NO_SUBJECT } from './stats';
import type { Subject } from './types';

/** Devuelve Date.now() actualizado cada `ms` milisegundos. */
export function useNow(ms = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms, enabled]);
  return now;
}

/** Clave del día de hoy; se actualiza sola al pasar la medianoche. */
export function useToday(): string {
  const now = useNow(30_000);
  return todayKey(new Date(now));
}

export function useIndex() {
  const sessions = useStore((s) => s.sessions);
  return useMemo(() => buildIndex(sessions), [sessions]);
}

export function useSubjectMap(): Map<string, Subject> {
  const subjects = useStore((s) => s.subjects);
  return useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
}

export function subjectColor(s: Subject | undefined | null): string {
  if (!s) return 'var(--s-none)';
  return `var(--s${((s.color % 8) + 8) % 8})`;
}

export function colorForKey(key: string, map: Map<string, Subject>): string {
  if (key === NO_SUBJECT) return 'var(--s-none)';
  return subjectColor(map.get(key));
}

export function subjectName(key: string | null, map: Map<string, Subject>): string {
  if (!key || key === NO_SUBJECT) return 'Sin asignatura';
  return map.get(key)?.name ?? 'Asignatura eliminada';
}

/** Aplica el tema (claro/oscuro/sistema) a <html>. */
export function useApplyTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      // En "sistema" manda el tema del visor (data-theme) si lo hay; si no, el del dispositivo.
      const host = root.getAttribute('data-theme');
      const systemDark = host === 'dark' || (host !== 'light' && mq.matches);
      const dark = theme === 'dark' || (theme === 'system' && systemDark);
      root.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    const mo = new MutationObserver(apply);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', apply);
      mo.disconnect();
    };
  }, [theme]);
}

/** Enrutado mínimo por hash (#/estadisticas). Funciona también abriendo el archivo local. */
export function useHashRoute(): [string, (r: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'panel';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (r: string) => {
    window.location.hash = `/${r}`;
  };
  return [route, go];
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
