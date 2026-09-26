import { useMemo, useState } from 'react';
import { ListChecks, Plus, Search } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { useToday } from '../lib/hooks';
import { addDaysKey, diffDays } from '../lib/dates';
import { TASK_TYPES } from '../lib/labels';
import type { Task, TaskStatus } from '../lib/types';
import { TaskRow } from '../components/items';
import { SubjectSelect } from '../components/forms';
import { Button, Card, cx, EmptyState, Input, PageHeader, Segmented, Select } from '../components/ui';

type View = 'lista' | 'tablero';

export default function Tasks() {
  const tasks = useStore((s) => s.tasks);
  const updateTask = useStore((s) => s.updateTask);
  const openModal = useUI((s) => s.openModal);
  const today = useToday();
  const [view, setView] = useState<View>('lista');
  const [subject, setSubject] = useState<string | null>(null);
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [quick, setQuick] = useState('');

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (subject && t.subjectId !== subject) return false;
        if (type && t.type !== type) return false;
        if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [tasks, subject, type, q],
  );

  const sorter = (a: Task, b: Task) =>
    (a.due ?? '9999').localeCompare(b.due ?? '9999') || prio(a.priority) - prio(b.priority) || a.createdAt.localeCompare(b.createdAt);

  const open = filtered.filter((t) => t.status !== 'hecha').sort(sorter);
  const done = filtered
    .filter((t) => t.status === 'hecha')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  const weekEnd = addDaysKey(today, 7);
  const groups: { id: string; title: string; items: Task[]; tone?: string }[] = [
    { id: 'late', title: 'Atrasadas', items: open.filter((t) => t.due && t.due < today), tone: 'text-critical-ink' },
    { id: 'today', title: 'Hoy', items: open.filter((t) => t.due === today) },
    { id: 'week', title: 'Próximos 7 días', items: open.filter((t) => t.due && t.due > today && t.due <= weekEnd) },
    { id: 'later', title: 'Más adelante', items: open.filter((t) => t.due && t.due > weekEnd) },
    { id: 'nodate', title: 'Sin fecha', items: open.filter((t) => !t.due) },
  ];

  const addQuick = () => {
    const title = quick.trim();
    if (!title) return;
    useStore.getState().addTask({
      title,
      type: 'deberes',
      subjectId: subject,
      due: null,
      priority: 'media',
      status: 'pendiente',
      estimateMin: null,
      notes: '',
      subtasks: [],
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    setQuick('');
  };

  const overdue = groups[0].items.length;
  const dueSoon = open.filter((t) => t.due && diffDays(t.due, today) >= 0 && diffDays(t.due, today) <= 2).length;

  return (
    <div>
      <PageHeader
        title="Tareas"
        subtitle={`${open.length} pendientes${overdue ? ` · ${overdue} atrasadas` : ''}${dueSoon ? ` · ${dueSoon} para los próximos 2 días` : ''}`}
        actions={
          <>
            <Segmented<View>
              value={view}
              onChange={setView}
              options={[
                { value: 'lista', label: 'Lista' },
                { value: 'tablero', label: 'Tablero' },
              ]}
            />
            <Button variant="primary" onClick={() => openModal({ kind: 'task', defaults: { subjectId: subject } })}>
              <Plus size={16} /> Nueva tarea
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <form
            className="md:col-span-2"
            onSubmit={(e) => {
              e.preventDefault();
              addQuick();
            }}
          >
            <Input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Añadir tarea rápida y pulsar Enter…" aria-label="Tarea rápida" />
          </form>
          <SubjectSelect value={subject} onChange={setSubject} noneLabel="Todas las asignaturas" />
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">
            <option value="">Todos los tipos</option>
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="relative mt-3">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="pl-9" aria-label="Buscar tareas" />
        </div>
      </Card>

      {tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks size={28} />}
            title="No tienes tareas"
            description="Apunta deberes, trabajos, proyectos y lecturas con su fecha de entrega."
            action={<Button variant="primary" onClick={() => openModal({ kind: 'task' })}>Crear la primera</Button>}
          />
        </Card>
      ) : view === 'lista' ? (
        <div className="flex flex-col gap-4">
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <Card key={g.id}>
                <div className={cx('flex items-center justify-between border-b border-line px-5 py-2.5 text-sm font-semibold', g.tone)}>
                  {g.title}
                  <span className="text-[13px] font-normal text-muted">{g.items.length}</span>
                </div>
                <div className="px-3 py-2">
                  {g.items.map((t) => (
                    <TaskRow key={t.id} task={t} today={today} />
                  ))}
                </div>
              </Card>
            ))}
          {open.length === 0 && (
            <Card>
              <EmptyState title="¡Todo hecho! 🎉" description="No te quedan tareas pendientes con estos filtros." />
            </Card>
          )}
          {done.length > 0 && (
            <Card>
              <button className="flex w-full items-center justify-between px-5 py-2.5 text-sm font-semibold text-ink-2" onClick={() => setShowDone(!showDone)}>
                Completadas ({done.length})
                <span className="text-[13px] font-normal text-accent-ink">{showDone ? 'Ocultar' : 'Mostrar'}</span>
              </button>
              {showDone && (
                <div className="border-t border-line px-3 py-2">
                  {done.slice(0, 100).map((t) => (
                    <TaskRow key={t.id} task={t} today={today} />
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      ) : (
        <Board tasks={[...open, ...done]} today={today} onMove={(id, status) => updateTask(id, { status })} />
      )}
    </div>
  );
}

function Board({ tasks, today, onMove }: { tasks: Task[]; today: string; onMove: (id: string, s: TaskStatus) => void }) {
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const cols: { id: TaskStatus; title: string }[] = [
    { id: 'pendiente', title: 'Pendiente' },
    { id: 'en_progreso', title: 'En progreso' },
    { id: 'hecha', title: 'Hecha' },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {cols.map((c) => {
        const items = tasks.filter((t) => t.status === c.id);
        return (
          <div
            key={c.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(c.id);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/plain');
              if (id) onMove(id, c.id);
              setDragOver(null);
            }}
            className={cx('rounded-2xl border bg-card-2 p-2 transition-colors', dragOver === c.id ? 'border-accent' : 'border-line')}
          >
            <div className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">
              {c.title}
              <span className="text-[13px] font-normal text-muted">{items.length}</span>
            </div>
            <div className="flex min-h-24 flex-col gap-2">
              {items.slice(0, 60).map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                  className="cursor-grab rounded-xl border border-line bg-card active:cursor-grabbing"
                >
                  <TaskRow task={t} today={today} compact />
                  <div className="flex gap-1 px-2 pb-2 md:hidden">
                    {cols
                      .filter((x) => x.id !== c.id)
                      .map((x) => (
                        <Button key={x.id} size="sm" variant="ghost" onClick={() => onMove(t.id, x.id)}>
                          → {x.title}
                        </Button>
                      ))}
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-muted">Arrastra tareas aquí</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function prio(p: string) {
  return p === 'alta' ? 0 : p === 'media' ? 1 : 2;
}
