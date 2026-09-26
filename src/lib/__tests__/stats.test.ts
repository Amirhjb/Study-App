import { describe, expect, it } from 'vitest';
import { buildIndex, computeStreaks, dayTotal, examPrep, requiredGrade, splitSession, weightedGrade, weeklyForecast } from '../stats';
import { defaultSettings } from '../defaults';
import { combineDateTime } from '../dates';
import type { Exam, Session, Settings } from '../types';

const settings: Settings = { ...defaultSettings, dailyGoals: [0, 60, 60, 60, 60, 60, 0], weeklyGoalMin: 300 };

function session(day: string, time: string, minutes: number, subjectId: string | null = 'a'): Session {
  return {
    id: `${day}-${time}`,
    subjectId,
    activityId: null,
    taskId: null,
    start: combineDateTime(day, time),
    durationSec: minutes * 60,
    pomodoros: 0,
    rating: 0,
    note: '',
    source: 'manual',
  };
}

describe('splitSession', () => {
  it('reparte una sesión que cruza la medianoche entre los dos días', () => {
    const segs = splitSession(session('2026-03-02', '23:30', 60));
    const byDay = new Map<string, number>();
    segs.forEach((s) => byDay.set(s.day, (byDay.get(s.day) ?? 0) + s.sec));
    expect(byDay.get('2026-03-02')).toBe(30 * 60);
    expect(byDay.get('2026-03-03')).toBe(30 * 60);
  });

  it('reparte por horas naturales', () => {
    const segs = splitSession(session('2026-03-02', '10:45', 30));
    expect(segs.map((s) => [s.hour, s.sec / 60])).toEqual([
      [10, 15],
      [11, 15],
    ]);
  });
});

describe('computeStreaks', () => {
  // 2026-03-02 es lunes; 03-07 sábado y 03-08 domingo (objetivo 0 = descanso)
  it('los días de descanso no rompen la racha y hoy sin estudiar tampoco', () => {
    const idx = buildIndex([
      session('2026-03-04', '10:00', 60),
      session('2026-03-05', '10:00', 60),
      session('2026-03-06', '10:00', 30),
      // sábado y domingo sin estudio (descanso)
    ]);
    const s = computeStreaks(idx, settings, '2026-03-09'); // lunes, aún sin estudiar
    expect(s.current).toBe(3);
    expect(s.goalCurrent).toBe(0); // el viernes no llegó al objetivo
    expect(s.goalBest).toBe(2);
    expect(s.todayPending).toBe(true);
  });

  it('un día laborable sin estudio rompe la racha', () => {
    const idx = buildIndex([session('2026-03-02', '10:00', 60), session('2026-03-04', '10:00', 60)]);
    const s = computeStreaks(idx, settings, '2026-03-04');
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
  });
});

describe('weeklyForecast', () => {
  it('calcula lo que falta por día hasta el final de la semana', () => {
    const idx = buildIndex([session('2026-03-02', '10:00', 120)]);
    const f = weeklyForecast(idx, settings, '2026-03-03'); // martes
    expect(f.doneSec).toBe(7200);
    expect(f.remainingSec).toBe(3 * 3600);
    expect(f.daysLeft).toBe(6); // martes a domingo
    expect(f.perDaySec).toBe(1800);
  });
});

describe('notas', () => {
  const ex = (grade: number | null, weight: number | null): Exam => ({
    id: Math.random().toString(),
    title: 'x',
    subjectId: 's',
    type: 'parcial',
    date: '2026-01-01',
    time: '',
    location: '',
    topics: '',
    targetHours: null,
    prepFrom: null,
    grade,
    weight,
    notes: '',
    createdAt: '',
  });

  it('media ponderada por pesos', () => {
    expect(weightedGrade([ex(8, 30), ex(6, 20)]).grade).toBeCloseTo(7.2);
    expect(weightedGrade([ex(8, 30), ex(6, 20)]).weightDone).toBe(50);
  });

  it('media simple si no hay pesos', () => {
    expect(weightedGrade([ex(8, null), ex(6, null)]).grade).toBe(7);
  });

  it('nota necesaria en lo que queda', () => {
    // 30 % con un 4: para un 5 hacen falta (500 - 120) / 70 = 5,43
    expect(requiredGrade([ex(4, 30), ex(null, 70)], 5)).toBeCloseTo(5.4286, 3);
  });
});

describe('examPrep', () => {
  it('cuenta las horas de la asignatura desde el examen anterior', () => {
    const e1 = { ...baseExam('e1', '2026-03-05') };
    const e2 = { ...baseExam('e2', '2026-03-20'), targetHours: 10 };
    const sessions = [session('2026-03-03', '10:00', 60), session('2026-03-10', '10:00', 120), session('2026-03-11', '10:00', 60, 'otra')];
    const p = examPrep(e2, [e1, e2], sessions, '2026-03-15');
    expect(p.studiedSec).toBe(7200);
    expect(p.daysLeft).toBe(5);
    expect(p.perDaySec).toBe((10 * 3600 - 7200) / 5);
  });
});

function baseExam(id: string, date: string): Exam {
  return {
    id,
    title: id,
    subjectId: 'a',
    type: 'parcial',
    date,
    time: '',
    location: '',
    topics: '',
    targetHours: null,
    prepFrom: null,
    grade: null,
    weight: null,
    notes: '',
    createdAt: '',
  };
}

describe('buildIndex', () => {
  it('suma por día y por asignatura', () => {
    const idx = buildIndex([session('2026-03-02', '10:00', 30), session('2026-03-02', '12:00', 45, 'b')]);
    expect(dayTotal(idx, '2026-03-02')).toBe(75 * 60);
    expect(idx.days.get('2026-03-02')?.bySubject.get('b')).toBe(45 * 60);
    expect(idx.days.get('2026-03-02')?.sessions).toBe(2);
  });
});
