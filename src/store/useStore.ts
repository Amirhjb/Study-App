import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { emptyData, normalizeData, uid, DATA_VERSION } from '../lib/defaults';
import * as T from '../lib/timer';
import type {
  Activity,
  AppData,
  Exam,
  ID,
  Note,
  Semester,
  Session,
  Settings,
  Subject,
  Task,
  TimerState,
} from '../lib/types';

type New<X extends { id: ID }> = Omit<X, 'id'> & { id?: ID };

export interface Actions {
  updateSettings: (patch: Partial<Settings>) => void;

  addSemester: (s: New<Semester>) => ID;
  updateSemester: (id: ID, patch: Partial<Semester>) => void;
  deleteSemester: (id: ID) => void;

  addSubject: (s: New<Subject>) => ID;
  updateSubject: (id: ID, patch: Partial<Subject>) => void;
  deleteSubject: (id: ID) => void;

  addActivity: (name: string) => ID;
  updateActivity: (id: ID, patch: Partial<Activity>) => void;
  deleteActivity: (id: ID) => void;

  addSession: (s: New<Session>) => ID;
  updateSession: (id: ID, patch: Partial<Session>) => void;
  deleteSession: (id: ID) => void;

  addTask: (t: New<Task>) => ID;
  updateTask: (id: ID, patch: Partial<Task>) => void;
  deleteTask: (id: ID) => void;
  toggleTask: (id: ID) => void;

  addExam: (e: New<Exam>) => ID;
  updateExam: (id: ID, patch: Partial<Exam>) => void;
  deleteExam: (id: ID) => void;

  addNote: (n: New<Note>) => ID;
  updateNote: (id: ID, patch: Partial<Note>) => void;
  deleteNote: (id: ID) => void;

  setTimer: (fn: (t: TimerState) => TimerState) => void;
  /** Guarda la sesión del temporizador. Devuelve el id o null si era demasiado corta. */
  finishTimer: (extra: { rating: number; note: string; durationSec?: number }) => ID | null;
  discardTimer: () => void;

  importData: (raw: unknown) => void;
  replaceData: (data: AppData) => void;
  resetAll: () => void;
}

export type Store = AppData & Actions;

const now = () => new Date().toISOString();

function dataOf(s: Store): AppData {
  return {
    version: s.version,
    settings: s.settings,
    semesters: s.semesters,
    subjects: s.subjects,
    activities: s.activities,
    sessions: s.sessions,
    tasks: s.tasks,
    exams: s.exams,
    notes: s.notes,
    timer: s.timer,
  };
}

