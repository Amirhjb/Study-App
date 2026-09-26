import { useMemo, useState } from 'react';
import { Calculator, CircleAlert, CircleCheck, GraduationCap, Hourglass, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { subjectColor, useToday } from '../lib/hooks';
import { fmt, fmtNumber } from '../lib/dates';
import { requiredGrade, weightedGrade } from '../lib/stats';
import { EXAM_TYPES, labelOf } from '../lib/labels';
import { Button, Card, CardHeader, cx, EmptyState, Input, PageHeader, Select } from '../components/ui';

export default function Grades() {
  const subjects = useStore((s) => s.subjects);
  const exams = useStore((s) => s.exams);
  const semesters = useStore((s) => s.semesters);
  const settings = useStore((s) => s.settings);
  const openModal = useUI((s) => s.openModal);
  const today = useToday();
  const scale = settings.gradeScale;
  const [semester, setSemester] = useState<string>(settings.currentSemesterId ?? '');
  const [open, setOpen] = useState<string | null>(null);
  const [calcSubject, setCalcSubject] = useState('');
  const [calcTarget, setCalcTarget] = useState(String(scale.pass));

  const list = subjects.filter((s) => !semester || s.semesterId === semester);
  const rows = useMemo(
    () =>
      list.map((s) => {
        const ex = exams.filter((e) => e.subjectId === s.id);
        const { grade, weightDone } = weightedGrade(ex);
        const pending = ex.filter((e) => e.grade === null);
        const need = requiredGrade(ex, scale.pass);
        const status: 'passed' | 'failed' | 'ongoing' | 'none' =
          grade === null ? 'none' : weightDone >= 100 || (weightDone === 0 && pending.length === 0) ? (grade >= scale.pass ? 'passed' : 'failed') : 'ongoing';
        return { s, ex, grade, weightDone, need, status };
      }),
    [list, exams, scale.pass],
  );

  const graded = rows.filter((r) => r.grade !== null);
  const withCredits = graded.filter((r) => (r.s.credits ?? 0) > 0);
  const avg =
    withCredits.length > 0
      ? withCredits.reduce((a, r) => a + (r.grade as number) * (r.s.credits as number), 0) / withCredits.reduce((a, r) => a + (r.s.credits as number), 0)
      : graded.length
        ? graded.reduce((a, r) => a + (r.grade as number), 0) / graded.length
        : null;
  const creditsPassed = rows.filter((r) => r.status === 'passed').reduce((a, r) => a + (r.s.credits ?? 0), 0);
  const creditsTotal = rows.reduce((a, r) => a + (r.s.credits ?? 0), 0);

  const calcRow = rows.find((r) => r.s.id === calcSubject);
  const target = Number(calcTarget.replace(',', '.'));
  const calcNeed = calcRow && Number.isFinite(target) ? requiredGrade(calcRow.ex, target) : null;
  const f = (n: number | null) => (n === null ? '—' : fmtNumber(n, scale.decimals));

  return (
    <div>
      <PageHeader
        title="Calificaciones"
        subtitle={`Notas de ${scale.min} a ${scale.max} · aprobado con ${scale.pass}. Se calculan con las notas y pesos de tus exámenes.`}
        actions={
          <>
            <Select value={semester} onChange={(e) => setSemester(e.target.value)} aria-label="Semestre" className="w-48">
              <option value="">Todos los semestres</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button variant="primary" onClick={() => openModal({ kind: 'exam' })}>
              <Plus size={16} /> Añadir nota
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-[13px] font-medium text-muted">Nota media {withCredits.length ? '(ponderada por créditos)' : ''}</div>
          <div className="mt-1 text-[40px] leading-none font-semibold tracking-tight">{f(avg)}</div>
          {avg !== null && (
            <div className={cx('mt-2 inline-flex items-center gap-1 text-[13px] font-medium', avg >= scale.pass ? 'text-good-ink' : 'text-critical-ink')}>
              {avg >= scale.pass ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
              {avg >= scale.pass ? 'Por encima del aprobado' : 'Por debajo del aprobado'}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <div className="text-[13px] font-medium text-muted">Asignaturas aprobadas</div>
          <div className="mt-1 text-[40px] leading-none font-semibold tracking-tight">
            {rows.filter((r) => r.status === 'passed').length}
            <span className="text-lg font-normal text-muted"> / {rows.length}</span>
          </div>
          {creditsTotal > 0 && <div className="mt-2 text-[13px] text-ink-2">{fmtNumber(creditsPassed)} de {fmtNumber(creditsTotal)} créditos</div>}
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
            <Calculator size={15} /> ¿Qué nota necesito?
          </div>
          <div className="mt-2 grid grid-cols-[1fr_5rem] gap-2">
            <Select value={calcSubject} onChange={(e) => setCalcSubject(e.target.value)} aria-label="Asignatura">
              <option value="">Elige asignatura</option>
              {rows.map((r) => (
                <option key={r.s.id} value={r.s.id}>
                  {r.s.name}
                </option>
              ))}
            </Select>
            <Input type="number" step="0.1" value={calcTarget} onChange={(e) => setCalcTarget(e.target.value)} aria-label="Nota objetivo" title="Nota objetivo" />
          </div>
          <p className="mt-2 text-[13px] text-ink-2">
            {!calcRow
              ? 'Calcula la media que necesitas en lo que te queda.'
              : calcNeed === null
                ? 'Ya está evaluado el 100 % (o faltan pesos en los exámenes).'
                : calcNeed <= scale.min
                  ? `¡Ya lo tienes asegurado con el ${fmtNumber(calcRow.weightDone, 0)} % evaluado!`
                  : calcNeed > scale.max
                    ? `No es alcanzable: necesitarías ${f(calcNeed)} en el ${fmtNumber(100 - calcRow.weightDone, 0)} % restante.`
                    : `Necesitas una media de ${f(calcNeed)} en el ${fmtNumber(100 - calcRow.weightDone, 0)} % que queda.`}
          </p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<GraduationCap size={28} />} title="No hay asignaturas en este semestre" description="Crea asignaturas y añade exámenes con nota y peso." />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Por asignatura" subtitle="Pulsa una asignatura para ver sus evaluaciones" />
          <div className="overflow-x-auto px-2 pt-3 pb-3">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[12.5px] text-muted">
                  <th className="px-3 py-2 font-medium">Asignatura</th>
                  <th className="px-3 py-2 text-right font-medium">Créditos</th>
                  <th className="px-3 py-2 text-right font-medium">Evaluado</th>
                  <th className="px-3 py-2 text-right font-medium">Nota actual</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-right font-medium">Para aprobar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <FragmentRow key={r.s.id}>
                    <tr className="cursor-pointer border-b border-line/60 hover:bg-hover" onClick={() => setOpen(open === r.s.id ? null : r.s.id)}>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: subjectColor(r.s) }} />
                          <span className="font-medium">{r.s.name}</span>
                        </span>
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-ink-2">{r.s.credits ?? '—'}</td>
                      <td className="tabular px-3 py-2.5 text-right text-ink-2">{r.weightDone ? `${fmtNumber(r.weightDone, 0)} %` : '—'}</td>
                      <td className="tabular px-3 py-2.5 text-right font-semibold">{f(r.grade)}</td>
                      <td className="px-3 py-2.5">
                        <Status status={r.status} />
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-ink-2">
                        {r.status === 'ongoing' && r.need !== null ? (r.need <= scale.min ? 'Asegurado' : r.need > scale.max ? 'No alcanzable' : `${f(r.need)} de media`) : '—'}
                      </td>
                    </tr>
                    {open === r.s.id && (
                      <tr className="border-b border-line/60 bg-card-2">
                        <td colSpan={6} className="px-4 py-3">
                          {r.ex.length === 0 ? (
                            <p className="text-[13px] text-muted">Sin evaluaciones. Añade exámenes, prácticas o trabajos con su nota y peso.</p>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {r.ex
                                .slice()
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .map((e) => (
                                  <button
                                    key={e.id}
                                    onClick={() => openModal({ kind: 'exam', id: e.id })}
                                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-hover"
                                  >
                                    <span className="tabular w-20 text-muted">{fmt(e.date, 'd MMM yy')}</span>
                                    <span className="flex-1 truncate">
                                      {e.title} <span className="text-muted">· {labelOf(EXAM_TYPES, e.type)}</span>
                                    </span>
                                    <span className="tabular w-16 text-right text-muted">{e.weight ? `${e.weight} %` : '—'}</span>
                                    <span className="tabular w-14 text-right font-semibold">
                                      {e.grade !== null ? f(e.grade) : e.date >= today ? 'Pendiente' : 'Sin nota'}
                                    </span>
                                  </button>
                                ))}
                            </div>
                          )}
                          <Button size="sm" variant="ghost" className="mt-2" onClick={() => openModal({ kind: 'exam', defaults: { subjectId: r.s.id } })}>
                            <Plus size={14} /> Añadir evaluación
                          </Button>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Status({ status }: { status: 'passed' | 'failed' | 'ongoing' | 'none' }) {
  if (status === 'passed')
    return (
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-good-ink">
        <CircleCheck size={15} /> Aprobada
      </span>
    );
  if (status === 'failed')
    return (
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-critical-ink">
        <CircleAlert size={15} /> Suspensa
      </span>
    );
  if (status === 'ongoing')
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-ink-2">
        <Hourglass size={14} /> En curso
      </span>
    );
  return <span className="text-[13px] text-muted">Sin notas</span>;
}
