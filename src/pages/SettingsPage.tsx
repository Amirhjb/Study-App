import { useRef, useState } from 'react';
import { Database, Download, Monitor, Moon, Plus, Sparkles, Sun, Trash, Upload } from 'lucide-react';
import { exportData, useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { useToday } from '../lib/hooks';
import { addDaysKey, fmt } from '../lib/dates';
import { demoData } from '../lib/demo';
import { downloadFile, readFileText } from '../lib/io';
import { normalizeData } from '../lib/defaults';
import { useCloud } from '../lib/cloud';
import type { GradeScale, ThemePref } from '../lib/types';
import { Button, Card, CardHeader, ConfirmDialog, Field, IconButton, Input, PageHeader, Segmented } from '../components/ui';

const SCALES: { label: string; scale: GradeScale }[] = [
  { label: '0–10 (España)', scale: { min: 0, max: 10, pass: 5, decimals: 2 } },
  { label: '0–20', scale: { min: 0, max: 20, pass: 10, decimals: 2 } },
  { label: '0–100', scale: { min: 0, max: 100, pass: 50, decimals: 1 } },
  { label: '1–7 (Chile)', scale: { min: 1, max: 7, pass: 4, decimals: 1 } },
  { label: 'GPA 0–4', scale: { min: 0, max: 4, pass: 2, decimals: 2 } },
];

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const semesters = useStore((s) => s.semesters);
  const activities = useStore((s) => s.activities);
  const counts = {
    sessions: useStore((s) => s.sessions.length),
    tasks: useStore((s) => s.tasks.length),
    exams: useStore((s) => s.exams.length),
    notes: useStore((s) => s.notes.length),
  };
  const st = useStore.getState();
  const toast = useUI((s) => s.toast);
  const today = useToday();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<null | 'reset' | 'demo' | { kind: 'import'; data: unknown }>(null);
  const [newActivity, setNewActivity] = useState('');

  const cloud = useCloud((s) => s.status);
  const cloudMsg = useCloud((s) => s.message);
  const inCloud = cloud !== 'off';

  const backup = async () => {
    const data = exportData();
    const ok = await downloadFile(`studium-copia-${today}.json`, JSON.stringify(data, null, 2));
    if (!ok) return;
    st.updateSettings({ lastBackupAt: new Date().toISOString() });
    toast('Copia de seguridad descargada');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const txt = await readFileText(f);
      const raw = JSON.parse(txt);
      const data = raw?.state ?? raw; // admite también el formato guardado en el navegador
      if (!data || typeof data !== 'object' || !Array.isArray(data.sessions)) throw new Error('formato');
      setConfirm({ kind: 'import', data });
    } catch {
      toast('No se ha podido leer el archivo. ¿Es una copia de Studium (.json)?');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const setScale = (patch: Partial<GradeScale>) => st.updateSettings({ gradeScale: { ...settings.gradeScale, ...patch } });

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Personaliza Studium y gestiona tus datos." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="General" />
          <div className="flex flex-col gap-4 px-5 pt-4 pb-5">
            <Field label="Tu nombre">
              {(id) => <Input id={id} value={settings.userName} onChange={(e) => st.updateSettings({ userName: e.target.value })} placeholder="Para saludarte en el panel" />}
            </Field>
            <Field label="Tema">
              {() => (
                <Segmented<ThemePref>
                  value={settings.theme}
                  onChange={(v) => st.updateSettings({ theme: v })}
                  options={[
                    { value: 'system', label: <span className="inline-flex items-center gap-1.5"><Monitor size={14} /> Sistema</span> },
                    { value: 'light', label: <span className="inline-flex items-center gap-1.5"><Sun size={14} /> Claro</span> },
                    { value: 'dark', label: <span className="inline-flex items-center gap-1.5"><Moon size={14} /> Oscuro</span> },
                  ]}
                />
              )}
            </Field>
            <Field label="La semana empieza en">
              {() => (
                <Segmented<'1' | '0'>
                  value={String(settings.weekStartsOn) as '1' | '0'}
                  onChange={(v) => st.updateSettings({ weekStartsOn: Number(v) as 0 | 1 })}
                  options={[
                    { value: '1', label: 'Lunes' },
                    { value: '0', label: 'Domingo' },
                  ]}
                />
              )}
            </Field>
            <p className="text-[12.5px] text-muted">
              Los objetivos diarios y semanales se configuran en{' '}
              <a href="#/objetivos" className="font-medium text-accent-ink hover:underline">
                Objetivos y logros
              </a>
              .
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Tus datos"
            subtitle={inCloud ? 'Guardados en tu cuenta de Claude y en este navegador' : 'Se guardan solo en este navegador'}
            icon={<Database size={16} />}
          />
          <div className="flex flex-col gap-4 px-5 pt-4 pb-5">
            <p className="text-[13px] text-ink-2">
              Tienes {counts.sessions} sesiones, {counts.tasks} tareas, {counts.exams} exámenes y {counts.notes} notas.{' '}
              {inCloud
                ? 'Se sincronizan con tu cuenta, así que los verás en cualquier dispositivo donde abras esta página. Aun así, descarga una copia de vez en cuando.'
                : 'Si borras los datos del navegador o cambias de dispositivo, los perderás: descarga una copia de vez en cuando e impórtala donde quieras.'}
            </p>
            {cloud === 'error' && cloudMsg && <p className="text-[13px] font-medium text-critical-ink">{cloudMsg}</p>}
            <p className="text-[12.5px] text-muted">
              Última copia: {settings.lastBackupAt ? fmt(settings.lastBackupAt, "d 'de' MMMM yyyy, HH:mm") : 'nunca'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={backup}>
                <Download size={16} /> Descargar copia (.json)
              </Button>
              <Button onClick={() => fileRef.current?.click()}>
                <Upload size={16} /> Importar copia
              </Button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button variant="ghost" onClick={() => setConfirm('demo')}>
                <Sparkles size={16} /> Cargar datos de ejemplo
              </Button>
              <Button variant="ghost" className="text-critical-ink" onClick={() => setConfirm('reset')}>
                <Trash size={16} /> Borrar todos los datos
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Semestres / cursos" subtitle="Sirven para agrupar asignaturas y ver estadísticas por semestre" />
          <div className="flex flex-col gap-3 px-5 pt-4 pb-5">
            {semesters.length === 0 && <p className="text-[13px] text-muted">Todavía no hay semestres.</p>}
            {semesters.map((s) => (
              <div key={s.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="current-semester"
                    checked={settings.currentSemesterId === s.id}
                    onChange={() => st.updateSettings({ currentSemesterId: s.id })}
                    className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                    aria-label={`Semestre actual: ${s.name}`}
                    title="Semestre actual"
                  />
                  <Input value={s.name} onChange={(e) => st.updateSemester(s.id, { name: e.target.value })} aria-label="Nombre" />
                  <IconButton label="Eliminar semestre" onClick={() => st.deleteSemester(s.id)} className="shrink-0">
                    <Trash size={16} />
                  </IconButton>
                </div>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-[13px] text-ink-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:pl-6">
                  <span>Del</span>
                  <Input type="date" value={s.start} onChange={(e) => st.updateSemester(s.id, { start: e.target.value })} aria-label="Inicio" className="min-w-0" />
                  <span>al</span>
                  <Input type="date" value={s.end} onChange={(e) => st.updateSemester(s.id, { end: e.target.value })} aria-label="Fin" className="min-w-0" />
                </div>
              </div>
            ))}
            <p className="text-[12px] text-muted">El círculo marca el semestre actual.</p>
            <div>
              <Button
                size="sm"
                onClick={() => {
                  const id = st.addSemester({ name: `Semestre ${semesters.length + 1}`, start: today, end: addDaysKey(today, 120) });
                  if (!settings.currentSemesterId) st.updateSettings({ currentSemesterId: id });
                }}
              >
                <Plus size={14} /> Añadir semestre
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Actividades" subtitle="Tipos de estudio para clasificar tus sesiones" />
          <div className="flex flex-col gap-2 px-5 pt-4 pb-5">
            {activities.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <Input value={a.name} onChange={(e) => st.updateActivity(a.id, { name: e.target.value })} aria-label="Nombre de la actividad" />
                <IconButton label="Eliminar actividad" onClick={() => st.deleteActivity(a.id)}>
                  <Trash size={16} />
                </IconButton>
              </div>
            ))}
            <form
              className="mt-1 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newActivity.trim()) return;
                st.addActivity(newActivity.trim());
                setNewActivity('');
              }}
            >
              <Input value={newActivity} onChange={(e) => setNewActivity(e.target.value)} placeholder="Nueva actividad…" aria-label="Nueva actividad" />
              <Button type="submit" aria-label="Añadir actividad">
                <Plus size={16} />
              </Button>
            </form>
          </div>
        </Card>

        <Card>
          <CardHeader title="Escala de notas" />
          <div className="flex flex-col gap-4 px-5 pt-4 pb-5">
            <div className="flex flex-wrap gap-2">
              {SCALES.map((s) => (
                <Button
                  key={s.label}
                  size="sm"
                  variant={JSON.stringify(s.scale) === JSON.stringify(settings.gradeScale) ? 'primary' : 'secondary'}
                  onClick={() => st.updateSettings({ gradeScale: s.scale })}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Mínima">{(id) => <Input id={id} type="number" value={settings.gradeScale.min} onChange={(e) => setScale({ min: Number(e.target.value) })} />}</Field>
              <Field label="Máxima">{(id) => <Input id={id} type="number" value={settings.gradeScale.max} onChange={(e) => setScale({ max: Number(e.target.value) })} />}</Field>
              <Field label="Aprobado">{(id) => <Input id={id} type="number" step="0.1" value={settings.gradeScale.pass} onChange={(e) => setScale({ pass: Number(e.target.value) })} />}</Field>
              <Field label="Decimales">
                {(id) => <Input id={id} type="number" min={0} max={3} value={settings.gradeScale.decimals} onChange={(e) => setScale({ decimals: Math.max(0, Math.min(3, Number(e.target.value) || 0)) })} />}
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Atajos y consejos" />
          <ul className="flex list-disc flex-col gap-1.5 px-5 pt-4 pb-5 pl-9 text-[13px] text-ink-2">
            <li>El temporizador sigue contando aunque cambies de página o cierres la pestaña.</li>
            <li>En el modo concentración, pulsa Espacio para pausar y Esc para salir.</li>
            <li>Pulsa cualquier barra de los gráficos o día del mapa de actividad para ver sus sesiones.</li>
            <li>Los exámenes cuentan como horas de preparación el tiempo que estudias su asignatura.</li>
            <li>Los días con objetivo 0 h son de descanso: no rompen tu racha.</li>
          </ul>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === 'reset'}
        title="Borrar todos los datos"
        message="Se eliminarán todas tus sesiones, tareas, exámenes, notas y ajustes de este navegador. Descarga antes una copia si quieres conservarlos."
        confirmLabel="Borrar todo"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          st.resetAll();
          toast('Datos borrados');
        }}
      />
      <ConfirmDialog
        open={confirm === 'demo'}
        title="Cargar datos de ejemplo"
        message="Se sustituirán tus datos actuales por datos de ejemplo. Descarga antes una copia si quieres conservarlos."
        confirmLabel="Cargar ejemplo"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          st.replaceData(demoData(settings.userName));
          toast('Datos de ejemplo cargados');
        }}
      />
      <ConfirmDialog
        open={typeof confirm === 'object' && confirm !== null}
        title="Importar copia"
        message="Se sustituirán tus datos actuales por los de la copia. ¿Continuar?"
        confirmLabel="Importar"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm && typeof confirm === 'object') {
            st.replaceData({ ...normalizeData(confirm.data), settings: { ...normalizeData(confirm.data).settings, onboarded: true } });
            toast('Copia importada correctamente');
          }
        }}
      />
    </div>
  );
}
