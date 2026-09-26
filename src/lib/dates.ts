import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
  isValid,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateKey } from './types';

export const locale = es;

export function toKey(d: Date): DateKey {
  return format(d, 'yyyy-MM-dd');
}

/** Convierte yyyy-MM-dd en Date local a las 00:00. */
export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now = new Date()): DateKey {
  return toKey(now);
}

export function addDaysKey(key: DateKey, n: number): DateKey {
  return toKey(addDays(fromKey(key), n));
}

export function diffDays(a: DateKey, b: DateKey): number {
  return differenceInCalendarDays(fromKey(a), fromKey(b));
}

/** Lista de claves de día entre start y end (ambos incluidos). */
export function daysBetween(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = [];
  const n = diffDays(end, start);
  const base = fromKey(start);
  for (let i = 0; i <= n; i++) out.push(toKey(addDays(base, i)));
  return out;
}

export function weekStartKey(key: DateKey, weekStartsOn: 0 | 1): DateKey {
  return toKey(startOfWeek(fromKey(key), { weekStartsOn }));
}

export function fmt(d: Date | DateKey, pattern: string): string {
  const date = typeof d === 'string' ? (d.length === 10 ? fromKey(d) : parseISO(d)) : d;
  if (!isValid(date)) return '';
  return format(date, pattern, { locale: es });
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2 h 05 min", "45 min", "0 min". */
export function fmtDuration(sec: number, opts: { compact?: boolean } = {}): string {
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (opts.compact) {
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}

/** Horas con un decimal y coma decimal: "12,5 h". */
export function fmtHours(sec: number, decimals = 1): string {
  const h = sec / 3600;
  return `${h.toLocaleString('es-ES', { maximumFractionDigits: decimals, minimumFractionDigits: 0 })} h`;
}

/** Reloj hh:mm:ss o mm:ss. */
export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtNumber(n: number, decimals = 1): string {
  return n.toLocaleString('es-ES', { maximumFractionDigits: decimals });
}

/** "hoy", "mañana", "en 5 días", "hace 2 días". */
export function relativeDay(key: DateKey, today: DateKey): string {
  const d = diffDays(key, today);
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d === -1) return 'ayer';
  if (d > 1) return `en ${d} días`;
  return `hace ${-d} días`;
}

/** Hora local HH:mm de un ISO. */
export function timeOf(iso: string): string {
  return format(parseISO(iso), 'HH:mm');
}

/** Combina fecha (yyyy-MM-dd) y hora (HH:mm) locales en ISO. */
export function combineDateTime(key: DateKey, time: string): string {
  const [h, m] = (time || '00:00').split(':').map(Number);
  const d = fromKey(key);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export const WEEKDAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Índices de día de la semana ordenados según el inicio de semana. */
export function orderedWeekdays(weekStartsOn: 0 | 1): number[] {
  return weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
}
