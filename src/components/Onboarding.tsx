import { useState } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { demoData } from '../lib/demo';
import { addDaysKey, todayKey } from '../lib/dates';
import { Button, Field, Input } from './ui';
import { COLOR_NAMES } from '../lib/labels';

/** Primer uso: nombre, asignaturas y objetivo diario. */
export function Onboarding() {
  const [name, setName] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [weekday, setWeekday] = useState('3');
  const [weekend, setWeekend] = useState('1.5');
  const st = useStore.getState();

  const addDraft = () => {
    const parts = draft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setSubjects([...subjects, ...parts].slice(0, 12));
    setDraft('');
  };

  const start = () => {
    const wd = Math.max(0, Number(weekday.replace(',', '.')) || 0) * 60;
    const we = Math.max(0, Number(weekend.replace(',', '.')) || 0) * 60;
    const today = todayKey();
    const semId = st.addSemester({ name: 'Semestre actual', start: today, end: addDaysKey(today, 120) });
    const all = draft.trim() ? [...subjects, ...draft.split(',').map((s) => s.trim()).filter(Boolean)] : subjects;
    all.forEach((n, i) =>
      st.addSubject({
        name: n,
        color: i % COLOR_NAMES.length,
        semesterId: semId,
        targetHours: null,
        weeklyGoalMin: null,
        credits: null,
        teacher: '',
        archived: false,
        createdAt: new Date().toISOString(),
      }),
    );
    st.updateSettings({
      userName: name.trim(),
      dailyGoals: [we, wd, wd, wd, wd, wd, we],
      weeklyGoalMin: Math.round(wd * 5 + we * 2),
      currentSemesterId: semId,
      onboarded: true,
    });
  };

  const demo = () => {
    st.replaceData(demoData(name.trim()));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-bg/95 p-4 backdrop-blur-sm">
      <div className="animate-pop max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-2xl sm:p-8">
        <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-on-accent">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M7 10.8V15c0 1.4 2.2 3 5 3s5-1.6 5-3v-4.2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Bienvenido a Studium</h1>
        <p className="mt-1 text-sm text-ink-2">
          Registra tus horas de estudio, organiza tareas y exámenes y mira tu progreso. Todo se guarda en este
          navegador; puedes hacer copias de seguridad en Ajustes.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <Field label="¿Cómo te llamas? (opcional)">
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />}
          </Field>
          <Field label="Tus asignaturas" hint="Escribe y pulsa Enter. Puedes separar varias con comas.">
            {(id) => (
              <div>
                <div className="flex gap-2">
                  <Input
                    id={id}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Matemáticas, Historia, Inglés…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addDraft();
                      }
                    }}
                  />
                  <Button onClick={addDraft} aria-label="Añadir asignatura">
                    <Plus size={16} />
                  </Button>
                </div>
                {subjects.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {subjects.map((s, i) => (
                      <span key={`${s}-${i}`} className="inline-flex items-center gap-1.5 rounded-full border border-line py-1 pr-1.5 pl-2.5 text-[13px]">
                        <span className="h-2 w-2 rounded-full" style={{ background: `var(--s${i % 8})` }} />
                        {s}
                        <button
                          className="rounded-full p-0.5 text-muted hover:bg-hover"
                          aria-label={`Quitar ${s}`}
                          onClick={() => setSubjects(subjects.filter((_, j) => j !== i))}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Objetivo diario lun–vie (h)">
              {(id) => <Input id={id} type="number" min={0} step={0.5} value={weekday} onChange={(e) => setWeekday(e.target.value)} />}
            </Field>
            <Field label="Fin de semana (h)">
              {(id) => <Input id={id} type="number" min={0} step={0.5} value={weekend} onChange={(e) => setWeekend(e.target.value)} />}
            </Field>
          </div>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={demo}>
            <Sparkles size={16} /> Ver con datos de ejemplo
          </Button>
          <Button variant="primary" size="lg" onClick={start}>
            Empezar
          </Button>
        </div>
      </div>
    </div>
  );
}
