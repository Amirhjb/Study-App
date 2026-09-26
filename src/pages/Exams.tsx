import { useState } from 'react';
import { CalendarClock, Plus, Target } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { subjectColor, useSubjectMap, useToday } from '../lib/hooks';
import { capitalize, diffDays, fmt, fmtDuration } from '../lib/dates';
import { examPrep } from '../lib/stats';
import { EXAM_TYPES, labelOf } from '../lib/labels';
import { ExamRow, SubjectTag } from '../components/items';
import { SubjectSelect } from '../components/forms';
import { Button, Card, CardHeader, Chip, EmptyState, Meter, PageHeader } from '../components/ui';

export default function Exams() {
  const exams = useStore((s) => s.exams);
  const sessions = useStore((s) => s.sessions);
  const openModal = useUI((s) => s.openModal);
  const map = useSubjectMap();
  const today = useToday();
  const [subject, setSubject] = useState<string | null>(null);

  const list = exams.filter((e) => !subject || e.subjectId === subject);
  const upcoming = list.filter((e) => e.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = list.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const next = upcoming[0];
  const nextPrep = next ? examPrep(next, exams, sessions, today) : null;
  const nextSubject = next?.subjectId ? map.get(next.subjectId) : null;
  const nextDays = next ? diffDays(next.date, today) : 0;

  return (
    <div>
      <PageHeader
        title="Exámenes"
        subtitle="Cuenta atrás, horas de preparación y notas de cada evaluación."
        actions={
          <>
            <div className="w-56">
              <SubjectSelect value={subject} onChange={setSubject} includeArchived noneLabel="Todas las asignaturas" />
            </div>
            <Button variant="primary" onClick={() => openModal({ kind: 'exam', defaults: { subjectId: subject } })}>
              <Plus size={16} /> Nuevo examen
            </Button>
          </>
        }
      />

      {exams.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target size={28} />}
            title="No has añadido exámenes"
            description="Añade la fecha, el temario y cuántas horas quieres dedicarle. Studium contará las horas que estudias esa asignatura."
            action={<Button variant="primary" onClick={() => openModal({ kind: 'exam' })}>Añadir examen</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {next && nextPrep && (
            <Card className="overflow-hidden xl:col-span-3">
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center" style={{ borderLeft: `4px solid ${subjectColor(nextSubject)}` }}>
                <div className="text-center sm:w-36">
                  <div className="text-[56px] leading-none font-semibold tracking-tight">{nextDays}</div>
                  <div className="mt-1 text-sm text-ink-2">{nextDays === 1 ? 'día' : 'días'} para el examen</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-muted">Próximo examen</div>
                  <div className="mt-0.5 text-xl font-semibold">{next.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
                    <SubjectTag id={next.subjectId} />
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={14} /> {capitalize(fmt(next.date, "EEEE d 'de' MMMM"))}
                      {next.time && ` · ${next.time}`}
                    </span>
                    <span>{labelOf(EXAM_TYPES, next.type)}</span>
                    {next.weight ? <span>{next.weight}% de la nota</span> : null}
                  </div>
                  {next.topics && <p className="mt-2 line-clamp-2 text-[13px] whitespace-pre-line text-ink-2">{next.topics}</p>}
                </div>
                <div className="sm:w-72">
                  <div className="text-[13px] font-medium text-muted">Preparación</div>
                  <div className="mt-0.5 text-lg font-semibold">
                    {fmtDuration(nextPrep.studiedSec, { compact: true })}
                    {nextPrep.targetSec !== null && <span className="text-sm font-normal text-muted"> de {fmtDuration(nextPrep.targetSec, { compact: true })}</span>}
                  </div>
                  {nextPrep.targetSec !== null ? (
                    <>
                      <Meter value={nextPrep.studiedSec} max={nextPrep.targetSec} color={subjectColor(nextSubject)} className="mt-2" label="Preparación" />
                      <div className="mt-1.5 text-[12.5px] text-ink-2">
                        {nextPrep.studiedSec >= nextPrep.targetSec
                          ? '¡Objetivo de preparación cumplido!'
                          : nextPrep.perDaySec
                            ? `Necesitas ${fmtDuration(nextPrep.perDaySec, { compact: true })} al día hasta el examen`
                            : 'Es hoy: ¡mucha suerte!'}
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-[12.5px] text-muted">Pon unas horas objetivo para ver tu progreso.</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          <Card className="xl:col-span-2">
            <CardHeader title="Próximos" subtitle={`${upcoming.length} por delante`} />
            <div className="px-3 pt-2 pb-3">
              {upcoming.length ? upcoming.map((e) => <ExamRow key={e.id} exam={e} today={today} />) : <EmptyState title="No hay exámenes próximos" className="py-8" />}
            </div>
          </Card>

          <Card>
            <CardHeader title="Realizados" subtitle="Pulsa para añadir la nota" />
            <div className="px-3 pt-2 pb-3">
              {past.length ? (
                past.map((e) => <ExamRow key={e.id} exam={e} today={today} showPrep={false} />)
              ) : (
                <EmptyState title="Aún no hay exámenes pasados" className="py-8" />
              )}
              {past.some((e) => e.grade === null) && (
                <div className="px-2 pt-2">
                  <Chip tone="warning">Tienes exámenes sin nota</Chip>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
