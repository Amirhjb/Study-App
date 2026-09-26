import { useMemo, useState } from 'react';
import { Library, Pencil, Play, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { subjectColor, useIndex, useToday } from '../lib/hooks';
import { fmtDuration, relativeDay, toKey } from '../lib/dates';
import { subjectTotalsInRange, weekRange } from '../lib/stats';
import { Button, Card, Checkbox, Chip, EmptyState, IconButton, Meter, PageHeader, Select } from '../components/ui';

export default function Subjects() {
  const subjects = useStore((s) => s.subjects);
  const sessions = useStore((s) => s.sessions);
  const tasks = useStore((s) => s.tasks);
  const exams = useStore((s) => s.exams);
  const semesters = useStore((s) => s.semesters);
  const settings = useStore((s) => s.settings);
  const setTimer = useStore((s) => s.setTimer);
  const timerActive = useStore((s) => s.timer.sessionStart !== null);
  const openModal = useUI((s) => s.openModal);
  const idx = useIndex();
  const today = useToday();
  const [showArchived, setShowArchived] = useState(false);
  const [semester, setSemester] = useState<string>('');

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; last: string | null; sessions: number }>();
    for (const s of sessions) {
      if (!s.subjectId) continue;
      const cur = m.get(s.subjectId) ?? { total: 0, last: null, sessions: 0 };
      cur.total += s.durationSec;
      cur.sessions += 1;
      if (!cur.last || s.start > cur.last) cur.last = s.start;
      m.set(s.subjectId, cur);
    }
    return m;
  }, [sessions]);

  const wr = weekRange(today, settings.weekStartsOn);
  const week = subjectTotalsInRange(idx, wr.start, wr.end);
  const list = subjects.filter((s) => (showArchived || !s.archived) && (!semester || s.semesterId === semester));
  const archivedCount = subjects.filter((s) => s.archived).length;

  return (
    <div>
      <PageHeader
        title="Asignaturas"
        subtitle="Colores, objetivos semanales y horas objetivo para cada asignatura."
        actions={
          <>
            {semesters.length > 0 && (
              <Select value={semester} onChange={(e) => setSemester(e.target.value)} aria-label="Semestre" className="w-52">
                <option value="">Todos los semestres</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
            <Button variant="primary" onClick={() => openModal({ kind: 'subject' })}>
              <Plus size={16} /> Nueva asignatura
            </Button>
          </>
        }
      />
      {archivedCount > 0 && (
        <div className="mb-4">
          <Checkbox checked={showArchived} onChange={setShowArchived} label={`Mostrar archivadas (${archivedCount})`} />
        </div>
      )}

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Library size={28} />}
            title="No hay asignaturas"
            description="Crea tus asignaturas para clasificar el tiempo de estudio, las tareas y los exámenes."
            action={<Button variant="primary" onClick={() => openModal({ kind: 'subject' })}>Crear asignatura</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const st = stats.get(s.id);
            const weekSec = week.get(s.id) ?? 0;
            const pending = tasks.filter((t) => t.subjectId === s.id && t.status !== 'hecha').length;
            const nextExam = exams.filter((e) => e.subjectId === s.id && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
            const sem = semesters.find((x) => x.id === s.semesterId);
            return (
              <Card key={s.id} className="flex flex-col overflow-hidden">
                <div className="h-1.5" style={{ background: subjectColor(s) }} />
                <div className="flex items-start justify-between gap-2 px-5 pt-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{s.name}</h3>
                    <p className="truncate text-[12.5px] text-muted">
                      {[sem?.name, s.teacher, s.credits ? `${s.credits} créditos` : null].filter(Boolean).join(' · ') || 'Sin detalles'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {s.archived && <Chip>Archivada</Chip>}
                    <IconButton label="Editar" onClick={() => openModal({ kind: 'subject', id: s.id })}>
                      <Pencil size={16} />
                    </IconButton>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 px-5 pt-4">
                  <Stat label="Total" value={fmtDuration(st?.total ?? 0, { compact: true })} />
                  <Stat label="Esta semana" value={fmtDuration(weekSec, { compact: true })} />
                  <Stat label="Sesiones" value={String(st?.sessions ?? 0)} />
                </div>
                <div className="flex flex-col gap-3 px-5 pt-4">
                  {s.weeklyGoalMin ? (
                    <Goal label="Objetivo semanal" done={weekSec} goal={s.weeklyGoalMin * 60} color={subjectColor(s)} />
                  ) : null}
                  {s.targetHours ? <Goal label="Objetivo del semestre" done={st?.total ?? 0} goal={s.targetHours * 3600} color={subjectColor(s)} /> : null}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 px-5 pt-4 pb-4 text-[12.5px] text-ink-2">
                  {nextExam && <Chip tone="accent">Examen {relativeDay(nextExam.date, today)}</Chip>}
                  {pending > 0 && <Chip>{pending} {pending === 1 ? 'tarea' : 'tareas'}</Chip>}
                  {st?.last && <span className="text-muted">Última vez: {relativeDay(toKey(new Date(st.last)), today)}</span>}
                  {!s.archived && (
                    <Button
                      size="sm"
                      className="ml-auto"
                      disabled={timerActive}
                      title={timerActive ? 'Ya hay una sesión en marcha' : undefined}
                      onClick={() => {
                        setTimer((t) => ({ ...t, subjectId: s.id, taskId: null }));
                        window.location.hash = '/temporizador';
                      }}
                    >
                      <Play size={14} /> Estudiar
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card-2 px-2.5 py-2">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="tabular text-[15px] font-semibold">{value}</div>
    </div>
  );
}

function Goal({ label, done, goal, color }: { label: string; done: number; goal: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[12.5px]">
        <span className="text-ink-2">{label}</span>
        <span className="tabular text-ink-2">
          {fmtDuration(done, { compact: true })} / {fmtDuration(goal, { compact: true })} {done >= goal && <span className="text-good-ink">✓</span>}
        </span>
      </div>
      <Meter value={done} max={goal} color={color} height={6} label={label} />
    </div>
  );
}
