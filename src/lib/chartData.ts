import type { BarDatum } from '../charts/BarChart';
import type { DistItem } from '../charts/Distribution';
import { addDaysKey, capitalize, daysBetween, fmt, weekStartKey } from './dates';
import { colorForKey, subjectName } from './hooks';
import { dailyGoalSec, NO_SUBJECT, type StudyIndex } from './stats';
import type { Activity, DateKey, Settings, Subject } from './types';

/** Orden estable de asignaturas: el de la lista y "sin asignatura" al final. */
function subjectOrder(subjects: Subject[]): string[] {
  return [...subjects.map((s) => s.id), NO_SUBJECT];
}

function segmentsFor(by: Map<string, number>, subjects: Subject[], map: Map<string, Subject>) {
  const order = subjectOrder(subjects);
  const keys = [...by.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return keys.map((k) => ({ key: k, name: subjectName(k, map), color: colorForKey(k, map), value: by.get(k) ?? 0 }));
}

export function dailyBars(
  idx: StudyIndex,
  keys: DateKey[],
  subjects: Subject[],
  map: Map<string, Subject>,
  settings: Settings,
  today: DateKey,
  labelPattern = 'EEEEE',
  withGoal = true,
): BarDatum[] {
  return keys.map((k) => {
    const day = idx.days.get(k);
    return {
      key: k,
      label: labelPattern === 'd' ? fmt(k, 'd') : capitalize(fmt(k, labelPattern)),
      title: capitalize(fmt(k, "EEEE, d 'de' MMMM")),
      segments: day ? segmentsFor(day.bySubject, subjects, map) : [],
      goal: withGoal ? dailyGoalSec(settings, k) : undefined,
      highlight: k === today,
    };
  });
}

export function weeklyBars(
  idx: StudyIndex,
  start: DateKey,
  end: DateKey,
  subjects: Subject[],
  map: Map<string, Subject>,
  settings: Settings,
  today: DateKey,
): BarDatum[] {
  const out: BarDatum[] = [];
  let w = weekStartKey(start, settings.weekStartsOn);
  while (w <= end) {
    const wEnd = addDaysKey(w, 6);
    const by = new Map<string, number>();
    for (const k of daysBetween(w < start ? start : w, wEnd > end ? end : wEnd)) {
      idx.days.get(k)?.bySubject.forEach((v, key) => by.set(key, (by.get(key) ?? 0) + v));
    }
    out.push({
      key: w,
      label: fmt(w, 'd MMM'),
      title: `Semana del ${fmt(w, "d 'de' MMM")} al ${fmt(wEnd, "d 'de' MMM")}`,
      segments: segmentsFor(by, subjects, map),
      goal: settings.weeklyGoalMin > 0 ? settings.weeklyGoalMin * 60 : undefined,
      highlight: today >= w && today <= wEnd,
    });
    w = addDaysKey(w, 7);
  }
  return out;
}

export function monthlyBars(
  idx: StudyIndex,
  start: DateKey,
  end: DateKey,
  subjects: Subject[],
  map: Map<string, Subject>,
  today: DateKey,
): BarDatum[] {
  const out: BarDatum[] = [];
  const s = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1);
  const e = new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, 1);
  for (let d = s; d <= e; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const mStart = fmt(d, 'yyyy-MM-dd');
    const mEnd = fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0), 'yyyy-MM-dd');
    const by = new Map<string, number>();
    for (const k of daysBetween(mStart < start ? start : mStart, mEnd > end ? end : mEnd)) {
      idx.days.get(k)?.bySubject.forEach((v, key) => by.set(key, (by.get(key) ?? 0) + v));
    }
    out.push({
      key: mStart,
      label: capitalize(fmt(d, 'MMM')),
      title: capitalize(fmt(d, 'MMMM yyyy')),
      segments: segmentsFor(by, subjects, map),
      highlight: today >= mStart && today <= mEnd,
    });
  }
  return out;
}

export function subjectDist(totals: Map<string, number>, map: Map<string, Subject>): DistItem[] {
  return [...totals.entries()].map(([k, v]) => ({
    key: k,
    name: subjectName(k, map),
    color: colorForKey(k, map),
    value: v,
  }));
}

export function activityDist(totals: Map<string, number>, activities: Activity[]): DistItem[] {
  // Las actividades no son una identidad fuerte: un solo color para todas.
  return [...totals.entries()].map(([k, v]) => ({
    key: k,
    name: activities.find((a) => a.id === k)?.name ?? 'Sin actividad',
    color: 'var(--s0)',
    value: v,
  }));
}

/** Leyenda de las series presentes, en el orden fijo de las asignaturas. */
export function legendFrom(data: BarDatum[], subjects: Subject[]) {
  const order = subjectOrder(subjects);
  const seen = new Map<string, { key: string; name: string; color: string }>();
  for (const d of data) for (const s of d.segments) if (s.value > 0 && !seen.has(s.key)) seen.set(s.key, { key: s.key, name: s.name, color: s.color });
  const rank = (k: string) => (order.indexOf(k) < 0 ? 999 : order.indexOf(k));
  return [...seen.values()].sort((a, b) => rank(a.key) - rank(b.key));
}
