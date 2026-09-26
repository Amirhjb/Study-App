import { Coffee, Maximize2, Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { useNow, useSubjectMap, subjectColor, useIndex, useToday } from '../lib/hooks';
import { fmtClock, fmtDuration } from '../lib/dates';
import { dailyGoalSec, dayTotal } from '../lib/stats';
import { focusMs, pause, phaseDurationMs, phaseElapsed, remainingMs, resetSession, skipPhase, start } from '../lib/timer';
import { unlockAudio } from '../lib/sound';
import { ActivitySelect, SubjectSelect } from './forms';
import { Button, ConfirmDialog, cx, Field, Ring, Segmented, Select } from './ui';
import type { TimerMode } from '../lib/types';
import { useState } from 'react';

export function useTimerView() {
  const timer = useStore((s) => s.timer);
  const settings = useStore((s) => s.settings);
  const now = useNow(250, timer.running);
  const p = settings.pomodoro;
  const focus = focusMs(timer, now);
  const isPomo = timer.mode === 'pomodoro';
  const phaseTotal = isPomo ? phaseDurationMs(timer.phase, p) : 0;
  const clock = isPomo ? remainingMs(timer, p, now) : focus;
  const progress = isPomo ? phaseElapsed(timer, now) / phaseTotal : 0;
  return { timer, settings, now, focus, isPomo, clock, progress };
}

export function timerActions() {
  const { setTimer, settings } = useStore.getState();
  return {
    toggle: () => {
      unlockAudio();
      setTimer((t) => (t.running ? pause(t, Date.now()) : start(t, Date.now())));
    },
    skip: () => setTimer((t) => skipPhase(t, settings.pomodoro, Date.now())),
    reset: () => setTimer((t) => resetSession(t)),
    finish: () => useUI.getState().openModal({ kind: 'finish' }),
  };
}

export const PHASE_LABEL = { focus: 'Enfoque', short: 'Descanso corto', long: 'Descanso largo' } as const;

export function TimerPanel() {
  const { timer, settings, focus, isPomo, clock, progress } = useTimerView();
  const setTimer = useStore((s) => s.setTimer);
  const tasks = useStore((s) => s.tasks);
  const subjects = useSubjectMap();
  const idx = useIndex();
  const today = useToday();
  const setFocusMode = useUI((s) => s.setFocusMode);
  const actions = timerActions();
  const subject = timer.subjectId ? subjects.get(timer.subjectId) : null;
  const color = subjectColor(subject);
  const active = timer.sessionStart !== null;
  const goal = dailyGoalSec(settings, today);
  const todaySec = dayTotal(idx, today) + focus / 1000;
  const openTasks = tasks.filter((t) => t.status !== 'hecha' && (!timer.subjectId || t.subjectId === timer.subjectId));
  const cycle = Math.max(1, settings.pomodoro.longEvery);
  const inCycle = timer.pomodoros % cycle;
  const onBreak = isPomo && timer.phase !== 'focus';
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="flex flex-col items-center">
      <Segmented<TimerMode>
        value={timer.mode}
        onChange={(m) => !active && setTimer((t) => ({ ...t, mode: m, phase: 'focus', phaseElapsedMs: 0 }))}
        options={[
          { value: 'pomodoro', label: 'Pomodoro' },
          { value: 'stopwatch', label: 'Cronómetro' },
        ]}
      />
      {active && <p className="mt-1.5 text-xs text-muted">Termina la sesión para cambiar de modo.</p>}

      <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Asignatura">
          {(id) => <SubjectSelect id={id} value={timer.subjectId} onChange={(v) => setTimer((t) => ({ ...t, subjectId: v, taskId: null }))} />}
        </Field>
        <Field label="Actividad">
          {(id) => <ActivitySelect id={id} value={timer.activityId} onChange={(v) => setTimer((t) => ({ ...t, activityId: v }))} />}
        </Field>
        <Field label="Tarea">
          {(id) => (
            <Select id={id} value={timer.taskId ?? ''} onChange={(e) => setTimer((t) => ({ ...t, taskId: e.target.value || null }))}>
              <option value="">Ninguna</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="mt-8">
        <Ring
          value={isPomo ? progress : goal > 0 ? todaySec : 0}
          max={isPomo ? 1 : goal || 1}
          size={272}
          stroke={12}
          color={onBreak ? 'var(--s2)' : color === 'var(--s-none)' ? 'var(--accent)' : color}
        >
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
            {onBreak && <Coffee size={15} />}
            {isPomo ? PHASE_LABEL[timer.phase] : 'Cronómetro'}
          </div>
          <div className="tabular mt-1 text-[56px] leading-none font-semibold tracking-tight">{fmtClock(clock)}</div>
          <div className="mt-2 text-[13px] text-muted">
            {isPomo ? `Estudiado: ${fmtClock(focus)}` : goal > 0 ? `Hoy ${fmtDuration(todaySec)} de ${fmtDuration(goal)}` : `Hoy ${fmtDuration(todaySec)}`}
          </div>
        </Ring>
      </div>

      {isPomo && (
        <div className="mt-4 flex items-center gap-1.5" aria-label={`${inCycle} de ${cycle} pomodoros del ciclo`}>
          {Array.from({ length: cycle }).map((_, i) => (
            <span
              key={i}
              className={cx('h-2.5 w-2.5 rounded-full', i < inCycle ? '' : 'bg-[var(--grid)]')}
              style={i < inCycle ? { background: color === 'var(--s-none)' ? 'var(--accent)' : color } : undefined}
            />
          ))}
          <span className="ml-2 text-xs text-muted">
            {timer.pomodoros} pomodoro{timer.pomodoros === 1 ? '' : 's'}
          </span>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {active && (
          <Button variant="ghost" onClick={() => setConfirmReset(true)} title="Reiniciar (descarta el tiempo)" aria-label="Reiniciar">
            <RotateCcw size={18} />
          </Button>
        )}
        <Button variant="primary" size="lg" className="min-w-40" onClick={actions.toggle}>
          {timer.running ? <Pause size={18} /> : <Play size={18} />}
          {timer.running ? 'Pausar' : active ? 'Reanudar' : 'Empezar'}
        </Button>
        {active && (
          <Button size="lg" onClick={actions.finish}>
            <Square size={16} /> Terminar
          </Button>
        )}
        {isPomo && active && (
          <Button variant="ghost" onClick={actions.skip} title="Saltar fase" aria-label="Saltar fase">
            <SkipForward size={18} />
          </Button>
        )}
        <Button variant="ghost" onClick={() => setFocusMode(true)} title="Modo concentración (pantalla completa)" aria-label="Modo concentración">
          <Maximize2 size={18} />
        </Button>
      </div>
      <ConfirmDialog
        open={confirmReset}
        title="Reiniciar temporizador"
        message="Se descartará el tiempo de esta sesión sin guardarlo. Si quieres guardarlo, usa «Terminar»."
        confirmLabel="Reiniciar"
        onClose={() => setConfirmReset(false)}
        onConfirm={actions.reset}
      />
    </div>
  );
}
