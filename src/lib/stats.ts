import { addDaysKey, daysBetween, diffDays, fromKey, toKey, weekStartKey } from './dates';
import type { DateKey, Exam, ID, Session, Settings } from './types';

export interface DayStats {
  total: number;
  bySubject: Map<string, number>;
  byActivity: Map<string, number>;
  sessions: number;
}

/** Índice de segundos estudiados por día, asignatura, actividad y hora. */
export interface StudyIndex {
  days: Map<DateKey, DayStats>;
  /** Segundos por hora del día (0-23) de cada día. */
  hours: Map<DateKey, number[]>;
  firstDay: DateKey | null;
  total: number;
}

export const NO_SUBJECT = '__none__';
export const NO_ACTIVITY = '__none__';

interface Segment {
  day: DateKey;
  hour: number;
  sec: number;
}

/**
 * Reparte una sesión en tramos por hora natural. Así una sesión de 23:30 a 00:30
 * cuenta 30 min para cada día.
 */
export function splitSession(s: Pick<Session, 'start' | 'durationSec'>): Segment[] {
  const out: Segment[] = [];
  let t = new Date(s.start).getTime();
  const end = t + s.durationSec * 1000;
  if (!Number.isFinite(t) || s.durationSec <= 0) return out;
  while (t < end) {
    const d = new Date(t);
    const nextHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
    const segEnd = Math.min(end, nextHour);
    out.push({ day: toKey(d), hour: d.getHours(), sec: (segEnd - t) / 1000 });
    t = segEnd;
  }
  return out;
}

function emptyDay(): DayStats {
  return { total: 0, bySubject: new Map(), byActivity: new Map(), sessions: 0 };
}

function inc(map: Map<string, number>, key: string, v: number) {
  map.set(key, (map.get(key) ?? 0) + v);
}

export function buildIndex(sessions: Session[]): StudyIndex {
  const days = new Map<DateKey, DayStats>();
  const hours = new Map<DateKey, number[]>();
  let total = 0;
  let firstDay: DateKey | null = null;
  for (const s of sessions) {
    const segs = splitSession(s);
    segs.forEach((seg, i) => {
      let day = days.get(seg.day);
      if (!day) {
        day = emptyDay();
        days.set(seg.day, day);
      }
      day.total += seg.sec;
      if (i === 0) day.sessions += 1;
      inc(day.bySubject, s.subjectId ?? NO_SUBJECT, seg.sec);
      inc(day.byActivity, s.activityId ?? NO_ACTIVITY, seg.sec);
      let h = hours.get(seg.day);
      if (!h) {
        h = new Array(24).fill(0);
        hours.set(seg.day, h);
      }
      h[seg.hour] += seg.sec;
      total += seg.sec;
      if (!firstDay || seg.day < firstDay) firstDay = seg.day;
    });
  }
  return { days, hours, firstDay, total };
}

export function dayTotal(idx: StudyIndex, key: DateKey): number {
  return idx.days.get(key)?.total ?? 0;
}

export function sumRange(idx: StudyIndex, start: DateKey, end: DateKey): number {
  let t = 0;
  for (const k of daysBetween(start, end)) t += dayTotal(idx, k);
  return t;
}

export function subjectTotalsInRange(
  idx: StudyIndex,
  start: DateKey,
  end: DateKey,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const k of daysBetween(start, end)) {
    const d = idx.days.get(k);
    if (!d) continue;
    d.bySubject.forEach((v, key) => inc(out, key, v));
  }
  return out;
}

export function activityTotalsInRange(
  idx: StudyIndex,
  start: DateKey,
  end: DateKey,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const k of daysBetween(start, end)) {
    const d = idx.days.get(k);
    if (!d) continue;
    d.byActivity.forEach((v, key) => inc(out, key, v));
  }
  return out;
}

export function hoursInRange(idx: StudyIndex, start: DateKey, end: DateKey): number[] {
  const out = new Array(24).fill(0);
  for (const k of daysBetween(start, end)) {
    const h = idx.hours.get(k);
    if (!h) continue;
    for (let i = 0; i < 24; i++) out[i] += h[i];
  }
  return out;
}

/** Segundos por día de la semana (0 = domingo) y número de esos días en el rango. */
export function weekdayTotals(idx: StudyIndex, start: DateKey, end: DateKey) {
  const totals = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (const k of daysBetween(start, end)) {
    const wd = fromKey(k).getDay();
    totals[wd] += dayTotal(idx, k);
    counts[wd] += 1;
  }
  return { totals, counts };
}

export function dailyGoalSec(settings: Settings, key: DateKey): number {
  return (settings.dailyGoals[fromKey(key).getDay()] ?? 0) * 60;
}

export interface Streaks {
  /** Días seguidos con estudio (los días sin objetivo no rompen la racha). */
  current: number;
  best: number;
  /** Días seguidos cumpliendo el objetivo diario. */
  goalCurrent: number;
  goalBest: number;
  /** Si hoy aún cuenta para mantener la racha. */
  todayPending: boolean;
}

/**
 * Calcula las rachas. Un día con objetivo 0 (día de descanso) sin estudio no rompe
 * la racha, pero tampoco suma. Hoy sin estudio tampoco la rompe todavía.
 */
