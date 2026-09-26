import { Pause, Play } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useNow, useSubjectMap, subjectColor } from '../lib/hooks';
import { fmtClock } from '../lib/dates';
import { focusMs, pause, remainingMs, start } from '../lib/timer';
import { unlockAudio } from '../lib/sound';
import { cx } from './ui';

/** Temporizador compacto que se ve desde cualquier página mientras hay una sesión. */
export function MiniTimer({ onOpen, compact }: { onOpen: () => void; compact?: boolean }) {
  const timer = useStore((s) => s.timer);
  const pomodoro = useStore((s) => s.settings.pomodoro);
  const setTimer = useStore((s) => s.setTimer);
  const subjects = useSubjectMap();
  const now = useNow(1000, timer.sessionStart !== null);
  if (!timer.sessionStart) return compact ? <span className="w-9" /> : null;

  const subject = timer.subjectId ? subjects.get(timer.subjectId) : null;
  const clock =
    timer.mode === 'pomodoro' ? fmtClock(remainingMs(timer, pomodoro, now)) : fmtClock(focusMs(timer, now));
  const phase = timer.mode === 'pomodoro' ? (timer.phase === 'focus' ? 'Enfoque' : 'Descanso') : 'Cronómetro';
  const toggle = () => {
    unlockAudio();
    setTimer((t) => (t.running ? pause(t, Date.now()) : start(t, Date.now())));
  };

  if (compact) {
    return (
      <button
        onClick={onOpen}
        className="tabular flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1.5 text-sm font-semibold text-accent-ink"
      >
        <span className={cx('h-2 w-2 rounded-full', timer.running ? 'animate-pulse' : 'opacity-50')} style={{ background: subjectColor(subject) }} />
        {clock}
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-card-2 p-3">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className={cx('h-2 w-2 rounded-full', timer.running && 'animate-pulse')} style={{ background: subjectColor(subject) }} />
          <span className="truncate">{subject?.name ?? 'Sin asignatura'}</span>
          <span className="ml-auto">{phase}</span>
        </div>
        <div className="tabular mt-1 text-2xl font-semibold tracking-tight">{clock}</div>
      </button>
      <button
        onClick={toggle}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-card py-1.5 text-[13px] font-medium ring-1 ring-line hover:bg-hover"
      >
        {timer.running ? <Pause size={14} /> : <Play size={14} />}
        {timer.running ? 'Pausar' : 'Reanudar'}
      </button>
    </div>
  );
}
