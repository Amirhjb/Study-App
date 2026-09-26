import { initialTimer } from './timer';
import type { Activity, AppData, Settings } from './types';

export const DATA_VERSION = 1;

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const defaultActivities: Activity[] = [
  { id: 'act-teoria', name: 'Teoría' },
  { id: 'act-ejercicios', name: 'Ejercicios' },
  { id: 'act-repaso', name: 'Repaso' },
  { id: 'act-lectura', name: 'Lectura' },
  { id: 'act-memorizar', name: 'Memorizar' },
  { id: 'act-deberes', name: 'Deberes' },
  { id: 'act-proyecto', name: 'Proyecto / trabajo' },
  { id: 'act-clase', name: 'Clase' },
];

export const defaultSettings: Settings = {
  userName: '',
  theme: 'system',
  weekStartsOn: 1,
  // Domingo, lunes ... sábado (minutos)
  dailyGoals: [60, 180, 180, 180, 180, 150, 90],
  weeklyGoalMin: 16 * 60,
  pomodoro: {
    focusMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
    longEvery: 4,
    autoStartBreaks: true,
    autoStartFocus: false,
  },
  sound: true,
  notifications: false,
  gradeScale: { min: 0, max: 10, pass: 5, decimals: 2 },
  currentSemesterId: null,
  hiddenWidgets: [],
  onboarded: false,
  lastBackupAt: null,
};

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    settings: { ...defaultSettings, pomodoro: { ...defaultSettings.pomodoro } },
    semesters: [],
    subjects: [],
    activities: defaultActivities.map((a) => ({ ...a })),
    sessions: [],
    tasks: [],
    exams: [],
    notes: [],
    timer: { ...initialTimer },
  };
}

/** Normaliza datos importados o antiguos: rellena campos que falten. */
export function normalizeData(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppData>;
  const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
  return {
    version: DATA_VERSION,
    settings: {
      ...base.settings,
      ...(r.settings ?? {}),
      pomodoro: { ...base.settings.pomodoro, ...(r.settings?.pomodoro ?? {}) },
      gradeScale: { ...base.settings.gradeScale, ...(r.settings?.gradeScale ?? {}) },
      dailyGoals:
        Array.isArray(r.settings?.dailyGoals) && r.settings.dailyGoals.length === 7
          ? r.settings.dailyGoals.map((n) => Number(n) || 0)
          : base.settings.dailyGoals,
    },
    semesters: arr(r.semesters, []),
    subjects: arr(r.subjects, []),
    activities: arr(r.activities, base.activities),
    sessions: arr(r.sessions, []),
    tasks: arr(r.tasks, []).map((t: AppData['tasks'][number]) => ({ ...t, subtasks: t.subtasks ?? [] })),
    exams: arr(r.exams, []),
    notes: arr(r.notes, []).map((n: AppData['notes'][number]) => ({ ...n, tags: n.tags ?? [] })),
    timer: { ...initialTimer, ...(r.timer ?? {}) },
  };
}
