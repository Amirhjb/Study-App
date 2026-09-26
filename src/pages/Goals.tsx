import { useMemo } from 'react';
import {
  Award,
  Check,
  Clock,
  Crown,
  Flame,
  Gem,
  GraduationCap,
  Moon,
  Mountain,
  NotebookPen,
  Rocket,
  Sunrise,
  Target,
  Timer,
  Zap,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useIndex, useSubjectMap, useToday } from '../lib/hooks';
import { addDaysKey, capitalize, daysBetween, fmt, fmtDuration, fmtNumber, orderedWeekdays, WEEKDAYS_LONG } from '../lib/dates';
import { computeStreaks, dailyGoalSec, dayTotal, weekRange, weeklyForecast } from '../lib/stats';
import { computeBadges, type BadgeIcon } from '../lib/achievements';
import { weeklyBars } from '../lib/chartData';
import { BarChart } from '../charts/BarChart';
import { Card, CardHeader, cx, Input, Meter, PageHeader } from '../components/ui';

const ICONS: Record<BadgeIcon, React.ComponentType<{ size?: number }>> = {
  rocket: Rocket,
  clock: Clock,
  flame: Flame,
  sunrise: Sunrise,
  moon: Moon,
  mountain: Mountain,
  zap: Zap,
  timer: Timer,
  target: Target,
  crown: Crown,
  check: Check,
  grad: GraduationCap,
  note: NotebookPen,
  gem: Gem,
};

