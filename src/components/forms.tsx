import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { combineDateTime, fmtClock, timeOf, todayKey, toKey } from '../lib/dates';
import { uid } from '../lib/defaults';
import { COLOR_NAMES, EXAM_TYPES, PRIORITIES, TASK_STATUS, TASK_TYPES } from '../lib/labels';
import type { Exam, ExamType, Priority, Session, Subject, Subtask, Task, TaskStatus, TaskType } from '../lib/types';
import { Button, Checkbox, ConfirmDialog, cx, Field, IconButton, Input, Modal, Select, Stars, Textarea } from './ui';
import { advance, focusMs, pause, start } from '../lib/timer';

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function SubjectSelect({
  id,
  value,
  onChange,
  allowNone = true,
  includeArchived = false,
  noneLabel = 'Sin asignatura',
  className,
}: {
  id?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  allowNone?: boolean;
  includeArchived?: boolean;
  /** Texto de la opción vacía (en filtros: "Todas las asignaturas"). */
  noneLabel?: string;
  className?: string;
}) {
  const subjects = useStore((s) => s.subjects);
  const list = subjects.filter((s) => includeArchived || !s.archived || s.id === value);
  return (
    <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={className} aria-label={id ? undefined : 'Asignatura'}>
      {allowNone && <option value="">{noneLabel}</option>}
      {list.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
          {s.archived ? ' (archivada)' : ''}
        </option>
      ))}
    </Select>
  );
}

export function ActivitySelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const activities = useStore((s) => s.activities);
  return (
    <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Sin actividad</option>
      {activities.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </Select>
  );
}

/* ------------------------------------------------------------------ Sesión */

