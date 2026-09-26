import type { PomodoroPhase, PomodoroSettings, TimerState } from './types';

export const initialTimer: TimerState = {
  mode: 'pomodoro',
  running: false,
  segmentStart: null,
  phaseElapsedMs: 0,
  focusDoneMs: 0,
  phase: 'focus',
  pomodoros: 0,
  sessionStart: null,
  subjectId: null,
  activityId: null,
  taskId: null,
};

export function phaseDurationMs(phase: PomodoroPhase, p: PomodoroSettings): number {
  const min = phase === 'focus' ? p.focusMin : phase === 'short' ? p.shortBreakMin : p.longBreakMin;
  return Math.max(1, min) * 60_000;
}

export function phaseElapsed(t: TimerState, now: number): number {
  return t.phaseElapsedMs + (t.running && t.segmentStart !== null ? now - t.segmentStart : 0);
}

/** Tiempo de estudio efectivo acumulado en la sesión actual (ms). */
export function focusMs(t: TimerState, now: number): number {
  if (t.mode === 'stopwatch') return phaseElapsed(t, now);
  return t.focusDoneMs + (t.phase === 'focus' ? phaseElapsed(t, now) : 0);
}

export function hasSession(t: TimerState): boolean {
  return t.sessionStart !== null;
}

export function start(t: TimerState, now: number): TimerState {
  if (t.running) return t;
  return {
    ...t,
    running: true,
    segmentStart: now,
    sessionStart: t.sessionStart ?? new Date(now).toISOString(),
  };
}

export function pause(t: TimerState, now: number): TimerState {
  if (!t.running) return t;
  return { ...t, running: false, segmentStart: null, phaseElapsedMs: phaseElapsed(t, now) };
}

export function resetSession(t: TimerState): TimerState {
  return {
    ...initialTimer,
    mode: t.mode,
    subjectId: t.subjectId,
    activityId: t.activityId,
    taskId: t.taskId,
  };
}

export function nextPhase(t: TimerState, p: PomodoroSettings): PomodoroPhase {
  if (t.phase !== 'focus') return 'focus';
  const count = t.pomodoros + 1;
  return count % Math.max(1, p.longEvery) === 0 ? 'long' : 'short';
}

export interface PhaseEvent {
  ended: PomodoroPhase;
  next: PomodoroPhase;
  at: number;
}

/**
 * Avanza el pomodoro: cierra todas las fases que ya han terminado (aunque la pestaña
 * haya estado en segundo plano) y devuelve los cambios de fase ocurridos.
 */
export function advance(
  t: TimerState,
  p: PomodoroSettings,
  now: number,
): { timer: TimerState; events: PhaseEvent[] } {
  const events: PhaseEvent[] = [];
  if (t.mode !== 'pomodoro' || !t.running || t.segmentStart === null) return { timer: t, events };
  let cur = t;
  // Límite de seguridad por si los ajustes cambian a valores extraños.
  for (let guard = 0; guard < 100; guard++) {
    const dur = phaseDurationMs(cur.phase, p);
    const elapsed = phaseElapsed(cur, now);
    if (elapsed < dur) break;
    const endedAt = (cur.segmentStart as number) + (dur - cur.phaseElapsedMs);
    const ended = cur.phase;
    const next = nextPhase(cur, p);
    const autoStart = next === 'focus' ? p.autoStartFocus : p.autoStartBreaks;
    cur = {
      ...cur,
      focusDoneMs: ended === 'focus' ? cur.focusDoneMs + dur : cur.focusDoneMs,
      pomodoros: ended === 'focus' ? cur.pomodoros + 1 : cur.pomodoros,
      phase: next,
      phaseElapsedMs: 0,
      running: autoStart,
      segmentStart: autoStart ? endedAt : null,
    };
    events.push({ ended, next, at: endedAt });
    if (!autoStart) break;
  }
  return { timer: cur, events };
}

/** Salta la fase actual. Si es de enfoque, el tiempo hecho se conserva. */
export function skipPhase(t: TimerState, p: PomodoroSettings, now: number): TimerState {
  const elapsed = phaseElapsed(t, now);
  const next = nextPhase(t, p);
  const wasFocus = t.phase === 'focus';
  const completedFocus = wasFocus && elapsed >= phaseDurationMs('focus', p) * 0.5;
  return {
    ...t,
    focusDoneMs: wasFocus ? t.focusDoneMs + elapsed : t.focusDoneMs,
    pomodoros: completedFocus ? t.pomodoros + 1 : t.pomodoros,
    phase: wasFocus ? (completedFocus ? next : 'short') : 'focus',
    phaseElapsedMs: 0,
    running: t.running,
    segmentStart: t.running ? now : null,
  };
}

/** Tiempo restante de la fase actual (ms) en modo pomodoro. */
export function remainingMs(t: TimerState, p: PomodoroSettings, now: number): number {
  return Math.max(0, phaseDurationMs(t.phase, p) - phaseElapsed(t, now));
}
