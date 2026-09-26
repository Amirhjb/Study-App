import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Table2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { subjectColor, useSubjectMap, useToday } from '../lib/hooks';
import {
  addDaysKey,
  capitalize,
  daysBetween,
  diffDays,
  fmt,
  fmtDuration,
  fmtNumber,
  orderedWeekdays,
  toKey,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
  weekStartKey,
} from '../lib/dates';
import {
  activityTotalsInRange,
  buildIndex,
  dailyGoalSec,
  dayTotal,
  hoursInRange,
  monthRange,
  NO_ACTIVITY,
  NO_SUBJECT,
  subjectTotalsInRange,
  weekdayTotals,
  weekRange,
  yearRange,
  type Range,
} from '../lib/stats';
import { activityDist, dailyBars, legendFrom, monthlyBars, subjectDist, weeklyBars } from '../lib/chartData';
import { BarChart, type BarDatum } from '../charts/BarChart';
import { LineChart } from '../charts/LineChart';
import { DistributionBars } from '../charts/Distribution';
import { Heatmap } from '../charts/Heatmap';
import { Matrix } from '../charts/Matrix';
import { Legend } from '../charts/common';
import { SubjectSelect } from '../components/forms';
import { Card, CardHeader, cx, EmptyState, IconButton, Input, PageHeader, Segmented, Stars } from '../components/ui';

type Preset = 'week' | 'month' | 'semester' | 'year' | 'all' | 'custom';

