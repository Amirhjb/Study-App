import { useEffect } from 'react';
import { Coffee, Minimize2, Pause, Play, SkipForward, Square } from 'lucide-react';
import { useUI } from '../store/ui';
import { useSubjectMap } from '../lib/hooks';
import { fmtClock } from '../lib/dates';
import { PHASE_LABEL, timerActions, useTimerView } from './TimerPanel';

/** Modo concentración: pantalla completa, solo el reloj. */
export function FocusOverlay() {
  const open = useUI((s) => s.focusMode);
  const setOpen = useUI((s) => s.setFocusMode);

  useEffect(() => {
    if (!open) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        timerActions().toggle();
      }
    };
    const onFs = () => {
      if (!document.fullscreenElement) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [open, setOpen]);

  if (!open) return null;
  return <FocusContent onClose={() => setOpen(false)} />;
}

function FocusContent({ onClose }: { onClose: () => void }) {
  const { timer, isPomo, clock, focus, progress } = useTimerView();
  const subjects = useSubjectMap();
  const subject = timer.subjectId ? subjects.get(timer.subjectId) : null;
  const a = timerActions();
  const onBreak = isPomo && timer.phase !== 'focus';
  const active = timer.sessionStart !== null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#0b0b0f] text-white">
      <button
        onClick={onClose}
        className="absolute top-5 right-5 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white"
      >
        <Minimize2 size={16} /> Salir
      </button>
      <div className="flex items-center gap-2 text-lg text-white/60">
        {onBreak && <Coffee size={18} />}
        {isPomo ? PHASE_LABEL[timer.phase] : 'Cronómetro'}
        {subject && <span>· {subject.name}</span>}
      </div>
      <div className="tabular mt-2 text-[22vw] leading-none font-semibold tracking-tight sm:text-[160px]">{fmtClock(clock)}</div>
      {isPomo && (
        <div className="mt-6 h-1.5 w-72 max-w-[80vw] overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white/80 transition-[width] duration-300" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      )}
      {isPomo && <div className="mt-3 text-sm text-white/50">Estudiado en esta sesión: {fmtClock(focus)}</div>}
      <div className="mt-10 flex items-center gap-3">
        <button
          onClick={a.toggle}
          className="flex h-14 min-w-44 items-center justify-center gap-2 rounded-full bg-white px-6 text-base font-semibold text-black hover:bg-white/90"
        >
          {timer.running ? <Pause size={20} /> : <Play size={20} />}
          {timer.running ? 'Pausar' : active ? 'Reanudar' : 'Empezar'}
        </button>
        {isPomo && active && (
          <button onClick={a.skip} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Saltar fase">
            <SkipForward size={20} />
          </button>
        )}
        {active && (
          <button
            onClick={() => {
              onClose();
              a.finish();
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Terminar sesión"
          >
            <Square size={18} />
          </button>
        )}
      </div>
      <p className="absolute bottom-6 text-xs text-white/40">Espacio: pausar / reanudar · Esc: salir</p>
    </div>
  );
}
