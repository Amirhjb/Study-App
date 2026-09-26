import { daysBetween } from './dates';
import { computeStreaks, dailyGoalSec, dayTotal, weekRange, type StudyIndex } from './stats';
import type { AppData, DateKey } from './types';

export type BadgeIcon =
  | 'rocket'
  | 'clock'
  | 'flame'
  | 'sunrise'
  | 'moon'
  | 'mountain'
  | 'zap'
  | 'timer'
  | 'target'
  | 'crown'
  | 'check'
  | 'grad'
  | 'note'
  | 'gem';

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: BadgeIcon;
  /** Progreso actual y meta, para mostrar la barra. */
  value: number;
  goal: number;
  earned: boolean;
}

interface Tier {
  id: string;
  title: string;
  description: string;
  icon: BadgeIcon;
  goal: number;
}

function tiers(value: number, list: Tier[]): Badge[] {
  return list.map((t) => ({ ...t, value: Math.min(value, t.goal), earned: value >= t.goal }));
}

/** Calcula los logros a partir de los datos (no se guardan: siempre están al día). */
export function computeBadges(data: AppData, idx: StudyIndex, today: DateKey): Badge[] {
  const { sessions, settings, tasks, exams, notes } = data;
  const totalH = idx.total / 3600;
  const streaks = computeStreaks(idx, settings, today);
  const pomodoros = sessions.reduce((a, s) => a + (s.pomodoros || 0), 0);
  const early = sessions.some((s) => new Date(s.start).getHours() < 7);
  const late = sessions.some((s) => {
    const end = new Date(new Date(s.start).getTime() + s.durationSec * 1000);
    return end.getHours() >= 23 || end.toDateString() !== new Date(s.start).toDateString();
  });
  const longest = sessions.reduce((a, s) => Math.max(a, s.durationSec), 0);
  let bestDay = 0;
  idx.days.forEach((d) => (bestDay = Math.max(bestDay, d.total)));

  let goalDays = 0;
  let perfectWeeks = 0;
  if (idx.firstDay) {
    const days = daysBetween(idx.firstDay, today);
    for (const k of days) {
      const g = dailyGoalSec(settings, k);
      if (g > 0 && dayTotal(idx, k) >= g) goalDays++;
    }
    // Semanas completas en las que se cumplió el objetivo semanal.
    const seen = new Set<string>();
    for (const k of days) {
      const w = weekRange(k, settings.weekStartsOn);
      if (seen.has(w.start) || w.end >= today) continue;
      seen.add(w.start);
      let t = 0;
      for (const d of daysBetween(w.start, w.end)) t += dayTotal(idx, d);
      if (settings.weeklyGoalMin > 0 && t >= settings.weeklyGoalMin * 60) perfectWeeks++;
    }
  }
  const doneTasks = tasks.filter((t) => t.status === 'hecha').length;
  const passed = exams.filter((e) => e.grade !== null && e.grade >= settings.gradeScale.pass).length;

  return [
    ...tiers(sessions.length, [
      { id: 'first', title: 'Primer paso', description: 'Registra tu primera sesión de estudio', icon: 'rocket', goal: 1 },
    ]),
    ...tiers(totalH, [
      { id: 'h10', title: '10 horas', description: 'Acumula 10 horas de estudio', icon: 'clock', goal: 10 },
      { id: 'h50', title: '50 horas', description: 'Acumula 50 horas de estudio', icon: 'clock', goal: 50 },
      { id: 'h100', title: 'Centenario', description: 'Acumula 100 horas de estudio', icon: 'gem', goal: 100 },
      { id: 'h250', title: 'Imparable', description: 'Acumula 250 horas de estudio', icon: 'gem', goal: 250 },
      { id: 'h500', title: 'Maestría', description: 'Acumula 500 horas de estudio', icon: 'crown', goal: 500 },
    ]),
    ...tiers(streaks.best, [
      { id: 's3', title: 'Buen comienzo', description: 'Racha de 3 días estudiando', icon: 'flame', goal: 3 },
      { id: 's7', title: 'Semana en llamas', description: 'Racha de 7 días estudiando', icon: 'flame', goal: 7 },
      { id: 's14', title: 'Constancia', description: 'Racha de 14 días estudiando', icon: 'flame', goal: 14 },
      { id: 's30', title: 'Hábito de hierro', description: 'Racha de 30 días estudiando', icon: 'flame', goal: 30 },
      { id: 's100', title: 'Leyenda', description: 'Racha de 100 días estudiando', icon: 'crown', goal: 100 },
    ]),
    ...tiers(goalDays, [
      { id: 'g1', title: 'Objetivo cumplido', description: 'Cumple tu objetivo diario', icon: 'target', goal: 1 },
      { id: 'g10', title: 'Diez de diez', description: 'Cumple el objetivo diario 10 días', icon: 'target', goal: 10 },
      { id: 'g50', title: 'Disciplina', description: 'Cumple el objetivo diario 50 días', icon: 'target', goal: 50 },
    ]),
    ...tiers(perfectWeeks, [
      { id: 'w1', title: 'Semana perfecta', description: 'Cumple el objetivo semanal', icon: 'check', goal: 1 },
      { id: 'w4', title: 'Mes perfecto', description: 'Cumple el objetivo semanal 4 semanas', icon: 'check', goal: 4 },
    ]),
    ...tiers(pomodoros, [
      { id: 'p1', title: 'Primer pomodoro', description: 'Completa un pomodoro', icon: 'timer', goal: 1 },
      { id: 'p50', title: 'Tomatero', description: 'Completa 50 pomodoros', icon: 'timer', goal: 50 },
      { id: 'p200', title: 'Huerto de tomates', description: 'Completa 200 pomodoros', icon: 'timer', goal: 200 },
    ]),
    ...tiers(longest / 3600, [
      { id: 'marathon', title: 'Maratón', description: 'Una sesión de 3 horas seguidas', icon: 'mountain', goal: 3 },
    ]),
    ...tiers(bestDay / 3600, [
      { id: 'bigday', title: 'Día épico', description: 'Estudia 6 horas en un solo día', icon: 'zap', goal: 6 },
    ]),
    ...tiers(early ? 1 : 0, [
      { id: 'early', title: 'Madrugador', description: 'Empieza a estudiar antes de las 7:00', icon: 'sunrise', goal: 1 },
    ]),
    ...tiers(late ? 1 : 0, [
      { id: 'late', title: 'Búho nocturno', description: 'Estudia pasadas las 23:00', icon: 'moon', goal: 1 },
    ]),
    ...tiers(doneTasks, [
      { id: 't10', title: 'Organizado', description: 'Completa 10 tareas', icon: 'check', goal: 10 },
      { id: 't50', title: 'Productivo', description: 'Completa 50 tareas', icon: 'check', goal: 50 },
    ]),
    ...tiers(passed, [
      { id: 'pass1', title: 'Aprobado', description: 'Aprueba un examen', icon: 'grad', goal: 1 },
      { id: 'pass5', title: 'En racha', description: 'Aprueba 5 exámenes', icon: 'grad', goal: 5 },
    ]),
    ...tiers(notes.length, [
      { id: 'n10', title: 'Escritor', description: 'Escribe 10 notas', icon: 'note', goal: 10 },
    ]),
  ];
}
