import { addDaysKey, combineDateTime, fromKey, todayKey } from './dates';
import { emptyData, uid } from './defaults';
import type { AppData, Exam, Note, Session, Subject, Task } from './types';

/** Generador pseudoaleatorio con semilla, para que el ejemplo sea siempre igual. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Crea un conjunto de datos de ejemplo realista (unos 3 meses). */
export function demoData(userName = ''): AppData {
  const r = rng(42);
  const pick = <X,>(xs: X[]) => xs[Math.floor(r() * xs.length)];
  const today = todayKey();
  const d = emptyData();
  d.settings.userName = userName;
  d.settings.onboarded = true;

  const semId = uid();
  d.semesters = [
    { id: semId, name: 'Semestre actual', start: addDaysKey(today, -80), end: addDaysKey(today, 60) },
  ];
  d.settings.currentSemesterId = semId;

  const mk = (name: string, color: number, target: number, weekly: number, credits: number): Subject => ({
    id: uid(),
    name,
    color,
    semesterId: semId,
    targetHours: target,
    weeklyGoalMin: weekly,
    credits,
    teacher: '',
    archived: false,
    createdAt: new Date().toISOString(),
  });
  const subjects = [
    mk('Matemáticas', 0, 90, 300, 6),
    mk('Física', 1, 70, 240, 6),
    mk('Programación', 2, 80, 240, 6),
    mk('Historia', 3, 40, 120, 4),
    mk('Inglés', 4, 35, 120, 3),
    mk('Química', 5, 50, 180, 5),
  ];
  d.subjects = subjects;
  const weights = [0.26, 0.2, 0.2, 0.12, 0.1, 0.12];
  const pickSubject = () => {
    let x = r();
    for (let i = 0; i < subjects.length; i++) {
      x -= weights[i];
      if (x <= 0) return subjects[i];
    }
    return subjects[0];
  };

  const sessions: Session[] = [];
  const notesTxt = [
    '',
    '',
    '',
    'Repasé los apuntes del tema 3.',
    'Ejercicios del boletín, me costaron los últimos.',
    'Buen ritmo, sin distracciones.',
    'Tengo que preguntar dudas en tutoría.',
  ];
  for (let i = 80; i >= 0; i--) {
    const day = addDaysKey(today, -i);
    const wd = fromKey(day).getDay();
    const weekend = wd === 0 || wd === 6;
    if (r() < (weekend ? 0.35 : 0.1)) continue; // día libre
    const n = 1 + Math.floor(r() * (weekend ? 2 : 4));
    let hour = weekend ? 10 + Math.floor(r() * 3) : 15 + Math.floor(r() * 3);
    if (r() < 0.15) hour = 7;
    for (let k = 0; k < n; k++) {
      const pomodoro = r() < 0.55;
      const pomos = pomodoro ? 1 + Math.floor(r() * 4) : 0;
      const dur = pomodoro ? pomos * 25 * 60 : (20 + Math.floor(r() * 100)) * 60;
      const minute = Math.floor(r() * 50);
      const start = combineDateTime(day, `${String(Math.min(hour, 23)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      if (i === 0 && new Date(start).getTime() + dur * 1000 > Date.now()) break;
      sessions.push({
        id: uid(),
        subjectId: pickSubject().id,
        activityId: pick(d.activities).id,
        taskId: null,
        start,
        durationSec: dur,
        pomodoros: pomos,
        rating: 2 + Math.floor(r() * 4),
        note: pick(notesTxt),
        source: pomodoro ? 'timer' : 'manual',
      });
      hour += Math.ceil(dur / 3600) + (r() < 0.5 ? 1 : 0);
      if (hour > 23) break;
    }
  }
  d.sessions = sessions;

  const [mat, fis, prog, hist, ing, qui] = subjects;
  const task = (
    title: string,
    subject: Subject,
    due: number | null,
    type: Task['type'],
    priority: Task['priority'],
    status: Task['status'] = 'pendiente',
    subtasks: string[] = [],
  ): Task => ({
    id: uid(),
    title,
    type,
    subjectId: subject.id,
    due: due === null ? null : addDaysKey(today, due),
    priority,
    status,
    estimateMin: 60 + Math.floor(r() * 4) * 30,
    notes: '',
    subtasks: subtasks.map((t, i) => ({ id: uid(), title: t, done: i === 0 })),
    createdAt: new Date().toISOString(),
    completedAt: status === 'hecha' ? new Date().toISOString() : null,
  });
  d.tasks = [
    task('Boletín de integrales (ej. 1-15)', mat, 1, 'deberes', 'alta', 'en_progreso'),
    task('Informe de laboratorio: péndulo', fis, 4, 'trabajo', 'alta', 'pendiente', [
      'Tomar medidas',
      'Hacer gráficas',
      'Redactar conclusiones',
    ]),
    task('Práctica 3: listas enlazadas', prog, 6, 'proyecto', 'media'),
    task('Leer capítulo 5 (Revolución industrial)', hist, 2, 'lectura', 'media'),
    task('Redacción "My last holidays"', ing, -1, 'deberes', 'media'),
    task('Formulación orgánica', qui, 9, 'repaso', 'baja'),
    task('Resumen tema 2', hist, -5, 'deberes', 'baja', 'hecha'),
    task('Ejercicios de vectores', fis, -3, 'deberes', 'media', 'hecha'),
    task('Organizar apuntes', mat, null, 'otro', 'baja'),
  ];

  const exam = (
    title: string,
    subject: Subject,
    days: number,
    type: Exam['type'],
    weight: number,
    grade: number | null,
    target: number | null,
  ): Exam => ({
    id: uid(),
    title,
    subjectId: subject.id,
    type,
    date: addDaysKey(today, days),
    time: '09:00',
    location: 'Aula 2.1',
    topics: '',
    targetHours: target,
    prepFrom: null,
    grade,
    weight,
    notes: '',
    createdAt: new Date().toISOString(),
  });
  d.exams = [
    exam('Parcial 1', mat, -30, 'parcial', 30, 7.5, 15),
    exam('Parcial 1', fis, -25, 'parcial', 30, 6.2, 12),
    exam('Práctica 1', prog, -20, 'practica', 20, 9, null),
    exam('Quiz vocabulario', ing, -12, 'quiz', 10, 8.4, null),
    exam('Parcial 2', mat, 6, 'parcial', 30, null, 20),
    exam('Examen tema 1-4', hist, 11, 'parcial', 50, null, 10),
    exam('Parcial 2', fis, 16, 'parcial', 30, null, 15),
    exam('Oral', ing, 21, 'oral', 30, null, 6),
    exam('Examen final', qui, 40, 'final', 60, null, 30),
  ];

  const note = (title: string, content: string, subject: Subject | null, tags: string[], pinned = false): Note => ({
    id: uid(),
    title,
    content,
    subjectId: subject?.id ?? null,
    tags,
    pinned,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  d.notes = [
    note(
      'Fórmulas de derivadas',
      '# Derivadas básicas\n\n- (x^n)\' = n·x^(n-1)\n- (sen x)\' = cos x\n- (e^x)\' = e^x\n\n**Regla de la cadena:** (f(g(x)))\' = f\'(g(x))·g\'(x)',
      mat,
      ['fórmulas', 'examen'],
      true,
    ),
    note(
      'Plan para el parcial de Física',
      '## Temas\n\n- [x] Cinemática\n- [x] Dinámica\n- [ ] Trabajo y energía\n- [ ] Momento lineal\n\nRepasar los problemas del boletín 4.',
      fis,
      ['plan'],
    ),
    note('Ideas práctica 3', 'Usar *nodos centinela* para simplificar las inserciones.\n\nPreguntar si se puede usar `std::list`.', prog, ['práctica']),
    note('Vocabulario útil', '- nevertheless = sin embargo\n- although = aunque\n- whereas = mientras que', ing, ['vocabulario']),
  ];

  return d;
}
