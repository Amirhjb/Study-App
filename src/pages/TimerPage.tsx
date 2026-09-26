import { Bell, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { useIndex, useToday } from '../lib/hooks';
import { fmtDuration } from '../lib/dates';
import { dailyGoalSec, dayTotal } from '../lib/stats';
import { TimerPanel } from '../components/TimerPanel';
import { SessionRow } from '../components/items';
import { Button, Card, CardHeader, Checkbox, EmptyState, Field, Input, Meter, PageHeader } from '../components/ui';
import { toKey } from '../lib/dates';

export default function TimerPage() {
  const settings = useStore((s) => s.settings);
  const sessions = useStore((s) => s.sessions);
  const updateSettings = useStore((s) => s.updateSettings);
  const running = useStore((s) => s.timer.sessionStart !== null);
  const openModal = useUI((s) => s.openModal);
  const idx = useIndex();
  const today = useToday();
  const p = settings.pomodoro;
  const todaySec = dayTotal(idx, today);
  const goal = dailyGoalSec(settings, today);
  const todaySessions = sessions
    .filter((s) => toKey(new Date(s.start)) === today)
    .sort((a, b) => b.start.localeCompare(a.start));

  const setP = (patch: Partial<typeof p>) => updateSettings({ pomodoro: { ...p, ...patch } });
  const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || min)));

  return (
    <div>
      <PageHeader
        title="Temporizador"
        subtitle="Cronometra tus sesiones o usa la técnica Pomodoro. El tiempo se guarda aunque cierres la pestaña."
        actions={
          <Button onClick={() => openModal({ kind: 'session' })}>
            <Plus size={16} /> Añadir sesión a mano
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="px-5 py-8 xl:col-span-2">
          <TimerPanel />
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Hoy" subtitle={goal ? `Objetivo: ${fmtDuration(goal)}` : 'Día de descanso'} />
            <div className="px-5 pt-3 pb-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tracking-tight">{fmtDuration(todaySec, { compact: true })}</span>
                {goal > 0 && <span className="tabular text-[13px] text-muted">{Math.round((todaySec / goal) * 100)}%</span>}
              </div>
              {goal > 0 && <Meter value={todaySec} max={goal} className="mt-2" color={todaySec >= goal ? 'var(--good)' : 'var(--accent)'} label="Progreso de hoy" />}
            </div>
            <div className="px-3 pb-3">
              {todaySessions.length ? (
                todaySessions.map((s) => <SessionRow key={s.id} session={s} />)
              ) : (
                <EmptyState title="Todavía no has estudiado hoy" className="py-5" />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Ajustes del pomodoro" subtitle={running ? 'Los cambios se aplican a la fase siguiente' : undefined} />
            <div className="grid grid-cols-3 gap-3 px-5 pt-4">
              <Field label="Enfoque">
                {(id) => <Input id={id} type="number" min={1} max={180} value={p.focusMin} onChange={(e) => setP({ focusMin: num(e.target.value, 1, 180) })} />}
              </Field>
              <Field label="Descanso">
                {(id) => <Input id={id} type="number" min={1} max={60} value={p.shortBreakMin} onChange={(e) => setP({ shortBreakMin: num(e.target.value, 1, 60) })} />}
              </Field>
              <Field label="Largo">
                {(id) => <Input id={id} type="number" min={1} max={90} value={p.longBreakMin} onChange={(e) => setP({ longBreakMin: num(e.target.value, 1, 90) })} />}
              </Field>
            </div>
            <div className="flex flex-col gap-2.5 px-5 pt-4 pb-5">
              <Field label="Descanso largo cada (pomodoros)">
                {(id) => <Input id={id} type="number" min={2} max={10} value={p.longEvery} onChange={(e) => setP({ longEvery: num(e.target.value, 2, 10) })} className="w-24" />}
              </Field>
              <Checkbox checked={p.autoStartBreaks} onChange={(v) => setP({ autoStartBreaks: v })} label="Empezar los descansos automáticamente" />
              <Checkbox checked={p.autoStartFocus} onChange={(v) => setP({ autoStartFocus: v })} label="Empezar el siguiente pomodoro automáticamente" />
              <Checkbox checked={settings.sound} onChange={(v) => updateSettings({ sound: v })} label="Sonido al terminar cada fase" />
              {typeof Notification !== 'undefined' && (
                <Checkbox
                  checked={settings.notifications}
                  onChange={async (v) => {
                    if (v && Notification.permission !== 'granted') {
                      const r = await Notification.requestPermission();
                      if (r !== 'granted') return;
                    }
                    updateSettings({ notifications: v });
                  }}
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Bell size={14} /> Notificaciones del navegador
                    </span>
                  }
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