export const STORAGE_KEY = 'studium-data';

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...emptyData(),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addSemester: (x) => {
        const id = x.id ?? uid();
        set((s) => ({ semesters: [...s.semesters, { ...x, id }] }));
        return id;
      },
      updateSemester: (id, patch) =>
        set((s) => ({ semesters: s.semesters.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteSemester: (id) =>
        set((s) => ({
          semesters: s.semesters.filter((x) => x.id !== id),
          subjects: s.subjects.map((x) => (x.semesterId === id ? { ...x, semesterId: null } : x)),
          settings:
            s.settings.currentSemesterId === id
              ? { ...s.settings, currentSemesterId: null }
              : s.settings,
        })),

      addSubject: (x) => {
        const id = x.id ?? uid();
        set((s) => ({ subjects: [...s.subjects, { ...x, id }] }));
        return id;
      },
      updateSubject: (id, patch) =>
        set((s) => ({ subjects: s.subjects.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteSubject: (id) =>
        set((s) => ({
          subjects: s.subjects.filter((x) => x.id !== id),
          sessions: s.sessions.map((x) => (x.subjectId === id ? { ...x, subjectId: null } : x)),
          tasks: s.tasks.map((x) => (x.subjectId === id ? { ...x, subjectId: null } : x)),
          exams: s.exams.map((x) => (x.subjectId === id ? { ...x, subjectId: null } : x)),
          notes: s.notes.map((x) => (x.subjectId === id ? { ...x, subjectId: null } : x)),
          timer: s.timer.subjectId === id ? { ...s.timer, subjectId: null } : s.timer,
        })),

      addActivity: (name) => {
        const id = uid();
        set((s) => ({ activities: [...s.activities, { id, name }] }));
        return id;
      },
      updateActivity: (id, patch) =>
        set((s) => ({ activities: s.activities.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteActivity: (id) =>
        set((s) => ({
          activities: s.activities.filter((x) => x.id !== id),
          sessions: s.sessions.map((x) => (x.activityId === id ? { ...x, activityId: null } : x)),
          timer: s.timer.activityId === id ? { ...s.timer, activityId: null } : s.timer,
        })),

      addSession: (x) => {
        const id = x.id ?? uid();
        set((s) => ({ sessions: [...s.sessions, { ...x, id }] }));
        return id;
      },
      updateSession: (id, patch) =>
        set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),

      addTask: (x) => {
        const id = x.id ?? uid();
        set((s) => ({ tasks: [...s.tasks, { ...x, id }] }));
        return id;
      },
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((x) => {
            if (x.id !== id) return x;
            const next = { ...x, ...patch };
            if (patch.status && patch.status !== x.status) {
              next.completedAt = patch.status === 'hecha' ? now() : null;
            }
            return next;
          }),
        })),
      deleteTask: (id) =>
        set((s) => ({
          tasks: s.tasks.filter((x) => x.id !== id),
          sessions: s.sessions.map((x) => (x.taskId === id ? { ...x, taskId: null } : x)),
          timer: s.timer.taskId === id ? { ...s.timer, taskId: null } : s.timer,
        })),
      toggleTask: (id) => {
        const t = get().tasks.find((x) => x.id === id);
        if (!t) return;
        get().updateTask(id, { status: t.status === 'hecha' ? 'pendiente' : 'hecha' });
      },

      addExam: (x) => {
        const id = x.id ?? uid();
        set((s) => ({ exams: [...s.exams, { ...x, id }] }));
        return id;
      },
      updateExam: (id, patch) =>
        set((s) => ({ exams: s.exams.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteExam: (id) => set((s) => ({ exams: s.exams.filter((x) => x.id !== id) })),

      addNote: (x) => {
        const id = x.id ?? uid();
        set((s) => ({ notes: [{ ...x, id }, ...s.notes] }));
        return id;
      },
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x)),
        })),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((x) => x.id !== id) })),

      setTimer: (fn) => set((s) => ({ timer: fn(s.timer) })),

      finishTimer: ({ rating, note, durationSec }) => {
        const s = get();
        const t = T.advance(s.timer, s.settings.pomodoro, Date.now()).timer;
        const sec = durationSec ?? Math.round(T.focusMs(t, Date.now()) / 1000);
        let id: ID | null = null;
        if (t.sessionStart && sec >= 60) {
          id = uid();
          const session: Session = {
            id,
            subjectId: t.subjectId,
            activityId: t.activityId,
            taskId: t.taskId,
            start: t.sessionStart,
            durationSec: sec,
            pomodoros: t.mode === 'pomodoro' ? t.pomodoros : 0,
            rating,
            note,
            source: 'timer',
          };
          set((st) => ({ sessions: [...st.sessions, session] }));
        }
        set((st) => ({ timer: T.resetSession(st.timer) }));
        return id;
      },
      discardTimer: () => set((s) => ({ timer: T.resetSession(s.timer) })),

      importData: (raw) => set(() => ({ ...normalizeData(raw) })),
      replaceData: (data) => set(() => ({ ...data })),
      resetAll: () => set(() => ({ ...emptyData() })),
    }),
    {
      name: STORAGE_KEY,
      version: DATA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => dataOf(s as Store),
      merge: (persisted, current) => ({ ...current, ...normalizeData(persisted) }),
    },
  ),
);

export function exportData(): AppData {
  return dataOf(useStore.getState());
}

// Sincroniza entre pestañas: si otra pestaña guarda, recargamos el estado.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) void useStore.persist.rehydrate();
  });
}
