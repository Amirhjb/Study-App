import { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  ListChecks,
  Play,
  Plus,
  SlidersHorizontal,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { useIndex, useSubjectMap, useToday, subjectColor } from '../lib/hooks';
import { addDaysKey, capitalize, daysBetween, fmt, fmtDuration, fmtNumber } from '../lib/dates';
import {
  computeStreaks,
  dailyGoalSec,
  dayTotal,
  elapsedDays,
  monthRange,
  subjectTotalsInRange,
  sumRange,
  weekRange,
  weeklyForecast,
} from '../lib/stats';
import { dailyBars, legendFrom, subjectDist } from '../lib/chartData';
import { BarChart } from '../charts/BarChart';
import { Legend } from '../charts/common';
import { DistributionBars } from '../charts/Distribution';
import { Heatmap } from '../charts/Heatmap';
import { ExamRow, SessionRow, TaskRow } from '../components/items';
import { Button, Card, CardHeader, Checkbox, Chip, cx, EmptyState, IconButton, Meter, Modal, Ring, Segmented } from '../components/ui';
import type { WidgetId } from '../lib/types';

function greeting(h: number) {
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

const WIDGETS: { id: WidgetId; label: string }[] = [
  { id: 'kpis', label: 'Resumen (hoy, semana, racha, mes)' },
  { id: 'week', label: 'Gráfico de la semana' },
  { id: 'subjects', label: 'Reparto por asignatura' },
  { id: 'heatmap', label: 'Mapa de actividad' },
  { id: 'exams', label: 'Próximos exámenes' },
  { id: 'tasks', label: 'Tareas pendientes' },
  { id: 'goals', label: 'Objetivos semanales por asignatura' },
  { id: 'recent', label: 'Sesiones recientes' },
];

export default function Dashboard() {
  const settings = useStore((s) => s.settings);
  const subjects = useStore((s) => s.subjects);
  const sessions = useStore((s) => s.sessions);
  const tasks = useStore((s) => s.tasks);
  const exams = useStore((s) => s.exams);
  const updateSettings = useStore((s) => s.updateSettings);
  const openModal = useUI((s) => s.openModal);
  const idx = useIndex();
  const map = useSubjectMap();
  const today = useToday();
  const [weekOffset, setWeekOffset] = useState(0);
  const [distRange, setDistRange] = useState<'week' | 'month' | 'all'>('week');
  const [customize, setCustomize] = useState(false);
  const hidden = new Set(settings.hiddenWidgets);
  const show = (id: WidgetId) => !hidden.has(id);

  const todaySec = dayTotal(idx, today);
  const todayGoal = dailyGoalSec(settings, today);
  const streaks = useMemo(() => computeStreaks(idx, settings, today), [idx, settings, today]);
  const forecast = weeklyForecast(idx, settings, today);
  const wr = weekRange(today, settings.weekStartsOn);
  const lastWeekSame = sumRange(idx, addDaysKey(wr.start, -7), addDaysKey(today, -7));
  const mr = monthRange(today);
  const monthSec = sumRange(idx, mr.start, today);
  const pm = monthRange(today, -1);
  const prevMonthSame = sumRange(idx, pm.start, addDaysKey(pm.start, Math.max(0, elapsedDays(mr, today) - 1)));
  const monthDays = elapsedDays(mr, today);

  const chartWeek = weekRange(today, settings.weekStartsOn, weekOffset);
  const weekData = dailyBars(idx, daysBetween(chartWeek.start, chartWeek.end), subjects, map, settings, today, 'EEE');
  const weekTotal = sumRange(idx, chartWeek.start, chartWeek.end);
  const legendItems = legendFrom(weekData, subjects);

  const distTotals = useMemo(() => {
    if (distRange === 'week') return subjectTotalsInRange(idx, wr.start, wr.end);
    if (distRange === 'month') return subjectTotalsInRange(idx, mr.start, mr.end);
    return subjectTotalsInRange(idx, idx.firstDay ?? today, today);
  }, [distRange, idx, wr.start, wr.end, mr.start, mr.end, today]);

  const upcomingExams = exams
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 3);
  const openTasks = tasks
    .filter((t) => t.status !== 'hecha')
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || prio(a.priority) - prio(b.priority))
    .slice(0, 6);
  const recent = [...sessions].sort((a, b) => b.start.localeCompare(a.start)).slice(0, 5);
  const weeklySubjects = subjects.filter((s) => !s.archived && s.weeklyGoalMin);
  const weekBySubject = subjectTotalsInRange(idx, wr.start, wr.end);

  const heatStart = addDaysKey(today, -7 * 26 + 1);
  const heatDays = daysBetween(heatStart, today);
  const heatStudied = heatDays.filter((k) => dayTotal(idx, k) >= 60).length;
  const heatTotal = heatDays.reduce((a, k) => a + dayTotal(idx, k), 0);
  const heatGoalMet = heatDays.filter((k) => dailyGoalSec(settings, k) > 0 && dayTotal(idx, k) >= dailyGoalSec(settings, k)).length;
  const name = settings.userName ? `, ${settings.userName}` : '';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{capitalize(fmt(today, "EEEE, d 'de' MMMM"))}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            {greeting(new Date().getHours())}
            {name} 👋
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <IconButton label="Personalizar panel" onClick={() => setCustomize(true)} className="h-9 w-9 border border-line bg-card">
            <SlidersHorizontal size={17} />
          </IconButton>
          <Button onClick={() => openModal({ kind: 'session' })}>
            <Plus size={16} /> Añadir sesión
          </Button>
          <Button variant="primary" onClick={() => (window.location.hash = '/temporizador')}>
            <Play size={16} /> Empezar a estudiar
          </Button>
        </div>
      </div>

      {sessions.length === 0 && (
        <Card className="mb-6 border-dashed">
          <EmptyState
            icon={<Clock size={28} />}
            title="Aún no has registrado ninguna sesión"
            description="Usa el temporizador mientras estudias o añade tus horas a mano. Aquí verás tu progreso, rachas y estadísticas."
            action={
              <div className="flex gap-2">
                <Button onClick={() => openModal({ kind: 'session' })}>Añadir a mano</Button>
                <Button variant="primary" onClick={() => (window.location.hash = '/temporizador')}>
                  Abrir temporizador
                </Button>
              </div>
            }
          />
        </Card>
      )}

      {show('kpis') && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Hoy */}
          <Card className="flex items-center gap-4 p-5">
            <Ring value={todaySec} max={todayGoal || 1} size={92} stroke={9} color={todayGoal && todaySec >= todayGoal ? 'var(--good)' : 'var(--accent)'}>
              <span className="tabular text-[15px] font-semibold">{todayGoal ? `${Math.min(999, Math.round((todaySec / todayGoal) * 100))}%` : '—'}</span>
            </Ring>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-muted">Hoy</div>
              <div className="text-2xl font-semibold tracking-tight">{fmtDuration(todaySec, { compact: true })}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-2">
                {todayGoal === 0
                  ? 'Día de descanso'
                  : todaySec >= todayGoal
                    ? '¡Objetivo cumplido! 🎉'
                    : `Faltan ${fmtDuration(todayGoal - todaySec, { compact: true })} de ${fmtDuration(todayGoal, { compact: true })}`}
              </div>
            </div>
          </Card>

          {/* Semana */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-muted">Esta semana</span>
              <Delta now={forecast.doneSec} before={lastWeekSame} label="vs. semana pasada" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tracking-tight">{fmtDuration(forecast.doneSec, { compact: true })}</span>
              {forecast.goalSec > 0 && <span className="text-[13px] text-muted">/ {fmtDuration(forecast.goalSec, { compact: true })}</span>}
            </div>
            {forecast.goalSec > 0 && (
              <>
                <Meter value={forecast.doneSec} max={forecast.goalSec} className="mt-2.5" color={forecast.remainingSec === 0 ? 'var(--good)' : 'var(--accent)'} label="Objetivo semanal" />
                <div className="mt-2 text-[12.5px] text-ink-2">
                  {forecast.remainingSec === 0
                    ? '¡Objetivo semanal cumplido!'
                    : `Necesitas ${fmtDuration(forecast.perDaySec, { compact: true })}/día los próximos ${forecast.daysLeft} días`}
                </div>
              </>
            )}
          </Card>

          {/* Racha */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-muted">Racha</span>
              <Flame size={18} className={streaks.current > 0 ? 'text-[#eb6834]' : 'text-muted'} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tracking-tight">{streaks.current}</span>
              <span className="text-[13px] text-muted">{streaks.current === 1 ? 'día' : 'días'} seguidos</span>
            </div>
            <div className="mt-2 flex flex-col gap-0.5 text-[12.5px] text-ink-2">
              <span>Mejor racha: {streaks.best} días</span>
              <span>Objetivo diario cumplido: {streaks.goalCurrent} días seguidos</span>
            </div>
            {streaks.todayPending && streaks.current > 0 && <div className="mt-1.5 text-[12px] font-medium text-accent-ink">Estudia hoy para mantenerla</div>}
          </Card>

          {/* Mes */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-muted">{capitalize(fmt(today, 'MMMM'))}</span>
              <Delta now={monthSec} before={prevMonthSame} label="vs. mes pasado" />
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{fmtDuration(monthSec, { compact: true })}</div>
            <div className="mt-2 flex flex-col gap-0.5 text-[12.5px] text-ink-2">
              <span>Media: {fmtDuration(monthDays ? monthSec / monthDays : 0, { compact: true })}/día</span>
              <span>Total acumulado: {fmtNumber(idx.total / 3600, 0)} h</span>
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {show('week') && (
          <Card className="xl:col-span-2">
            <CardHeader
              title={weekOffset === 0 ? 'Esta semana' : weekOffset === -1 ? 'Semana pasada' : `Semana del ${fmt(chartWeek.start, 'd MMM')}`}
              subtitle={`${fmtDuration(weekTotal)} · la marca gris es el objetivo del día`}
              action={
                <div className="flex items-center gap-1">
                  <IconButton label="Semana anterior" onClick={() => setWeekOffset(weekOffset - 1)}>
                    <ChevronLeft size={18} />
                  </IconButton>
                  <IconButton label="Semana siguiente" disabled={weekOffset >= 0} onClick={() => setWeekOffset(weekOffset + 1)}>
                    <ChevronRight size={18} />
                  </IconButton>
                </div>
              }
            />
            <div className="px-4 pt-3 pb-4">
              <BarChart data={weekData} height={230} showTotalOnTop ariaLabel="Horas de estudio por día" onBarClick={(d) => (window.location.hash = `/sesiones?dia=${d.key}`)} />
              {legendItems.length > 1 && (
                <div className="mt-3 px-2">
                  <Legend items={legendItems} />
                </div>
              )}
            </div>
          </Card>
        )}

        {show('subjects') && (
          <Card>
            <CardHeader
              title="Por asignatura"
              action={
                <Segmented
                  size="sm"
                  value={distRange}
                  onChange={setDistRange}
                  options={[
                    { value: 'week', label: 'Semana' },
                    { value: 'month', label: 'Mes' },
                    { value: 'all', label: 'Todo' },
                  ]}
                />
              }
            />
            <div className="px-4 pt-4 pb-4">
              {[...distTotals.values()].some((v) => v > 0) ? (
                <DistributionBars items={subjectDist(distTotals, map)} />
              ) : (
                <EmptyState title="Sin datos en este periodo" className="py-8" />
              )}
            </div>
          </Card>
        )}

        {show('heatmap') && (
          <Card className="xl:col-span-2">
            <CardHeader title="Actividad" subtitle="Últimos 6 meses · cada cuadro es un día" icon={<CalendarDays size={16} />} />
            <div className="px-5 pt-3 pb-4">
              <Heatmap
                start={heatStart}
                end={today}
                today={today}
                weekStartsOn={settings.weekStartsOn}
                cell={20}
                valueOf={(k) => dayTotal(idx, k)}
                goalOf={(k) => dailyGoalSec(settings, k)}
                onDayClick={(k) => (window.location.hash = `/sesiones?dia=${k}`)}
              />
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
                <MiniStat label="Días con estudio" value={`${heatStudied}`} sub={`de ${heatDays.length}`} />
                <MiniStat label="Objetivo cumplido" value={`${heatGoalMet}`} sub="días" />
                <MiniStat label="Total 6 meses" value={fmtDuration(heatTotal, { compact: true })} sub={`${fmtDuration(heatTotal / heatDays.length, { compact: true })}/día`} />
              </div>
            </div>
          </Card>
        )}

        {show('exams') && (
          <Card>
            <CardHeader
              title="Próximos exámenes"
              icon={<Target size={16} />}
              action={
                <Button size="sm" variant="ghost" onClick={() => openModal({ kind: 'exam' })}>
                  <Plus size={15} /> Añadir
                </Button>
              }
            />
            <div className="px-3 pt-2 pb-3">
              {upcomingExams.length ? (
                upcomingExams.map((e) => <ExamRow key={e.id} exam={e} today={today} />)
              ) : (
                <EmptyState title="No hay exámenes próximos" description="Añade tus exámenes para ver la cuenta atrás y cuánto te has preparado." className="py-8" />
              )}
              {upcomingExams.length > 0 && (
                <a href="#/examenes" className="mt-1 block px-2 text-[13px] font-medium text-accent-ink hover:underline">
                  Ver todos
                </a>
              )}
            </div>
          </Card>
        )}

        {show('tasks') && (
          <Card className="xl:col-span-2">
            <CardHeader
              title="Tareas pendientes"
              subtitle={`${tasks.filter((t) => t.status !== 'hecha').length} por hacer`}
              icon={<ListChecks size={16} />}
              action={
                <Button size="sm" variant="ghost" onClick={() => openModal({ kind: 'task' })}>
                  <Plus size={15} /> Nueva
                </Button>
              }
            />
            <div className="px-3 pt-2 pb-3">
              {openTasks.length ? (
                openTasks.map((t) => <TaskRow key={t.id} task={t} today={today} compact />)
              ) : (
                <EmptyState title="Nada pendiente" description="Apunta deberes, trabajos y proyectos con su fecha de entrega." className="py-8" />
              )}
              {openTasks.length > 0 && (
                <a href="#/tareas" className="mt-1 block px-2 text-[13px] font-medium text-accent-ink hover:underline">
                  Ver todas
                </a>
              )}
            </div>
          </Card>
        )}

        {show('goals') && (
          <Card>
            <CardHeader title="Objetivos de la semana" subtitle="Por asignatura" />
            <div className="flex flex-col gap-3.5 px-5 pt-4 pb-5">
              {weeklySubjects.length === 0 ? (
                <EmptyState
                  title="Sin objetivos por asignatura"
                  description="Ponle un objetivo semanal a cada asignatura desde «Asignaturas»."
                  className="py-4"
                  action={
                    <Button size="sm" onClick={() => (window.location.hash = '/asignaturas')}>
                      Ir a asignaturas
                    </Button>
                  }
                />
              ) : (
                weeklySubjects.map((s) => {
                  const done = weekBySubject.get(s.id) ?? 0;
                  const goal = (s.weeklyGoalMin ?? 0) * 60;
                  return (
                    <div key={s.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: subjectColor(s) }} />
                          <span className="truncate">{s.name}</span>
                        </span>
                        <span className="tabular shrink-0 text-ink-2">
                          {fmtDuration(done, { compact: true })} / {fmtDuration(goal, { compact: true })}
                          {done >= goal && <span className="ml-1 text-good-ink">✓</span>}
                        </span>
                      </div>
                      <Meter value={done} max={goal} color={subjectColor(s)} height={6} label={`Objetivo semanal de ${s.name}`} />
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        )}

        {show('recent') && (
          <Card className="xl:col-span-3">
            <CardHeader
              title="Sesiones recientes"
              icon={<Clock size={16} />}
              action={
                <a href="#/sesiones" className="text-[13px] font-medium text-accent-ink hover:underline">
                  Ver historial
                </a>
              }
            />
            <div className="grid grid-cols-1 gap-x-4 px-3 pt-2 pb-3 md:grid-cols-2">
              {recent.length ? recent.map((s) => <SessionRow key={s.id} session={s} showDate />) : <EmptyState title="Sin sesiones todavía" className="py-6 md:col-span-2" />}
            </div>
          </Card>
        )}
      </div>

      <Modal open={customize} onClose={() => setCustomize(false)} title="Personalizar panel" size="sm" footer={<Button variant="primary" onClick={() => setCustomize(false)}>Listo</Button>}>
        <p className="mb-3 text-sm text-ink-2">Elige qué bloques quieres ver en el panel.</p>
        <div className="flex flex-col gap-2.5">
          {WIDGETS.map((w) => (
            <Checkbox
              key={w.id}
              label={w.label}
              checked={!hidden.has(w.id)}
              onChange={(v) =>
                updateSettings({
                  hiddenWidgets: v ? settings.hiddenWidgets.filter((x) => x !== w.id) : [...settings.hiddenWidgets, w.id],
                })
              }
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-lg font-semibold tracking-tight">{value}</span>
        <span className="text-[12px] text-muted">{sub}</span>
      </div>
    </div>
  );
}

function prio(p: string) {
  return p === 'alta' ? 0 : p === 'media' ? 1 : 2;
}

/** Variación respecto al periodo anterior, con icono + signo (nunca solo color). */
export function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  if (before <= 0 && now <= 0) return null;
  if (before <= 0) return <Chip tone="good">Nuevo</Chip>;
  const pct = ((now - before) / before) * 100;
  const up = pct >= 0;
  return (
    <span
      title={label}
      className={cx('inline-flex items-center gap-1 text-[12px] font-medium', up ? 'text-good-ink' : 'text-critical-ink')}
    >
      {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      {up ? '+' : '−'}
      {fmtNumber(Math.abs(pct), 0)}%
    </span>
  );
}