export default function Stats() {
  const settings = useStore((s) => s.settings);
  const allSessions = useStore((s) => s.sessions);
  const subjects = useStore((s) => s.subjects);
  const semesters = useStore((s) => s.semesters);
  const activities = useStore((s) => s.activities);
  const map = useSubjectMap();
  const today = useToday();
  const [preset, setPreset] = useState<Preset>('month');
  const [offset, setOffset] = useState(0);
  const [subject, setSubject] = useState<string | null>(null);
  const [custom, setCustom] = useState<Range>({ start: addDaysKey(today, -29), end: today });
  const [table, setTable] = useState(false);

  const sessions = useMemo(
    () => (subject ? allSessions.filter((s) => s.subjectId === subject) : allSessions),
    [allSessions, subject],
  );
  const idx = useMemo(() => buildIndex(sessions), [sessions]);

  const sortedSem = [...semesters].sort((a, b) => a.start.localeCompare(b.start));
  const curSemIdx = Math.max(
    0,
    sortedSem.findIndex((s) => s.id === settings.currentSemesterId),
  );

  const range: Range = useMemo(() => {
    switch (preset) {
      case 'week':
        return weekRange(today, settings.weekStartsOn, offset);
      case 'month':
        return monthRange(today, offset);
      case 'year':
        return yearRange(today, offset);
      case 'semester': {
        const s = sortedSem[curSemIdx + offset];
        return s ? { start: s.start, end: s.end } : monthRange(today, 0);
      }
      case 'all':
        return { start: idx.firstDay ?? today, end: today };
      case 'custom':
        return custom.start <= custom.end ? custom : { start: custom.end, end: custom.start };
    }
  }, [preset, offset, today, settings.weekStartsOn, idx.firstDay, custom, semesters, curSemIdx]);

  const semName = preset === 'semester' ? sortedSem[curSemIdx + offset]?.name : null;
  const canPrev = preset === 'semester' ? curSemIdx + offset > 0 : ['week', 'month', 'year'].includes(preset);
  const canNext = preset === 'semester' ? curSemIdx + offset < sortedSem.length - 1 : ['week', 'month', 'year'].includes(preset) && offset < 0;

  // Días del rango que ya han pasado (para medias).
  const lastDay = range.end < today ? range.end : today;
  const effDays = range.start > today ? [] : daysBetween(range.start, lastDay);
  const allDays = daysBetween(range.start, range.end);
  const total = effDays.reduce((a, k) => a + dayTotal(idx, k), 0);
  const studiedDays = effDays.filter((k) => dayTotal(idx, k) >= 60).length;
  const sessionsInRange = sessions.filter((s) => {
    const k = toKey(new Date(s.start));
    return k >= range.start && k <= range.end;
  });
  const avgSession = sessionsInRange.length ? total / sessionsInRange.length : 0;
  const rated = sessionsInRange.filter((s) => s.rating > 0);
  const avgRating = rated.length ? rated.reduce((a, s) => a + s.rating, 0) / rated.length : 0;
  const goalDays = effDays.filter((k) => dailyGoalSec(settings, k) > 0);
  const metDays = subject ? 0 : goalDays.filter((k) => dayTotal(idx, k) >= dailyGoalSec(settings, k)).length;
  let bestDay = { key: '', sec: 0 };
  for (const k of effDays) {
    const v = dayTotal(idx, k);
    if (v > bestDay.sec) bestDay = { key: k, sec: v };
  }

  // Periodo anterior de la misma longitud para comparar.
  const len = diffDays(range.end, range.start) + 1;
  const prevTotal = useMemo(() => {
    const pStart = addDaysKey(range.start, -len);
    const pEnd = addDaysKey(range.start, -1);
    const elapsed = effDays.length;
    const pLast = addDaysKey(pStart, Math.max(0, elapsed - 1));
    return daysBetween(pStart, pLast < pEnd ? pLast : pEnd).reduce((a, k) => a + dayTotal(idx, k), 0);
  }, [range.start, len, effDays.length, idx]);

  // Datos del gráfico de tiempo según la longitud del rango.
  const gran: 'day' | 'week' | 'month' = len <= 35 ? 'day' : len <= 190 ? 'week' : 'month';
  const timeData: BarDatum[] = useMemo(() => {
    if (gran === 'day') return dailyBars(idx, allDays, subjects, map, settings, today, len <= 7 ? 'EEE' : 'd', !subject);
    if (gran === 'week') return weeklyBars(idx, range.start, range.end, subjects, map, settings, today).map((d) => (subject ? { ...d, goal: undefined } : d));
    return monthlyBars(idx, range.start, range.end, subjects, map, today);
  }, [gran, idx, range.start, range.end, subjects, map, settings, today, subject]);
  const legend = legendFrom(timeData, subjects);

  // Acumulado real vs. objetivo.
  const cumulative = useMemo(() => {
    let real = 0;
    let goal = 0;
    const r: number[] = [];
    const g: number[] = [];
    for (const k of allDays) {
      if (k <= today) {
        real += dayTotal(idx, k);
        r.push(real);
      }
      goal += dailyGoalSec(settings, k);
      g.push(goal);
    }
    return { r, g };
  }, [allDays, idx, settings, today]);

  const subjTotals = subjectTotalsInRange(idx, range.start, range.end);
  const actTotals = activityTotalsInRange(idx, range.start, range.end);
  const hours = hoursInRange(idx, range.start, lastDay);
  const wd = weekdayTotals(idx, range.start, lastDay);
  const order = orderedWeekdays(settings.weekStartsOn);
  const peakHour = hours.indexOf(Math.max(...hours));

  const hourData: BarDatum[] = hours.map((v, h) => ({
    key: String(h),
    label: String(h),
    title: `De ${h}:00 a ${h + 1}:00`,
    segments: [{ key: 'h', name: 'Tiempo', color: 'var(--s0)', value: v }],
  }));
  const weekdayData: BarDatum[] = order.map((d) => ({
    key: String(d),
    label: WEEKDAYS_SHORT[d],
    title: `${WEEKDAYS_LONG[d]} (media de ${wd.counts[d]} días)`,
    segments: [{ key: 'w', name: 'Media', color: 'var(--s0)', value: wd.counts[d] ? wd.totals[d] / wd.counts[d] : 0 }],
    goal: subject ? undefined : (settings.dailyGoals[d] ?? 0) * 60,
  }));

  // Matriz asignatura × actividad y asignatura × semana
  const matrixSubjects = [...subjTotals.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => ({ key: k, name: k === NO_SUBJECT ? 'Sin asignatura' : (map.get(k)?.name ?? '—'), color: k === NO_SUBJECT ? 'var(--s-none)' : subjectColor(map.get(k)) }));
  const saMatrix = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessionsInRange) {
      const key = `${s.subjectId ?? NO_SUBJECT}|${s.activityId ?? NO_ACTIVITY}`;
      m.set(key, (m.get(key) ?? 0) + s.durationSec);
    }
    return m;
  }, [sessionsInRange]);
  const actCols = [
    ...activities.filter((a) => (actTotals.get(a.id) ?? 0) > 0).map((a) => ({ key: a.id, name: a.name })),
    ...((actTotals.get(NO_ACTIVITY) ?? 0) > 0 ? [{ key: NO_ACTIVITY, name: 'Sin actividad' }] : []),
  ];
  const weekCols = useMemo(() => {
    const out: { key: string; name: string }[] = [];
    let w = weekStartKey(range.start, settings.weekStartsOn);
    while (w <= range.end && out.length < 60) {
      out.push({ key: w, name: fmt(w, 'd MMM') });
      w = addDaysKey(w, 7);
    }
    return out;
  }, [range.start, range.end, settings.weekStartsOn]);
  const swValue = (row: string, col: string) => {
    let t = 0;
    for (const k of daysBetween(col, addDaysKey(col, 6))) {
      if (k < range.start || k > range.end) continue;
      t += idx.days.get(k)?.bySubject.get(row) ?? 0;
    }
    return t;
  };

  const rangeLabel =
    preset === 'week'
      ? `${fmt(range.start, "d 'de' MMM")} – ${fmt(range.end, "d 'de' MMM yyyy")}`
      : preset === 'month'
        ? capitalize(fmt(range.start, 'MMMM yyyy'))
        : preset === 'year'
          ? fmt(range.start, 'yyyy')
          : preset === 'semester'
            ? `${semName ?? 'Sin semestres'} · ${fmt(range.start, 'd MMM')} – ${fmt(range.end, 'd MMM yyyy')}`
            : `${fmt(range.start, "d 'de' MMM yyyy")} – ${fmt(range.end, "d 'de' MMM yyyy")}`;

  const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  const hasData = total > 0;

  return (
    <div>
      <PageHeader title="Estadísticas" subtitle="Analiza cuánto, cuándo y cómo estudias." />

      {/* Fila de filtros: afecta a todo lo de abajo */}
      <div className="z-10 -mx-4 mb-5 lg:sticky lg:top-0 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Preset>
            value={preset}
            onChange={(p) => {
              setPreset(p);
              setOffset(0);
            }}
            options={[
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mes' },
              { value: 'semester', label: 'Semestre' },
              { value: 'year', label: 'Año' },
              { value: 'all', label: 'Todo' },
              { value: 'custom', label: 'Personalizado' },
            ]}
          />
          <div className="w-56">
            <SubjectSelect value={subject} onChange={setSubject} includeArchived noneLabel="Todas las asignaturas" />
          </div>
          {preset === 'custom' ? (
            <div className="flex items-center gap-2">
              <Input type="date" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} aria-label="Desde" className="w-40" />
              <span className="text-muted">–</span>
              <Input type="date" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} aria-label="Hasta" className="w-40" />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <IconButton label="Periodo anterior" disabled={!canPrev} onClick={() => setOffset(offset - 1)}>
                <ChevronLeft size={18} />
              </IconButton>
              <span className="min-w-0 px-1 text-sm font-medium">{rangeLabel}</span>
              <IconButton label="Periodo siguiente" disabled={!canNext} onClick={() => setOffset(offset + 1)}>
                <ChevronRight size={18} />
              </IconButton>
            </div>
          )}
        </div>
        {preset === 'semester' && semesters.length === 0 && (
          <p className="mt-2 text-xs text-muted">No tienes semestres creados: crea uno en Ajustes. Mientras, se muestra el mes actual.</p>
        )}
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Tiempo total" value={fmtDuration(total, { compact: true })} sub={delta === null ? 'Sin periodo anterior' : `${delta >= 0 ? '▲ +' : '▼ −'}${fmtNumber(Math.abs(delta), 0)}% vs. periodo anterior`} tone={delta === null ? undefined : delta >= 0 ? 'good' : 'critical'} />
        <Kpi label="Media diaria" value={fmtDuration(effDays.length ? total / effDays.length : 0, { compact: true })} sub={`${fmtDuration(studiedDays ? total / studiedDays : 0, { compact: true })} en días de estudio`} />
        <Kpi label="Días estudiados" value={`${studiedDays} / ${effDays.length}`} sub={`${effDays.length ? Math.round((studiedDays / effDays.length) * 100) : 0}% de los días`} />
        <Kpi label="Sesiones" value={String(sessionsInRange.length)} sub={`Duración media ${fmtDuration(avgSession, { compact: true })}`} />
        <Kpi label="Objetivo diario" value={subject ? '—' : `${metDays} / ${goalDays.length}`} sub={subject ? 'Solo con todas las asignaturas' : 'días cumplidos'} />
        <Card className="p-4">
          <div className="text-[12.5px] font-medium text-muted">Concentración media</div>
          <div className="mt-1 text-xl font-semibold tracking-tight">{avgRating ? fmtNumber(avgRating, 1) : '—'}</div>
          <div className="mt-1">
            <Stars value={Math.round(avgRating)} size={14} />
          </div>
        </Card>
      </div>

      {!hasData && (
        <Card className="mb-4">
          <EmptyState title="No hay tiempo registrado en este periodo" description="Cambia el periodo o la asignatura, o registra una sesión." />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={gran === 'day' ? 'Tiempo por día' : gran === 'week' ? 'Tiempo por semana' : 'Tiempo por mes'}
            subtitle={bestDay.sec > 0 ? `Mejor día: ${capitalize(fmt(bestDay.key, "EEEE d 'de' MMM"))} (${fmtDuration(bestDay.sec, { compact: true })})` : undefined}
            action={
              <IconButton label={table ? 'Ver gráfico' : 'Ver como tabla'} onClick={() => setTable(!table)} className={cx(table && 'bg-accent-soft text-accent-ink')}>
                <Table2 size={17} />
              </IconButton>
            }
          />
          <div className="px-4 pt-3 pb-4">
            {table ? (
              <DataTable data={timeData} />
            ) : (
              <>
                <BarChart data={timeData} height={250} ariaLabel="Tiempo de estudio" maxBar={gran === 'day' && len > 20 ? 14 : 24} />
                {legend.length > 1 && (
                  <div className="mt-3 px-2">
                    <Legend items={legend} />
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Por asignatura" subtitle="Tiempo y porcentaje" />
          <div className="px-4 pt-4 pb-4">
            {hasData ? <DistributionBars items={subjectDist(subjTotals, map)} /> : <EmptyState title="Sin datos" className="py-8" />}
          </div>
        </Card>

        {!subject && cumulative.g[cumulative.g.length - 1] > 0 && (
          <Card className="xl:col-span-2">
            <CardHeader title="Acumulado frente al objetivo" subtitle="¿Vas por delante o por detrás de lo que te propusiste?" />
            <div className="px-4 pt-3 pb-4">
              <LineChart
                labels={allDays.map((k) => (len <= 35 ? fmt(k, 'd') : fmt(k, 'd MMM')))}
                titles={allDays.map((k) => capitalize(fmt(k, "EEEE d 'de' MMMM")))}
                series={[
                  { key: 'real', name: 'Estudiado', color: 'var(--accent)', values: cumulative.r, area: true },
                  { key: 'goal', name: 'Objetivo', color: 'var(--muted)', values: cumulative.g, dashed: true },
                ]}
                height={230}
                ariaLabel="Tiempo acumulado frente al objetivo"
              />
              <div className="mt-3 px-2">
                <Legend
                  shape="line"
                  items={[
                    { key: 'r', name: 'Estudiado', color: 'var(--accent)' },
                    { key: 'g', name: 'Objetivo', color: 'var(--muted)', dashed: true },
                  ]}
                />
              </div>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Por actividad" subtitle="Cómo estudias" />
          <div className="px-4 pt-4 pb-4">
            {hasData ? <DistributionBars items={activityDist(actTotals, activities)} /> : <EmptyState title="Sin datos" className="py-8" />}
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Hora del día"
            subtitle={hasData ? `Tu hora más productiva: de ${peakHour}:00 a ${peakHour + 1}:00` : 'Cuándo estudias'}
          />
          <div className="px-4 pt-3 pb-4">
            <BarChart data={hourData} height={200} labelEvery={3} maxBar={16} ariaLabel="Tiempo por hora del día" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Día de la semana" subtitle="Media por día · marca = objetivo" />
          <div className="px-4 pt-3 pb-4">
            <BarChart data={weekdayData} height={200} ariaLabel="Media por día de la semana" />
          </div>
        </Card>

        {matrixSubjects.length > 0 && actCols.length > 0 && (
          <Card className="xl:col-span-3">
            <CardHeader title="Asignaturas × actividades" subtitle="Cómo estudias cada asignatura (más oscuro = más tiempo)" />
            <div className="px-4 pt-3 pb-4">
              <Matrix rows={matrixSubjects} cols={actCols} value={(r, c) => saMatrix.get(`${r}|${c}`) ?? 0} />
            </div>
          </Card>
        )}

        {matrixSubjects.length > 0 && weekCols.length > 1 && (
          <Card className="xl:col-span-3">
            <CardHeader title="Asignaturas × semanas" subtitle="Tiempo de cada asignatura en cada semana" />
            <div className="px-4 pt-3 pb-4">
              <Matrix rows={matrixSubjects} cols={weekCols} value={swValue} />
            </div>
          </Card>
        )}

        {(preset === 'year' || preset === 'all' || preset === 'semester') && (
          <Card className="xl:col-span-3">
            <CardHeader title="Mapa de actividad" subtitle="Cada cuadro es un día" />
            <div className="px-5 pt-3 pb-4">
              <Heatmap
                start={range.start}
                end={range.end}
                today={today}
                weekStartsOn={settings.weekStartsOn}
                valueOf={(k) => dayTotal(idx, k)}
                goalOf={subject ? undefined : (k) => dailyGoalSec(settings, k)}
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'critical' }) {
  return (
    <Card className="p-4">
      <div className="text-[12.5px] font-medium text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
      {sub && <div className={cx('mt-1 text-[12px]', tone === 'good' ? 'text-good-ink' : tone === 'critical' ? 'text-critical-ink' : 'text-ink-2')}>{sub}</div>}
    </Card>
  );
}

/** Vista de tabla equivalente al gráfico (accesible). */
function DataTable({ data }: { data: BarDatum[] }) {
  const keys = data
    .flatMap((d) => d.segments)
    .filter((s, i, arr) => s.value > 0 && arr.findIndex((x) => x.key === s.key) === i);
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-line text-left text-muted">
            <th className="py-2 pr-3 font-medium">Periodo</th>
            {keys.map((k) => (
              <th key={k.key} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                {k.name}
              </th>
            ))}
            <th className="py-2 pl-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            const total = d.segments.reduce((a, s) => a + s.value, 0);
            return (
              <tr key={d.key} className="border-b border-line/60">
                <td className="py-1.5 pr-3 whitespace-nowrap">{d.title}</td>
                {keys.map((k) => {
                  const v = d.segments.find((s) => s.key === k.key)?.value ?? 0;
                  return (
                    <td key={k.key} className="tabular px-2 py-1.5 text-right text-ink-2">
                      {v ? fmtDuration(v, { compact: true }) : '—'}
                    </td>
                  );
                })}
                <td className="tabular py-1.5 pl-2 text-right font-semibold">{fmtDuration(total, { compact: true })}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
