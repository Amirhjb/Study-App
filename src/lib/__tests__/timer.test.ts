import { describe, expect, it } from 'vitest';
import { advance, focusMs, initialTimer, pause, remainingMs, skipPhase, start } from '../timer';
import type { PomodoroSettings } from '../types';

const p: PomodoroSettings = { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longEvery: 4, autoStartBreaks: true, autoStartFocus: false };
const MIN = 60_000;

describe('temporizador pomodoro', () => {
  it('cuenta el tiempo de enfoque y respeta las pausas', () => {
    let t = start({ ...initialTimer }, 0);
    t = pause(t, 10 * MIN);
    expect(focusMs(t, 50 * MIN)).toBe(10 * MIN);
    t = start(t, 60 * MIN);
    expect(focusMs(t, 65 * MIN)).toBe(15 * MIN);
    expect(remainingMs(t, p, 65 * MIN)).toBe(10 * MIN);
  });

  it('pasa al descanso y se detiene al acabarlo si no hay inicio automático', () => {
    const t0 = start({ ...initialTimer }, 0);
    // 40 min después: 25 de enfoque + 5 de descanso (auto) y parado en el siguiente enfoque
    const { timer, events } = advance(t0, p, 40 * MIN);
    expect(events.map((e) => e.ended)).toEqual(['focus', 'short']);
    expect(timer.phase).toBe('focus');
    expect(timer.running).toBe(false);
    expect(timer.pomodoros).toBe(1);
    expect(focusMs(timer, 40 * MIN)).toBe(25 * MIN);
  });

  it('el cuarto pomodoro lleva a un descanso largo', () => {
    const t0 = { ...start({ ...initialTimer }, 0), pomodoros: 3 };
    const { timer } = advance(t0, p, 26 * MIN);
    expect(timer.phase).toBe('long');
    expect(timer.pomodoros).toBe(4);
  });

  it('saltar un enfoque conserva el tiempo estudiado', () => {
    const t0 = start({ ...initialTimer }, 0);
    const t = skipPhase(t0, p, 20 * MIN);
    expect(t.phase).toBe('short');
    expect(t.pomodoros).toBe(1);
    expect(focusMs(t, 21 * MIN)).toBe(20 * MIN);
  });
});

describe('cronómetro', () => {
  it('no cambia de fase', () => {
    const t0 = start({ ...initialTimer, mode: 'stopwatch' }, 0);
    const { timer, events } = advance(t0, p, 120 * MIN);
    expect(events).toHaveLength(0);
    expect(focusMs(timer, 120 * MIN)).toBe(120 * MIN);
  });
});