export default function Goals() {
  const data = useStore();
  const { settings, updateSettings } = data;
  const subjects = useStore((s) => s.subjects);
  const idx = useIndex();
  const map = useSubjectMap();
  const today = useToday();
  const streaks = computeStreaks(idx, settings, today);
  const forecast = weeklyForecast(idx, settings, today);
  const badges = useMemo(
    () => computeBadges(data, idx, today),
    [data.sessions, data.tasks, data.exams, data.notes, data.settings, idx, today],
  );
  const earned = badges.filter((b) => b.earned).length;

  const wr = weekRange(today, settings.weekStartsOn);
  const histStart = addDaysKey(wr.start, -7 * 11);
  const weeks = weeklyBars(idx, histStart, wr.end, subjects, map, settings, today).map((d) => ({
    ...d,
    segments: [{ key: 't', name: 'Total', color: 'var(--accent)', value: d.segments.reduce((a, s) => a + s.value, 0) }],
  }));
  const weeksMet = weeks.slice(0, -1).filter((w) => w.goal && w.segments[0].value >= w.goal).length;
  const last30 = daysBetween(addDaysKey(today, -29), today);
  const met30 = last30.filter((k) => dailyGoalSec(settings, k) > 0 && dayTotal(idx, k) >= dailyGoalSec(settings, k)).length;
  const goalDays30 = last30.filter((k) => dailyGoalSec(settings, k) > 0).length;
  const sumDaily = settings.dailyGoals.reduce((a, b) => a + b, 0);

  const setDaily = (wd: number, hours: string) => {
    const v = Math.max(0, Math.min(24, Number(hours.replace(',', '.')) || 0));
    const next = settings.dailyGoals.slice();
    next[wd] = Math.round(v * 60);
    updateSettings({ dailyGoals: next });
  };

  return (
    <div>
      <PageHeader title="Objetivos y logros" subtitle="Marca tus metas de estudio y desbloquea logros cumpliéndolas." />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
            <Flame size={16} className="text-[#eb6834]" /> Racha actual
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">{streaks.current} días</div>
          <div className="mt-1 text-[12.5px] text-ink-2">Mejor: {streaks.best} días · los días con objetivo 0 no rompen la racha</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
            <Target size={16} /> Objetivo diario (últimos 30 días)
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">
            {met30}
            <span className="text-lg font-normal text-muted"> / {goalDays30} días</span>
          </div>
          <div className="mt-2 flex gap-[3px]" aria-label="Días con el objetivo cumplido">
            {last30.map((k) => {
              const g = dailyGoalSec(settings, k);
              const met = g > 0 && dayTotal(idx, k) >= g;
              return (
                <span
                  key={k}
                  title={`${capitalize(fmt(k, 'EEE d MMM'))}: ${g === 0 ? 'descanso' : met ? 'cumplido' : 'no cumplido'}`}
                  className="h-4 flex-1 rounded-[2px]"
                  style={{ background: g === 0 ? 'transparent' : met ? 'var(--good)' : 'var(--grid)', outline: g === 0 ? '1px solid var(--line)' : undefined }}
                />
              );
            })}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
            <Award size={16} /> Logros
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">
            {earned}
            <span className="text-lg font-normal text-muted"> / {badges.length}</span>
          </div>
          <Meter value={earned} max={badges.length} className="mt-2.5" label="Logros desbloqueados" />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Objetivo diario" subtitle="Horas por día de la semana (0 = descanso)" />
          <div className="flex flex-col gap-2 px-5 pt-4 pb-5">
            {orderedWeekdays(settings.weekStartsOn).map((wd) => (
              <div key={wd} className="flex items-center justify-between gap-3">
                <label htmlFor={`goal-${wd}`} className="text-sm">
                  {WEEKDAYS_LONG[wd]}
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`goal-${wd}`}
                    type="number"
                    min={0}
                    max={24}
                    step={0.25}
                    value={(settings.dailyGoals[wd] ?? 0) / 60}
                    onChange={(e) => setDaily(wd, e.target.value)}
                    className="w-24 text-right"
                  />
                  <span className="w-4 text-[13px] text-muted">h</span>
                </div>
              </div>
            ))}
            <div className="mt-3 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="goal-week" className="text-sm font-medium">
                  Objetivo semanal
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="goal-week"
                    type="number"
                    min={0}
                    step={0.5}
                    value={settings.weeklyGoalMin / 60}
                    onChange={(e) => updateSettings({ weeklyGoalMin: Math.max(0, Math.round((Number(e.target.value) || 0) * 60)) })}
                    className="w-24 text-right"
                  />
                  <span className="w-4 text-[13px] text-muted">h</span>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-muted">
                La suma de tus objetivos diarios es {fmtNumber(sumDaily / 60)} h.{' '}
                {sumDaily !== settings.weeklyGoalMin && (
                  <button className="font-medium text-accent-ink hover:underline" onClick={() => updateSettings({ weeklyGoalMin: sumDaily })}>
                    Usar como objetivo semanal
                  </button>
                )}
              </p>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Últimas 12 semanas"
            subtitle={`Objetivo semanal cumplido ${weeksMet} de 11 semanas completas · esta semana: ${fmtDuration(forecast.doneSec, { compact: true })} de ${fmtDuration(forecast.goalSec, { compact: true })}`}
          />
          <div className="px-4 pt-3 pb-4">
            <BarChart data={weeks} height={240} showTotalOnTop ariaLabel="Horas por semana frente al objetivo" />
            <p className="mt-2 px-2 text-[12px] text-muted">La marca gris sobre cada barra es tu objetivo semanal.</p>
          </div>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader title="Sala de trofeos" subtitle={`${earned} logros desbloqueados`} />
          <div className="grid grid-cols-2 gap-3 px-5 pt-4 pb-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {badges.map((b) => {
              const Icon = ICONS[b.icon];
              return (
                <div
                  key={b.id}
                  className={cx('flex flex-col items-center rounded-xl border p-3 text-center', b.earned ? 'border-accent/30 bg-accent-soft' : 'border-line bg-card-2')}
                  title={b.description}
                >
                  <div
                    className={cx(
                      'flex h-12 w-12 items-center justify-center rounded-full',
                      b.earned ? 'bg-accent text-on-accent' : 'bg-[var(--grid)] text-muted',
                    )}
                  >
                    <Icon size={22} />
                  </div>
                  <div className={cx('mt-2 text-[13px] font-semibold', !b.earned && 'text-ink-2')}>{b.title}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-muted">{b.description}</div>
                  {!b.earned && b.goal > 1 && (
                    <div className="mt-2 w-full">
                      <Meter value={b.value} max={b.goal} height={4} color="var(--muted)" label={`Progreso de ${b.title}`} />
                      <div className="tabular mt-1 text-[11px] text-muted">
                        {fmtNumber(b.value, b.goal < 10 ? 1 : 0)} / {b.goal}
                      </div>
                    </div>
                  )}
                  {b.earned && <div className="mt-1.5 text-[11px] font-medium text-accent-ink">✓ Conseguido</div>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
