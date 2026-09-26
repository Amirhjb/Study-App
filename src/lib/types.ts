export type ID = string;

/** Fecha local en formato yyyy-MM-dd. */
export type DateKey = string;

export interface Semester {
  id: ID;
  name: string;
  start: DateKey;
  end: DateKey;
}

export interface Subject {
  id: ID;
  name: string;
  /** Índice en la paleta categórica (0-7). */
  color: number;
  semesterId: ID | null;
  /** Horas objetivo para todo el semestre (opcional). */
  targetHours: number | null;
  /** Objetivo semanal en minutos (opcional). */
  weeklyGoalMin: number | null;
  credits: number | null;
  teacher: string;
  archived: boolean;
  createdAt: string;
}

export interface Activity {
  id: ID;
  name: string;
}

export interface Session {
  id: ID;
  subjectId: ID | null;
  activityId: ID | null;
  taskId: ID | null;
  /** Inicio en ISO. */
  start: string;
  /** Tiempo efectivo de estudio en segundos (sin pausas). */
  durationSec: number;
  pomodoros: number;
  /** Concentración 1-5 (0 = sin valorar). */
  rating: number;
  note: string;
  source: 'timer' | 'manual';
}

export type TaskType = 'deberes' | 'trabajo' | 'proyecto' | 'lectura' | 'repaso' | 'otro';
export type TaskStatus = 'pendiente' | 'en_progreso' | 'hecha';
export type Priority = 'baja' | 'media' | 'alta';

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
}

export interface Task {
  id: ID;
  title: string;
  type: TaskType;
  subjectId: ID | null;
  due: DateKey | null;
  priority: Priority;
  status: TaskStatus;
  estimateMin: number | null;
  notes: string;
  subtasks: Subtask[];
  createdAt: string;
  completedAt: string | null;
}

export type ExamType = 'final' | 'parcial' | 'quiz' | 'oral' | 'practica' | 'presentacion';

export interface Exam {
  id: ID;
  title: string;
  subjectId: ID | null;
  type: ExamType;
  date: DateKey;
  time: string;
  location: string;
  topics: string;
  /** Horas de preparación objetivo. */
  targetHours: number | null;
  /** Desde cuándo cuentan las horas de preparación. */
  prepFrom: DateKey | null;
  grade: number | null;
  /** Peso en la nota final de la asignatura (%). */
  weight: number | null;
  notes: string;
  createdAt: string;
}

export interface Note {
  id: ID;
  title: string;
  content: string;
  subjectId: ID | null;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface PomodoroSettings {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  longEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
}

export interface GradeScale {
  min: number;
  max: number;
  pass: number;
  decimals: number;
}

export type WidgetId =
  | 'kpis'
  | 'week'
  | 'subjects'
  | 'heatmap'
  | 'exams'
  | 'tasks'
  | 'recent'
  | 'goals';

export interface Settings {
  userName: string;
  theme: ThemePref;
  weekStartsOn: 0 | 1;
  /** Objetivo diario en minutos por día de la semana (0 = domingo). */
  dailyGoals: number[];
  /** Objetivo semanal en minutos. */
  weeklyGoalMin: number;
  pomodoro: PomodoroSettings;
  sound: boolean;
  notifications: boolean;
  gradeScale: GradeScale;
  currentSemesterId: ID | null;
  hiddenWidgets: WidgetId[];
  onboarded: boolean;
  lastBackupAt: string | null;
}

export type TimerMode = 'stopwatch' | 'pomodoro';
export type PomodoroPhase = 'focus' | 'short' | 'long';

export interface TimerState {
  mode: TimerMode;
  running: boolean;
  /** Momento (ms) en que arrancó el tramo actual en marcha. */
  segmentStart: number | null;
  /** Tiempo acumulado (ms) de la fase actual antes del tramo en marcha. */
  phaseElapsedMs: number;
  /** Tiempo de enfoque ya completado en fases anteriores (ms). */
  focusDoneMs: number;
  phase: PomodoroPhase;
  pomodoros: number;
  /** Inicio de la sesión (ISO) o null si no hay sesión. */
  sessionStart: string | null;
  subjectId: ID | null;
  activityId: ID | null;
  taskId: ID | null;
}

export interface AppData {
  version: number;
  settings: Settings;
  semesters: Semester[];
  subjects: Subject[];
  activities: Activity[];
  sessions: Session[];
  tasks: Task[];
  exams: Exam[];
  notes: Note[];
  timer: TimerState;
}
