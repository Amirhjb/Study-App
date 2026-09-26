import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { advance, focusMs, remainingMs } from '../lib/timer';
import { fmtClock } from '../lib/dates';
import { chime, notify } from '../lib/sound';

const BASE_TITLE = 'Studium';

/**
 * Motor global del temporizador: cada segundo cierra las fases del pomodoro que
 * hayan terminado (sonido + aviso) y actualiza el título de la pestaña.
 */
export function TimerEngine() {
  useEffect(() => {
    const tick = () => {
      const { timer, settings, setTimer } = useStore.getState();
      const now = Date.now();
      const { timer: next, events } = advance(timer, settings.pomodoro, now);
      if (events.length > 0) {
        setTimer(() => next);
        const last = events[events.length - 1];
        const fresh = now - last.at < 5000;
        if (fresh && settings.sound) chime(last.ended === 'focus' ? 'focus-end' : 'break-end');
        const msg =
          last.ended === 'focus'
            ? last.next === 'long'
              ? '¡Pomodoro completado! Tómate un descanso largo.'
              : '¡Pomodoro completado! Toca descansar.'
            : 'Fin del descanso. ¡A por otro pomodoro!';
        if (fresh) {
          useUI.getState().toast(msg);
          if (settings.notifications) notify('Studium', msg);
        }
      }
      const t = events.length > 0 ? next : timer;
      if (t.sessionStart) {
        const label =
          t.mode === 'pomodoro'
            ? `${fmtClock(remainingMs(t, settings.pomodoro, now))} · ${t.phase === 'focus' ? 'Enfoque' : 'Descanso'}`
            : fmtClock(focusMs(t, now));
        document.title = `${t.running ? '▶' : '❚❚'} ${label} — ${BASE_TITLE}`;
      } else if (!document.title.startsWith(BASE_TITLE)) {
        document.title = BASE_TITLE;
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    const onVis = () => tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return null;
}
