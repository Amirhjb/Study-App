import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Search, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { useSubjectMap, useToday } from '../lib/hooks';
import { capitalize, fmt, fmtDuration, relativeDay, timeOf, toKey } from '../lib/dates';
import { SessionRow } from '../components/items';
import { SubjectSelect } from '../components/forms';
import { Button, Card, EmptyState, Input, PageHeader, Select } from '../components/ui';
import { subjectName } from '../lib/hooks';
import { downloadFile } from '../lib/io';

function hashParam(name: string): string | null {
  const q = window.location.hash.split('?')[1];
  if (!q) return null;
  return new URLSearchParams(q).get(name);
}

export default function Sessions() {
  const sessions = useStore((s) => s.sessions);
  const activities = useStore((s) => s.activities);
  const openModal = useUI((s) => s.openModal);
  const map = useSubjectMap();
  const today = useToday();
  const [subject, setSubject] = useState<string | null>(null);
  const [activity, setActivity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(30);

  useEffect(() => {
    const d = hashParam('dia');
    if (d) {
      setFrom(d);
      setTo(d);
    }
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return sessions
      .filter((s) => {
        const day = toKey(new Date(s.start));
        if (subject && s.subjectId !== subject) return false;
        if (activity && s.activityId !== activity) return false;
        if (from && day < from) return false;
        if (to && day > to) return false;
        if (qq && !`${s.note} ${subjectName(s.subjectId, map)}`.toLowerCase().includes(qq)) return false;
        return true;
      })
      .sort((a, b) => b.start.localeCompare(a.start));
  }, [sessions, subject, activity, from, to, q, map]);

  const groups = useMemo(() => {
    const out: { day: string; items: typeof filtered; total: number }[] = [];
    for (const s of filtered) {
      const day = toKey(new Date(s.start));
      let g = out[out.length - 1];
      if (!g || g.day !== day) {
        g = { day, items: [], total: 0 };
        out.push(g);
      }
      g.items.push(s);
      g.total += s.durationSec;
    }
    return out;
  }, [filtered]);

  const total = filtered.reduce((a, s) => a + s.durationSec, 0);
  const visibleGroups: typeof groups = [];
  let count = 0;
  for (const g of groups) {
    if (count >= limit) break;
    visibleGroups.push(g);
    count += g.items.length;
  }
  const hasFilters = !!(subject || activity || from || to || q);

  const exportCsv = () => {
    const rows = [
      ['fecha', 'inicio', 'fin', 'minutos', 'asignatura', 'actividad', 'pomodoros', 'concentracion', 'notas'],
      ...filtered
        .slice()
        .reverse()
        .map((s) => {
          const end = new Date(new Date(s.start).getTime() + s.durationSec * 1000).toISOString();
          return [
            toKey(new Date(s.start)),
            timeOf(s.start),
            timeOf(end),
            String(Math.round(s.durationSec / 60)),
            subjectName(s.subjectId, map),
            activities.find((a) => a.id === s.activityId)?.name ?? '',
            String(s.pomodoros),
            s.rating ? String(s.rating) : '',
            s.note,
          ];
        }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n');
    void downloadFile(`sesiones-${today}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
  };

  return (
    <div>
      <PageHeader
        title="Sesiones"
        subtitle="Historial de todo lo que has estudiado. Pulsa una sesión para editarla."
        actions={
          <>
            <Button onClick={exportCsv} disabled={filtered.length === 0}>
              <Download size={16} /> Exportar CSV
            </Button>
            <Button variant="primary" onClick={() => openModal({ kind: 'session' })}>
              <Plus size={16} /> Añadir sesión
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="relative col-span-2 md:col-span-1">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en notas…" className="pl-9" aria-label="Buscar" />
          </div>
          <SubjectSelect value={subject} onChange={setSubject} includeArchived noneLabel="Todas las asignaturas" />
          <Select value={activity} onChange={(e) => setActivity(e.target.value)} aria-label="Actividad">
            <option value="">Todas las actividades</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" title="Desde" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" title="Hasta" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-2">
          <span>
            <strong className="text-ink">{filtered.length}</strong> sesiones · <strong className="text-ink">{fmtDuration(total)}</strong>
          </span>
          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSubject(null);
                setActivity('');
                setFrom('');
                setTo('');
                setQ('');
                if (window.location.hash.includes('?')) window.history.replaceState(null, '', '#/sesiones');
              }}
            >
              <X size={14} /> Quitar filtros
            </Button>
          )}
        </div>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title={hasFilters ? 'No hay sesiones con estos filtros' : 'Aún no hay sesiones'}
            description={hasFilters ? undefined : 'Usa el temporizador o añade tus horas de estudio a mano.'}
            action={!hasFilters && <Button variant="primary" onClick={() => openModal({ kind: 'session' })}>Añadir sesión</Button>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleGroups.map((g) => (
            <Card key={g.day}>
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <div className="text-sm font-semibold">
                  {capitalize(fmt(g.day, "EEEE, d 'de' MMMM"))}
                  {(g.day === today || relativeDay(g.day, today) === 'ayer') && (
                    <span className="ml-2 font-normal text-muted">{relativeDay(g.day, today)}</span>
                  )}
                </div>
                <div className="tabular text-sm font-semibold text-ink-2">{fmtDuration(g.total)}</div>
              </div>
              <div className="px-3 py-2">
                {g.items.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </div>
            </Card>
          ))}
          {count < filtered.length && (
            <Button className="self-center" onClick={() => setLimit(limit + 50)}>
              Cargar más
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