export function SessionModal({ id, defaults }: { id?: string; defaults?: Partial<Session> }) {
  const close = useUI((s) => s.closeModal);
  const toast = useUI((s) => s.toast);
  const existing = useStore((s) => (id ? s.sessions.find((x) => x.id === id) : undefined));
  const tasks = useStore((s) => s.tasks);
  const { addSession, updateSession, deleteSession } = useStore.getState();
  const base = existing ?? defaults ?? {};
  const startIso = base.start ?? new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [subjectId, setSubjectId] = useState<string | null>(base.subjectId ?? null);
  const [activityId, setActivityId] = useState<string | null>(base.activityId ?? null);
  const [taskId, setTaskId] = useState<string | null>(base.taskId ?? null);
  const [date, setDate] = useState(toKey(new Date(startIso)));
  const [time, setTime] = useState(timeOf(startIso));
  const dur = base.durationSec ?? 3600;
  const [hours, setHours] = useState(String(Math.floor(dur / 3600)));
  const [mins, setMins] = useState(String(Math.round((dur % 3600) / 60)));
  const [rating, setRating] = useState(base.rating ?? 0);
  const [note, setNote] = useState(base.note ?? '');
  const [confirm, setConfirm] = useState(false);

  const durationSec = ((numOrNull(hours) ?? 0) * 60 + (numOrNull(mins) ?? 0)) * 60;
  const endLabel = useMemo(() => {
    const s = new Date(combineDateTime(date, time)).getTime();
    return timeOf(new Date(s + durationSec * 1000).toISOString());
  }, [date, time, durationSec]);
  const openTasks = tasks.filter(
    (t) => (t.status !== 'hecha' || t.id === taskId) && (!subjectId || t.subjectId === subjectId),
  );
  const valid = durationSec >= 60 && !!date;

  const save = () => {
    if (!valid) return;
    const data = {
      subjectId,
      activityId,
      taskId,
      start: combineDateTime(date, time),
      durationSec,
      rating,
      note: note.trim(),
    };
    if (existing) {
      updateSession(existing.id, data);
      toast('Sesión actualizada');
    } else {
      addSession({ ...data, pomodoros: 0, source: 'manual' });
      toast('Sesión añadida');
    }
    close();
  };

  return (
    <Modal
      open
      onClose={close}
      title={existing ? 'Editar sesión' : 'Añadir sesión de estudio'}
      footer={
        <>
          {existing && (
            <Button variant="ghost" className="mr-auto text-critical-ink" onClick={() => setConfirm(true)}>
              <Trash size={16} /> Eliminar
            </Button>
          )}
          <Button onClick={close}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Asignatura" className="col-span-2 sm:col-span-1">
          {(fid) => <SubjectSelect id={fid} value={subjectId} onChange={setSubjectId} />}
        </Field>
        <Field label="Actividad" className="col-span-2 sm:col-span-1">
          {(fid) => <ActivitySelect id={fid} value={activityId} onChange={setActivityId} />}
        </Field>
        <Field label="Fecha" className="col-span-2 sm:col-span-1">
          {(fid) => <Input id={fid} type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Hora de inicio" className="col-span-2 sm:col-span-1">
          {(fid) => <Input id={fid} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
        </Field>
        <Field label="Duración" hint={`Termina a las ${endLabel}`} className="col-span-2">
          {(fid) => (
            <div className="flex items-center gap-2">
              <Input id={fid} type="number" min={0} max={23} value={hours} onChange={(e) => setHours(e.target.value)} className="w-20" />
              <span className="text-sm text-ink-2">h</span>
              <Input type="number" min={0} max={59} step={5} value={mins} onChange={(e) => setMins(e.target.value)} className="w-20" aria-label="Minutos" />
              <span className="text-sm text-ink-2">min</span>
              <div className="ml-auto hidden gap-1 sm:flex">
                {[25, 45, 60, 90].map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setHours(String(Math.floor(m / 60)));
                      setMins(String(m % 60));
                    }}
                  >
                    {m}′
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Field>
        {openTasks.length > 0 && (
          <Field label="Tarea relacionada (opcional)" className="col-span-2">
            {(fid) => (
              <Select id={fid} value={taskId ?? ''} onChange={(e) => setTaskId(e.target.value || null)}>
                <option value="">Ninguna</option>
                {openTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Concentración" className="col-span-2">
          {() => <Stars value={rating} onChange={setRating} size={22} />}
        </Field>
        <Field label="Notas de la sesión" className="col-span-2">
          {(fid) => (
            <Textarea id={fid} value={note} onChange={(e) => setNote(e.target.value)} placeholder="¿Qué has hecho? ¿Alguna duda pendiente?" />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
      <ConfirmDialog
        open={confirm}
        title="Eliminar sesión"
        message="Esta sesión se eliminará de tus estadísticas."
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          if (!existing) return;
          const copy = existing;
          deleteSession(copy.id);
          close();
          toast('Sesión eliminada', { label: 'Deshacer', onAction: () => addSession(copy) });
        }}
      />
    </Modal>
  );
}

/* ------------------------------------------------------------------ Finalizar temporizador */

export function FinishModal() {
  const close = useUI((s) => s.closeModal);
  const toast = useUI((s) => s.toast);
  const timer = useStore((s) => s.timer);
  const finishTimer = useStore((s) => s.finishTimer);
  const discard = useStore((s) => s.discardTimer);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [captured] = useState(() => Math.round(focusMs(timer, Date.now()) / 1000));
  const [mins, setMins] = useState(String(Math.round(captured / 60)));
  const [confirm, setConfirm] = useState(false);

  const [wasRunning] = useState(timer.running);
  useEffect(() => {
    // Al abrir el diálogo pausamos el reloj para no seguir contando.
    const { setTimer, settings } = useStore.getState();
    setTimer((t) => pause(advance(t, settings.pomodoro, Date.now()).timer, Date.now()));
  }, []);

  const keepGoing = () => {
    if (wasRunning) useStore.getState().setTimer((t) => start(t, Date.now()));
    close();
  };

  const edited = numOrNull(mins);
  const sec = edited !== null && Math.round(captured / 60) !== edited ? edited * 60 : captured;

  const save = () => {
    const id = finishTimer({ rating, note: note.trim(), durationSec: sec });
    close();
    if (id) toast('¡Sesión guardada! Buen trabajo.');
    else toast('Sesión demasiado corta (menos de 1 min): no se ha guardado.');
  };

  return (
    <Modal
      open
      onClose={keepGoing}
      title="Terminar sesión"
      size="sm"
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-critical-ink" onClick={() => setConfirm(true)}>
            Descartar
          </Button>
          <Button onClick={keepGoing}>Seguir estudiando</Button>
          <Button variant="primary" onClick={save}>
            Guardar sesión
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-card-2 p-4 text-center">
          <div className="text-xs text-muted">Tiempo de estudio</div>
          <div className="text-3xl font-semibold tracking-tight">{fmtClock(sec * 1000)}</div>
          {timer.mode === 'pomodoro' && timer.pomodoros > 0 && (
            <div className="mt-1 text-xs text-ink-2">{timer.pomodoros} pomodoro{timer.pomodoros === 1 ? '' : 's'}</div>
          )}
        </div>
        <Field label="Ajustar minutos" hint="Por si olvidaste pausar el temporizador.">
          {(fid) => <Input id={fid} type="number" min={0} value={mins} onChange={(e) => setMins(e.target.value)} />}
        </Field>
        <Field label="¿Qué tal la concentración?">{() => <Stars value={rating} onChange={setRating} size={24} />}</Field>
        <Field label="Notas">
          {(fid) => <Textarea id={fid} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qué has avanzado, dudas…" />}
        </Field>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Descartar sesión"
        message="El tiempo de esta sesión no se guardará."
        confirmLabel="Descartar"
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          discard();
          close();
        }}
      />
    </Modal>
  );
}

/* ------------------------------------------------------------------ Tarea */

export function TaskModal({ id, defaults }: { id?: string; defaults?: Partial<Task> }) {
  const close = useUI((s) => s.closeModal);
  const toast = useUI((s) => s.toast);
  const existing = useStore((s) => (id ? s.tasks.find((x) => x.id === id) : undefined));
  const { addTask, updateTask, deleteTask } = useStore.getState();
  const base = existing ?? defaults ?? {};
  const [title, setTitle] = useState(base.title ?? '');
  const [type, setType] = useState<TaskType>(base.type ?? 'deberes');
  const [subjectId, setSubjectId] = useState<string | null>(base.subjectId ?? null);
  const [due, setDue] = useState(base.due ?? '');
  const [priority, setPriority] = useState<Priority>(base.priority ?? 'media');
  const [status, setStatus] = useState<TaskStatus>(base.status ?? 'pendiente');
  const [estimate, setEstimate] = useState(base.estimateMin ? String(base.estimateMin) : '');
  const [notes, setNotes] = useState(base.notes ?? '');
  const [subtasks, setSubtasks] = useState<Subtask[]>(base.subtasks ?? []);
  const [newSub, setNewSub] = useState('');
  const [confirm, setConfirm] = useState(false);

  const save = () => {
    if (!title.trim()) return;
    const data = {
      title: title.trim(),
      type,
      subjectId,
      due: due || null,
      priority,
      status,
      estimateMin: numOrNull(estimate),
      notes,
      subtasks: newSub.trim() ? [...subtasks, { id: uid(), title: newSub.trim(), done: false }] : subtasks,
    };
    if (existing) updateTask(existing.id, data);
    else {
      addTask({ ...data, createdAt: new Date().toISOString(), completedAt: status === 'hecha' ? new Date().toISOString() : null });
      toast('Tarea creada');
    }
    close();
  };

  const addSub = () => {
    if (!newSub.trim()) return;
    setSubtasks([...subtasks, { id: uid(), title: newSub.trim(), done: false }]);
    setNewSub('');
  };

  return (
    <Modal
      open
      onClose={close}
      title={existing ? 'Editar tarea' : 'Nueva tarea'}
      footer={
        <>
          {existing && (
            <Button variant="ghost" className="mr-auto text-critical-ink" onClick={() => setConfirm(true)}>
              <Trash size={16} /> Eliminar
            </Button>
          )}
          <Button onClick={close}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={!title.trim()}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Título" className="col-span-2">
          {(fid) => <Input id={fid} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Ejercicios tema 4" />}
        </Field>
        <Field label="Tipo" className="col-span-2 sm:col-span-1">
          {(fid) => (
            <Select id={fid} value={type} onChange={(e) => setType(e.target.value as TaskType)}>
              {TASK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Asignatura" className="col-span-2 sm:col-span-1">
          {(fid) => <SubjectSelect id={fid} value={subjectId} onChange={setSubjectId} />}
        </Field>
        <Field label="Fecha de entrega" className="col-span-2 sm:col-span-1">
          {(fid) => <Input id={fid} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}
        </Field>
        <Field label="Prioridad" className="col-span-2 sm:col-span-1">
          {(fid) => (
            <Select id={fid} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Estado" className="col-span-2 sm:col-span-1">
          {(fid) => (
            <Select id={fid} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {TASK_STATUS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Tiempo estimado (min)" className="col-span-2 sm:col-span-1">
          {(fid) => <Input id={fid} type="number" min={0} step={15} value={estimate} onChange={(e) => setEstimate(e.target.value)} />}
        </Field>
        <Field label="Subtareas" className="col-span-2">
          {(fid) => (
            <div className="flex flex-col gap-1.5">
              {subtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={st.done}
                    onChange={(v) => setSubtasks(subtasks.map((x) => (x.id === st.id ? { ...x, done: v } : x)))}
                    label={<span className={cx(st.done && 'text-muted line-through')}>{st.title}</span>}
                    className="flex-1"
                  />
                  <IconButton label="Quitar subtarea" onClick={() => setSubtasks(subtasks.filter((x) => x.id !== st.id))}>
                    <X size={15} />
                  </IconButton>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  id={fid}
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  placeholder="Añadir subtarea…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSub();
                    }
                  }}
                />
                <Button onClick={addSub} aria-label="Añadir subtarea">
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          )}
        </Field>
        <Field label="Notas" className="col-span-2">
          {(fid) => <Textarea id={fid} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instrucciones, enlaces, requisitos…" />}
        </Field>
        <button type="submit" hidden />
      </form>
      <ConfirmDialog
        open={confirm}
        title="Eliminar tarea"
        message={`¿Eliminar "${existing?.title}"?`}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          if (!existing) return;
          const copy = existing;
          deleteTask(copy.id);
          close();
          toast('Tarea eliminada', { label: 'Deshacer', onAction: () => addTask(copy) });
        }}
      />
    </Modal>
  );
}

/* ------------------------------------------------------------------ Examen */

export function ExamModal({ id, defaults }: { id?: string; defaults?: Partial<Exam> }) {
  const close = useUI((s) => s.closeModal);
  const toast = useUI((s) => s.toast);
  const scale = useStore((s) => s.settings.gradeScale);
  const existing = useStore((s) => (id ? s.exams.find((x) => x.id === id) : undefined));
  const { addExam, updateExam, deleteExam } = useStore.getState();
  const base = existing ?? defaults ?? {};
  const [title, setTitle] = useState(base.title ?? '');
  const [type, setType] = useState<ExamType>(base.type ?? 'parcial');
  const [subjectId, setSubjectId] = useState<string | null>(base.subjectId ?? null);
  const [date, setDate] = useState(base.date ?? '');
  const [time, setTime] = useState(base.time ?? '');
  const [location, setLocation] = useState(base.location ?? '');
  const [topics, setTopics] = useState(base.topics ?? '');
  const [target, setTarget] = useState(base.targetHours ? String(base.targetHours) : '');
  const [prepFrom, setPrepFrom] = useState(base.prepFrom ?? '');
  const [grade, setGrade] = useState(base.grade !== null && base.grade !== undefined ? String(base.grade) : '');
  const [weight, setWeight] = useState(base.weight ? String(base.weight) : '');
  const [notes, setNotes] = useState(base.notes ?? '');
  const [confirm, setConfirm] = useState(false);
  const valid = !!title.trim() && !!date;

  const save = () => {
    if (!valid) return;
    const data = {
      title: title.trim(),
      type,
      subjectId,
      date,
      time,
      location,
      topics,
      targetHours: numOrNull(target),
      prepFrom: prepFrom || null,
      grade: numOrNull(grade),
      weight: numOrNull(weight),
      notes,
    };
    if (existing) updateExam(existing.id, data);
    else {
      addExam({ ...data, createdAt: new Date().toISOString() });
      toast('Examen añadido');
    }
    close();
  };

  return (
    <Modal
      open
      onClose={close}
      title={existing ? 'Editar examen' : 'Nuevo examen o evaluación'}
      footer={
        <>
          {existing && (
            <Button variant="ghost" className="mr-auto text-critical-ink" onClick={() => setConfirm(true)}>
              <Trash size={16} /> Eliminar
            </Button>
          )}
          <Button onClick={close}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Título" className="col-span-2">
          {(fid) => <Input id={fid} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Parcial 2" />}
        </Field>
        <Field label="Asignatura" className="col-span-2 sm:col-span-1">
          {(fid) => <SubjectSelect id={fid} value={subjectId} onChange={setSubjectId} />}
        </Field>
        <Field label="Tipo" className="col-span-2 sm:col-span-1">
          {(fid) => (
            <Select id={fid} value={type} onChange={(e) => setType(e.target.value as ExamType)}>
              {EXAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fecha" className="col-span-1">
          {(fid) => <Input id={fid} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Hora" className="col-span-1">
          {(fid) => <Input id={fid} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
        </Field>
        <Field label="Lugar / aula" className="col-span-2">
          {(fid) => <Input id={fid} value={location} onChange={(e) => setLocation(e.target.value)} />}
        </Field>
        <Field label="Temario" className="col-span-2">
          {(fid) => <Textarea id={fid} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="Temas que entran…" />}
        </Field>
        <Field label="Horas de preparación (objetivo)" className="col-span-2 sm:col-span-1" hint="Se cuentan las horas de la asignatura.">
          {(fid) => <Input id={fid} type="number" min={0} step={1} value={target} onChange={(e) => setTarget(e.target.value)} />}
        </Field>
        <Field label="Contar horas desde" className="col-span-2 sm:col-span-1" hint="Vacío: desde el examen anterior de la asignatura.">
          {(fid) => <Input id={fid} type="date" value={prepFrom} onChange={(e) => setPrepFrom(e.target.value)} />}
        </Field>
        <Field label={`Nota obtenida (${scale.min}–${scale.max})`} className="col-span-1">
          {(fid) => (
            <Input id={fid} type="number" step="0.01" min={scale.min} max={scale.max} value={grade} onChange={(e) => setGrade(e.target.value)} />
          )}
        </Field>
        <Field label="Peso en la nota (%)" className="col-span-1">
          {(fid) => <Input id={fid} type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(e.target.value)} />}
        </Field>
        <Field label="Notas" className="col-span-2">
          {(fid) => <Textarea id={fid} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
      <ConfirmDialog
        open={confirm}
        title="Eliminar examen"
        message={`¿Eliminar "${existing?.title}"?`}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          if (!existing) return;
          const copy = existing;
          deleteExam(copy.id);
          close();
          toast('Examen eliminado', { label: 'Deshacer', onAction: () => addExam(copy) });
        }}
      />
    </Modal>
  );
}

/* ------------------------------------------------------------------ Asignatura */

export function ColorPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {COLOR_NAMES.map((name, i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={name}
          title={name}
          onClick={() => onChange(i)}
          className={cx(
            'h-8 w-8 rounded-full transition-transform hover:scale-110',
            value === i && 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--card)]',
          )}
          style={{ background: `var(--s${i})` }}
        />
      ))}
    </div>
  );
}

export function SubjectModal({ id, defaults }: { id?: string; defaults?: Partial<Subject> }) {
  const close = useUI((s) => s.closeModal);
  const toast = useUI((s) => s.toast);
  const subjects = useStore((s) => s.subjects);
  const semesters = useStore((s) => s.semesters);
  const currentSemesterId = useStore((s) => s.settings.currentSemesterId);
  const existing = subjects.find((x) => x.id === id);
  const { addSubject, updateSubject, deleteSubject } = useStore.getState();
  const base = existing ?? defaults ?? {};
  // Siguiente color libre en orden fijo.
  const nextColor = useMemo(() => {
    const used = new Set(subjects.filter((s) => !s.archived).map((s) => s.color));
    for (let i = 0; i < 8; i++) if (!used.has(i)) return i;
    return subjects.length % 8;
  }, [subjects]);
  const [name, setName] = useState(base.name ?? '');
  const [color, setColor] = useState(base.color ?? nextColor);
  const [semesterId, setSemesterId] = useState<string | null>(base.semesterId ?? currentSemesterId ?? null);
  const [target, setTarget] = useState(base.targetHours ? String(base.targetHours) : '');
  const [weekly, setWeekly] = useState(base.weeklyGoalMin ? String(base.weeklyGoalMin / 60) : '');
  const [credits, setCredits] = useState(base.credits ? String(base.credits) : '');
  const [teacher, setTeacher] = useState(base.teacher ?? '');
  const [archived, setArchived] = useState(base.archived ?? false);
  const [confirm, setConfirm] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    const w = numOrNull(weekly);
    const data = {
      name: name.trim(),
      color,
      semesterId,
      targetHours: numOrNull(target),
      weeklyGoalMin: w !== null ? Math.round(w * 60) : null,
      credits: numOrNull(credits),
      teacher,
      archived,
    };
    if (existing) updateSubject(existing.id, data);
    else {
      addSubject({ ...data, createdAt: new Date().toISOString() });
      toast(`Asignatura "${data.name}" creada`);
    }
    close();
  };

  return (
    <Modal
      open
      onClose={close}
      title={existing ? 'Editar asignatura' : 'Nueva asignatura'}
      footer={
        <>
          {existing && (
            <Button variant="ghost" className="mr-auto text-critical-ink" onClick={() => setConfirm(true)}>
              <Trash size={16} /> Eliminar
            </Button>
          )}
          <Button onClick={close}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Nombre" className="col-span-2">
          {(fid) => <Input id={fid} value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Matemáticas" />}
        </Field>
        <Field label="Color" className="col-span-2">
          {() => <ColorPicker value={color} onChange={setColor} />}
        </Field>
        <Field label="Semestre / curso" className="col-span-2 sm:col-span-1">
          {(fid) => (
            <Select id={fid} value={semesterId ?? ''} onChange={(e) => setSemesterId(e.target.value || null)}>
              <option value="">Sin semestre</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Profesor/a" className="col-span-2 sm:col-span-1">
          {(fid) => <Input id={fid} value={teacher} onChange={(e) => setTeacher(e.target.value)} />}
        </Field>
        <Field label="Objetivo semanal (h)" className="col-span-1">
          {(fid) => <Input id={fid} type="number" min={0} step={0.5} value={weekly} onChange={(e) => setWeekly(e.target.value)} />}
        </Field>
        <Field label="Horas objetivo del semestre" className="col-span-1">
          {(fid) => <Input id={fid} type="number" min={0} value={target} onChange={(e) => setTarget(e.target.value)} />}
        </Field>
        <Field label="Créditos" className="col-span-1" hint="Para la media ponderada.">
          {(fid) => <Input id={fid} type="number" min={0} step={0.5} value={credits} onChange={(e) => setCredits(e.target.value)} />}
        </Field>
        <div className="col-span-1 flex items-end pb-2">
          <Checkbox checked={archived} onChange={setArchived} label="Archivada" />
        </div>
        <button type="submit" hidden />
      </form>
      <ConfirmDialog
        open={confirm}
        title="Eliminar asignatura"
        message="Sus sesiones, tareas y exámenes se conservarán como «Sin asignatura». Si solo quieres ocultarla, mejor archívala."
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          if (!existing) return;
          deleteSubject(existing.id);
          close();
          toast('Asignatura eliminada');
        }}
      />
    </Modal>
  );
}

/** Renderiza el modal global activo. */
export function GlobalModals() {
  const modal = useUI((s) => s.modal);
  if (!modal) return null;
  const key = `${modal.kind}-${'id' in modal ? (modal.id ?? 'new') : ''}`;
  switch (modal.kind) {
    case 'session':
      return <SessionModal key={key} id={modal.id} defaults={modal.defaults} />;
    case 'task':
      return <TaskModal key={key} id={modal.id} defaults={modal.defaults} />;
    case 'exam':
      return <ExamModal key={key} id={modal.id} defaults={modal.defaults} />;
    case 'subject':
      return <SubjectModal key={key} id={modal.id} defaults={modal.defaults} />;
    case 'finish':
      return <FinishModal key={key} />;
  }
}
