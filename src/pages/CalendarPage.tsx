import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { subjectColor, useIndex, useSubjectMap, useToday } from '../lib/hooks';
import { addDaysKey, capitalize, combineDateTime, daysBetween, fmt, fmtDuration, orderedWeekdays, toKey, WEEKDAYS_SHORT, weekStartKey } from '../lib/dates';
import { dailyGoalSec, dayTotal, monthRange } from '../lib/stats';
import { levelFor } from '../charts/Heatmap';
import { fmtAxisHours } from '../charts/common';
import { ExamRow, SessionRow, TaskRow } from '../components/items';
import { Button, Card, CardHeader, cx, EmptyState, IconButton, PageHeader } from '../components/ui';

export default function CalendarPage() {
  const settings = useStore((s) => s.settings);
  const sessions = useStore((s) => s.sessions);
  const tasks = useStore((s) => s.tasks);
  const exams = useStore((s) => s.exams);
  const openModal = useUI((s) => s.openModal);
  const idx = useIndex();
  const map = useSubjectMap();
  const today = useToday();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(today);

  const month = monthRange(today, offset);
  const gridStart = weekStartKey(month.start, settings.weekStartsOn);
  const gridEnd = addDaysKey(weekStartKey(month.end, settings.weekStartsOn), 6);
  const days = daysBetween(gridStart, gridEnd);

  const examsByDay = useMemo(() => groupBy(exams, (e) => e.date), [exams]);
  const tasksByDay = useMemo(() => groupBy(tasks.filter((t) => t.due), (t) => t.due as string), [tasks]);

  const selSessions = sessions.filter((s) => toKey(new Date(s.start)) === selected).sort((a, b) => a.start.localeCompare(b.start));
  const selTasks = tasksByDay.get(selected) ?? [];
  const selExams = examsByDay.get(selected) ?? [];
  const selTotal = dayTotal(idx, selected);
  const selGoal = dailyGoalSec(settings, selected);
  const monthTotal = daysBetween(month.start, month.end).reduce((a, k) => a + dayTotal(idx, k), 0);

  return (
    <div>
      <PageHeader title="Calendario" subtitle="Horas estudiadas, entregas y exámenes de un vistazo." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between px-5 pt-4">
            <div>
              <h2 className="text-lg font-semibold">{capitalize(fmt(month.start, 'MMMM yyyy'))}</h2>
              <p className="text-[13px] text-muted">{fmtDuration(monthTotal)} estudiadas este mes</p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setOffset(0); setSelected(today); }}>
                Hoy
              </Button>
              <IconButton label="Mes anterior" onClick={() => setOffset(offset - 1)}>
                <ChevronLeft size={18} />
              </IconButton>
              <IconButton label="Mes siguiente" onClick={() => setOffset(offset + 1)}>
                <ChevronRight size={18} />
              </IconButton>
            </div>
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 pb-1">
              {orderedWeekdays(settings.weekStartsOn).map((d) => (
                <div key={d} className="text-center text-[11.5px] font-medium text-muted">
                  {WEEKDAYS_SHORT[d]}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((k) => {
                const inMonth = k >= month.start && k <= month.end;
                const v = dayTotal(idx, k);
                const goal = dailyGoalSec(settings, k);
                const ex = examsByDay.get(k) ?? [];
                const tk = (tasksByDay.get(k) ?? []).filter((t) => t.status !== 'hecha');
                const isSel = k === selected;
                return (
                  <button
                    key={k}
                    onClick={() => setSelected(k)}
                    className={cx(
                      'flex min-h-20 flex-col rounded-lg border p-1.5 text-left transition-colors sm:min-h-24',
                      isSel ? 'border-accent ring-1 ring-accent' : 'border-line hover:bg-hover',
                      !inMonth && 'opacity-40',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cx(
                          'flex h-6 w-6 items-center justify-center rounded-full text-[12.5px]',
                          k === today ? 'bg-accent font-semibold text-on-accent' : 'text-ink',
                        )}
                      >
                        {fmt(k, 'd')}
                      </span>
                      {goal > 0 && v >= goal && <span className="text-[11px] text-good-ink" title="Objetivo cumplido">✓</span>}
                    </div>
                    {v > 0 && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-ink-2">
                        <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: `var(--h${Math.max(1, levelFor(v))})` }} />
                        <span className="tabular whitespace-nowrap">{fmtAxisHours(v)}</span>
                      </span>
                    )}
                    <div className="mt-auto flex flex-col gap-0.5 pt-1">
                      {ex.slice(0, 2).map((e) => (
                        <span key={e.id} className="flex items-center gap-1 truncate rounded bg-critical-soft px-1 text-[10.5px] font-medium text-critical-ink">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: subjectColor(e.subjectId ? map.get(e.subjectId) : null) }} />
                          <span className="truncate">{e.title}</span>
                        </span>
                      ))}
                      {tk.slice(0, 2).map((t) => (
                        <span key={t.id} className="flex items-center gap-1 truncate rounded bg-card-2 px-1 text-[10.5px] text-ink-2 ring-1 ring-line">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: subjectColor(t.subjectId ? map.get(t.subjectId) : null) }} />
                          <span className="truncate">{t.title}</span>
                        </span>
                      ))}
                      {ex.length + tk.length > 4 && <span className="text-[10px] text-muted">+{ex.length + tk.length - 4} más</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-3 rounded bg-critical-soft ring-1 ring-critical/30" /> Examen
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-3 rounded bg-card-2 ring-1 ring-line" /> Entrega de tarea
              </span>
              <span className="inline-flex items-center gap-1.5">✓ Objetivo diario cumplido</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title={capitalize(fmt(selected, "EEEE, d 'de' MMMM"))}
            subtitle={`${fmtDuration(selTotal)} estudiadas${selGoal ? ` · objetivo ${fmtDuration(selGoal)}` : ''}`}
          />
          <div className="flex flex-wrap gap-2 px-5 pt-3">
            <Button
              size="sm"
              onClick={() => openModal({ kind: 'session', defaults: { start: combineDateTime(selected, '16:00') } })}
              disabled={selected > today}
            >
              <Plus size={14} /> Sesión
            </Button>
            <Button size="sm" onClick={() => openModal({ kind: 'task', defaults: { due: selected } })}>
              <Plus size={14} /> Tarea
            </Button>
            <Button size="sm" onClick={() => openModal({ kind: 'exam', defaults: { date: selected } })}>
              <Plus size={14} /> Examen
            </Button>
          </div>
          <div className="px-3 pt-3 pb-4">
            {selExams.length > 0 && (
              <Section title="Exámenes">
                {selExams.map((e) => (
                  <ExamRow key={e.id} exam={e} today={today} />
                ))}
              </Section>
            )}
            {selTasks.length > 0 && (
              <Section title="Entregas">
                {selTasks.map((t) => (
                  <TaskRow key={t.id} task={t} today={today} compact />
                ))}
              </Section>
            )}
            {selSessions.length > 0 && (
              <Section title="Sesiones">
                {selSessions.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </Section>
            )}
            {selExams.length + selTasks.length + selSessions.length === 0 && <EmptyState title="Nada este día" className="py-8" />}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="px-2 pb-1 text-[11.5px] font-semibold tracking-wide text-muted uppercase">{title}</div>
      {children}
    </div>
  );
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}