export function computeStreaks(
  idx: StudyIndex,
  settings: Settings,
  today: DateKey,
  minSec = 60,
): Streaks {
  const res: Streaks = { current: 0, best: 0, goalCurrent: 0, goalBest: 0, todayPending: false };
  if (!idx.firstDay) return res;
  const days = daysBetween(idx.firstDay < today ? idx.firstDay : today, today);

  let run = 0;
  let goalRun = 0;
  for (const k of days) {
    const t = dayTotal(idx, k);
    const goal = dailyGoalSec(settings, k);
    const isToday = k === today;
    const rest = goal === 0;

    if (t >= minSec) run += 1;
    else if (!rest && !isToday) run = 0;
    res.best = Math.max(res.best, run);

    const met = goal > 0 && t >= goal;
    if (met) goalRun += 1;
    else if (!rest && !isToday) goalRun = 0;
    res.goalBest = Math.max(res.goalBest, goalRun);
  }
  res.current = run;
  res.goalCurrent = goalRun;
  const todaySec = dayTotal(idx, today);
  res.todayPending = todaySec < minSec && dailyGoalSec(settings, today) > 0;
  return res;
}

export interface Range {
  start: DateKey;
  end: DateKey;
}

export function weekRange(today: DateKey, weekStartsOn: 0 | 1, offset = 0): Range {
  const start = addDaysKey(weekStartKey(today, weekStartsOn), offset * 7);
  return { start, end: addDaysKey(start, 6) };
}

export function monthRange(today: DateKey, offset = 0): Range {
  const d = fromKey(today);
  const start = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const end = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0);
  return { start: toKey(start), end: toKey(end) };
}

export function yearRange(today: DateKey, offset = 0): Range {
  const y = fromKey(today).getFullYear() + offset;
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

/** Días transcurridos del rango hasta hoy (incluido), mínimo 1. */
export function elapsedDays(range: Range, today: DateKey): number {
  if (today < range.start) return 0;
  const end = today < range.end ? today : range.end;
  return diffDays(end, range.start) + 1;
}

export interface WeeklyForecast {
  goalSec: number;
  doneSec: number;
  remainingSec: number;
  daysLeft: number;
  perDaySec: number;
}

/** Cuánto hay que estudiar cada día que queda para cumplir el objetivo semanal. */
export function weeklyForecast(
  idx: StudyIndex,
  settings: Settings,
  today: DateKey,
): WeeklyForecast {
  const r = weekRange(today, settings.weekStartsOn);
  const goalSec = settings.weeklyGoalMin * 60;
  const doneSec = sumRange(idx, r.start, today);
  const remainingSec = Math.max(0, goalSec - doneSec);
  const daysLeft = diffDays(r.end, today) + 1;
  return { goalSec, doneSec, remainingSec, daysLeft, perDaySec: daysLeft > 0 ? remainingSec / daysLeft : 0 };
}

export interface ExamPrep {
  studiedSec: number;
  targetSec: number | null;
  daysLeft: number;
  perDaySec: number | null;
  from: DateKey | null;
}

/**
 * Horas de preparación de un examen: tiempo de su asignatura desde `prepFrom`
 * (o desde el examen anterior de la misma asignatura) hasta el día del examen.
 */
export function examPrep(
  exam: Exam,
  allExams: Exam[],
  sessions: Session[],
  today: DateKey,
): ExamPrep {
  let from = exam.prepFrom;
  if (!from && exam.subjectId) {
    const prev = allExams
      .filter((e) => e.id !== exam.id && e.subjectId === exam.subjectId && e.date < exam.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (prev) from = addDaysKey(prev.date, 1);
  }
  let studiedSec = 0;
  if (exam.subjectId) {
    for (const s of sessions) {
      if (s.subjectId !== exam.subjectId) continue;
      const day = toKey(new Date(s.start));
      if (from && day < from) continue;
      if (day > exam.date) continue;
      studiedSec += s.durationSec;
    }
  }
  const targetSec = exam.targetHours ? exam.targetHours * 3600 : null;
  const daysLeft = Math.max(0, diffDays(exam.date, today));
  const perDaySec =
    targetSec !== null && daysLeft > 0 ? Math.max(0, targetSec - studiedSec) / daysLeft : null;
  return { studiedSec, targetSec, daysLeft, perDaySec, from };
}

/** Total por asignatura de todas las sesiones. */
export function subjectTotals(sessions: Session[]): Map<ID | null, number> {
  const m = new Map<ID | null, number>();
  for (const s of sessions) m.set(s.subjectId, (m.get(s.subjectId) ?? 0) + s.durationSec);
  return m;
}

/** Media ponderada de las notas de una asignatura. Devuelve null si no hay notas. */
export function weightedGrade(exams: Exam[]): { grade: number | null; weightDone: number } {
  const graded = exams.filter((e) => e.grade !== null && e.grade !== undefined);
  if (graded.length === 0) return { grade: null, weightDone: 0 };
  const hasWeights = graded.some((e) => (e.weight ?? 0) > 0);
  if (!hasWeights) {
    const avg = graded.reduce((a, e) => a + (e.grade as number), 0) / graded.length;
    return { grade: avg, weightDone: 0 };
  }
  let w = 0;
  let sum = 0;
  for (const e of graded) {
    const wi = e.weight ?? 0;
    w += wi;
    sum += (e.grade as number) * wi;
  }
  return { grade: w > 0 ? sum / w : null, weightDone: w };
}

/**
 * Nota que hace falta en lo que queda (peso restante) para llegar a `target`.
 * Devuelve null si no se puede calcular.
 */
export function requiredGrade(exams: Exam[], target: number): number | null {
  const graded = exams.filter((e) => e.grade !== null && (e.weight ?? 0) > 0);
  const done = graded.reduce((a, e) => a + (e.weight as number), 0);
  const remaining = 100 - done;
  if (remaining <= 0) return null;
  const acc = graded.reduce((a, e) => a + (e.grade as number) * (e.weight as number), 0);
  return (target * 100 - acc) / remaining;
}
