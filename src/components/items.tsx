import { CalendarClock, Flag, MapPin, StickyNote } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { subjectColor, subjectName, useSubjectMap } from '../lib/hooks';
import { capitalize, diffDays, fmt, fmtDuration, relativeDay, timeOf } from '../lib/dates';
import { examPrep } from '../lib/stats';
import { EXAM_TYPES, labelOf, TASK_TYPES } from '../lib/labels';
import type { Exam, Session, Task } from '../lib/types';
import { Chip, cx, Meter } from './ui';

export function SubjectTag({ id, className }: { id: string | null; className?: string }) {
  const map = useSubjectMap();
  const s = id ? map.get(id) : null;
  return (
    <span className={cx('inline-flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-2', className)}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: subjectColor(s) }} />
      <span className="truncate">{subjectName(id, map)}</span>
    </span>
  );
}

export function DueChip({ due, today, done }: { due: string | null; today: string; done?: boolean }) {
  if (!due) return <Chip>Sin fecha</Chip>;
  const d = diffDays(due, today);
  const text = capitalize(relativeDay(due, today));
  if (done) return <Chip>{capitalize(fmt(due, 'd MMM'))}</Chip>;
  if (d < 0)
    return (
      <Chip tone="critical">
        <Flag size={11} /> Atrasada · {text.toLowerCase()}
      </Chip>
    );
  if (d === 0) return <Chip tone="warning">Hoy</Chip>;
  if (d <= 2) return <Chip tone="warning">{text}</Chip>;
  return <Chip>{d < 7 ? `${text} · ${fmt(due, 'EEE')}` : capitalize(fmt(due, 'd MMM'))}</Chip>;
}

export function TaskRow({ task, today, compact }: { task: Task; today: string; compact?: boolean }) {
  const toggle = useStore((s) => s.toggleTask);
  const open = useUI((s) => s.openModal);
  const done = task.status === 'hecha';
  const subDone = task.subtasks.filter((s) => s.done).length;
  return (
    <div className="group flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-hover">
      <button
        onClick={() => toggle(task.id)}
        aria-label={done ? 'Marcar como pendiente' : 'Marcar como hecha'}
        className={cx(
          'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          done ? 'border-accent bg-accent text-on-accent' : 'border-line-2 hover:border-accent',
        )}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
            <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={() => open({ kind: 'task', id: task.id })}>
        <div className="flex items-center gap-2">
          <span className={cx('truncate text-sm font-medium', done ? 'text-muted line-through' : 'text-ink')}>{task.title}</span>
          {task.priority === 'alta' && !done && (
            <span className="shrink-0 text-[11px] font-semibold text-critical-ink" title="Prioridad alta">
              !!
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <SubjectTag id={task.subjectId} />
          {!compact && <span className="text-[12px] text-muted">{labelOf(TASK_TYPES, task.type)}</span>}
          {task.status === 'en_progreso' && <Chip tone="accent">En progreso</Chip>}
          {task.subtasks.length > 0 && (
            <span className="tabular text-[12px] text-muted">
              {subDone}/{task.subtasks.length} subtareas
            </span>
          )}
        </div>
      </button>
      <div className="shrink-0 pt-0.5">
        <DueChip due={task.due} today={today} done={done} />
      </div>
    </div>
  );
}

export function ExamRow({ exam, today, showPrep = true }: { exam: Exam; today: string; showPrep?: boolean }) {
  const open = useUI((s) => s.openModal);
  const exams = useStore((s) => s.exams);
  const sessions = useStore((s) => s.sessions);
  const map = useSubjectMap();
  const subject = exam.subjectId ? map.get(exam.subjectId) : null;
  const d = diffDays(exam.date, today);
  const past = d < 0;
  const prep = showPrep && !past ? examPrep(exam, exams, sessions, today) : null;
  const scale = useStore((s) => s.settings.gradeScale);
  return (
    <button onClick={() => open({ kind: 'exam', id: exam.id })} className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover">
      <div
        className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-line py-1"
        style={{ borderTop: `3px solid ${subjectColor(subject)}` }}
      >
        <span className="text-[10.5px] font-medium text-muted uppercase">{fmt(exam.date, 'MMM')}</span>
        <span className="text-lg leading-tight font-semibold">{fmt(exam.date, 'd')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{exam.title}</span>
          <span className="shrink-0 text-[12px] text-muted">{labelOf(EXAM_TYPES, exam.type)}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <SubjectTag id={exam.subjectId} />
          {exam.time && (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted">
              <CalendarClock size={12} /> {exam.time}
            </span>
          )}
          {exam.location && (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted">
              <MapPin size={12} /> {exam.location}
            </span>
          )}
        </div>
        {prep && prep.targetSec !== null && (
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[11.5px] text-muted">
              <span className="tabular">
                Preparación: {fmtDuration(prep.studiedSec, { compact: true })} de {fmtDuration(prep.targetSec, { compact: true })}
              </span>
              {prep.perDaySec !== null && prep.perDaySec > 0 && <span>{fmtDuration(prep.perDaySec, { compact: true })}/día</span>}
            </div>
            <Meter value={prep.studiedSec} max={prep.targetSec} color={subjectColor(subject)} height={5} />
          </div>
        )}
      </div>
      <div className="shrink-0">
        {past ? (
          exam.grade !== null ? (
            <Chip tone={exam.grade >= scale.pass ? 'good' : 'critical'}>
              {exam.grade >= scale.pass ? '✓' : '✗'} {exam.grade.toLocaleString('es-ES')}
            </Chip>
          ) : (
            <Chip>Sin nota</Chip>
          )
        ) : d === 0 ? (
          <Chip tone="critical">¡Hoy!</Chip>
        ) : d <= 3 ? (
          <Chip tone="warning">{relativeDay(exam.date, today)}</Chip>
        ) : (
          <Chip tone="accent">{relativeDay(exam.date, today)}</Chip>
        )}
      </div>
    </button>
  );
}

export function SessionRow({ session, showDate }: { session: Session; showDate?: boolean }) {
  const open = useUI((s) => s.openModal);
  const map = useSubjectMap();
  const activities = useStore((s) => s.activities);
  const tasks = useStore((s) => s.tasks);
  const subject = session.subjectId ? map.get(session.subjectId) : null;
  const act = activities.find((a) => a.id === session.activityId);
  const task = session.taskId ? tasks.find((t) => t.id === session.taskId) : null;
  const end = new Date(new Date(session.start).getTime() + session.durationSec * 1000).toISOString();
  return (
    <button onClick={() => open({ kind: 'session', id: session.id })} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover">
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: subjectColor(subject) }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{subjectName(session.subjectId, map)}</span>
          {act && <span className="shrink-0 text-[12px] text-muted">{act.name}</span>}
          {session.pomodoros > 0 && <span className="shrink-0 text-[12px] text-muted">· {session.pomodoros} 🍅</span>}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[12px] text-muted">
          <span className="tabular shrink-0">
            {showDate && `${capitalize(fmt(session.start, 'EEE d MMM'))} · `}
            {timeOf(session.start)}–{timeOf(end)}
          </span>
          {task && <span className="truncate">· {task.title}</span>}
          {session.note && (
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <StickyNote size={11} className="shrink-0" /> <span className="truncate">{session.note}</span>
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="tabular text-sm font-semibold">{fmtDuration(session.durationSec, { compact: true })}</div>
        {session.rating > 0 && <div className="text-[11px] text-[#c98500]">{'★'.repeat(session.rating)}</div>}
      </div>
    </button>
  );
}
