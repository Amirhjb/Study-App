import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, NotebookPen, Pencil, Pin, PinOff, Plus, Search, Trash } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { subjectColor, useSubjectMap } from '../lib/hooks';
import { fmt } from '../lib/dates';
import { renderMarkdown } from '../lib/markdown';
import { SubjectSelect } from '../components/forms';
import { SubjectTag } from '../components/items';
import { Button, Card, ConfirmDialog, cx, EmptyState, IconButton, Input, PageHeader } from '../components/ui';

export default function Notes() {
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const map = useSubjectMap();
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const allTags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes]);
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return notes
      .filter((n) => (!subject || n.subjectId === subject) && (!tag || n.tags.includes(tag)))
      .filter((n) => !qq || `${n.title} ${n.content} ${n.tags.join(' ')}`.toLowerCase().includes(qq))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, q, subject, tag]);

  const current = notes.find((n) => n.id === selected) ?? null;

  const create = () => {
    const now = new Date().toISOString();
    const id = addNote({ title: '', content: '', subjectId: subject, tags: tag ? [tag] : [], pinned: false, createdAt: now, updatedAt: now });
    setSelected(id);
  };

  return (
    <div>
      <PageHeader
        title="Notas"
        subtitle="Apuntes rápidos, fórmulas, planes de estudio y dudas. Admite formato Markdown sencillo."
        actions={
          <Button variant="primary" onClick={create}>
            <Plus size={16} /> Nueva nota
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <div className={cx('flex flex-col gap-3', current && 'hidden lg:flex')}>
          <Card className="p-3">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar notas…" className="pl-9" aria-label="Buscar notas" />
            </div>
            <div className="mt-2">
              <SubjectSelect value={subject} onChange={setSubject} includeArchived noneLabel="Todas las asignaturas" />
            </div>
            {allTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {allTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTag(tag === t ? null : t)}
                    className={cx(
                      'rounded-full px-2.5 py-0.5 text-[12px] ring-1 transition-colors',
                      tag === t ? 'bg-accent-soft text-accent-ink ring-accent/40' : 'text-ink-2 ring-line hover:bg-hover',
                    )}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </Card>
          <div className="flex flex-col gap-2">
            {filtered.length === 0 && (
              <Card>
                <EmptyState icon={<NotebookPen size={26} />} title={notes.length ? 'Ninguna nota coincide' : 'Aún no tienes notas'} className="py-8" />
              </Card>
            )}
            {filtered.map((n) => {
              const s = n.subjectId ? map.get(n.subjectId) : null;
              return (
                <button
                  key={n.id}
                  onClick={() => setSelected(n.id)}
                  className={cx(
                    'rounded-xl border bg-card p-3 text-left transition-colors',
                    selected === n.id ? 'border-accent ring-1 ring-accent' : 'border-line hover:bg-hover',
                  )}
                  style={{ borderLeft: `3px solid ${subjectColor(s)}` }}
                >
                  <div className="flex items-center gap-2">
                    {n.pinned && <Pin size={13} className="shrink-0 text-accent-ink" />}
                    <span className="truncate text-sm font-semibold">{n.title || 'Sin título'}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-2">{plainPreview(n.content) || 'Nota vacía'}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <SubjectTag id={n.subjectId} />
                    <span className="shrink-0 text-[11.5px] text-muted">{fmt(n.updatedAt, 'd MMM')}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className={cx(!current && 'hidden lg:block')}>
          {current ? (
            <NoteEditor key={current.id} id={current.id} onBack={() => setSelected(null)} />
          ) : (
            <Card className="h-full">
              <EmptyState
                icon={<NotebookPen size={28} />}
                title="Elige una nota o crea una nueva"
                description="Consejo: usa # para títulos, - para listas, - [ ] para tareas y **negrita**."
                action={<Button onClick={create}>Nueva nota</Button>}
                className="py-24"
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const note = useStore((s) => s.notes.find((n) => n.id === id));
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const addNote = useStore((s) => s.addNote);
  const toast = useUI((s) => s.toast);
  const [preview, setPreview] = useState(() => !!note?.content);
  const [tagDraft, setTagDraft] = useState('');
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    // Borra notas vacías al salir.
    return () => {
      const n = useStore.getState().notes.find((x) => x.id === id);
      if (n && !n.title.trim() && !n.content.trim()) useStore.getState().deleteNote(id);
    };
  }, [id]);

  if (!note) return null;
  const html = renderMarkdown(note.content);

  const addTag = () => {
    const t = tagDraft.trim().replace(/^#/, '').toLowerCase();
    if (t && !note.tags.includes(t)) updateNote(id, { tags: [...note.tags, t] });
    setTagDraft('');
  };

  return (
    <Card className="flex min-h-[70vh] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <IconButton label="Volver" onClick={onBack} className="lg:hidden">
          <ArrowLeft size={18} />
        </IconButton>
        <div className="w-44">
          <SubjectSelect value={note.subjectId} onChange={(v) => updateNote(id, { subjectId: v })} />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <IconButton label={preview ? 'Editar' : 'Vista previa'} onClick={() => setPreview(!preview)} className={cx(preview && 'bg-accent-soft text-accent-ink')}>
            {preview ? <Pencil size={16} /> : <Eye size={16} />}
          </IconButton>
          <IconButton label={note.pinned ? 'Desfijar' : 'Fijar arriba'} onClick={() => updateNote(id, { pinned: !note.pinned })}>
            {note.pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </IconButton>
          <IconButton label="Eliminar nota" onClick={() => setConfirm(true)}>
            <Trash size={16} />
          </IconButton>
        </div>
      </div>
      <div className="flex flex-1 flex-col px-5 py-4">
        <input
          value={note.title}
          onChange={(e) => updateNote(id, { title: e.target.value })}
          placeholder="Título"
          className="w-full bg-transparent text-xl font-semibold outline-none placeholder:text-muted"
          autoFocus={!note.title}
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {note.tags.map((t) => (
            <button
              key={t}
              className="rounded-full bg-card-2 px-2 py-0.5 text-[12px] text-ink-2 ring-1 ring-line hover:line-through"
              title="Quitar etiqueta"
              onClick={() => updateNote(id, { tags: note.tags.filter((x) => x !== t) })}
            >
              #{t}
            </button>
          ))}
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder="+ etiqueta"
            className="w-24 bg-transparent text-[12px] outline-none placeholder:text-muted"
            aria-label="Añadir etiqueta"
          />
        </div>
        {preview ? (
          <div
            className="prose-note mt-4 flex-1 cursor-text text-[14.5px] leading-relaxed"
            onDoubleClick={() => setPreview(false)}
            dangerouslySetInnerHTML={{ __html: html || '<p style="color:var(--muted)">Nota vacía. Pulsa el lápiz para escribir.</p>' }}
          />
        ) : (
          <textarea
            value={note.content}
            onChange={(e) => updateNote(id, { content: e.target.value })}
            maxLength={60000}
            placeholder={'Escribe aquí…\n\n# Título\n- punto de lista\n- [ ] tarea\n**negrita** *cursiva* `código`'}
            className="mt-4 min-h-[50vh] w-full flex-1 resize-none bg-transparent font-mono text-[14px] leading-relaxed outline-none placeholder:text-muted"
            autoFocus={!!note.title}
          />
        )}
        <div className="mt-3 text-[11.5px] text-muted">Guardado automáticamente · editado {fmt(note.updatedAt, "d MMM, HH:mm")}</div>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Eliminar nota"
        message={`¿Eliminar "${note.title || 'Sin título'}"?`}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          const copy = note;
          deleteNote(id);
          onBack();
          toast('Nota eliminada', { label: 'Deshacer', onAction: () => addNote(copy) });
        }}
      />
    </Card>
  );
}

/** Texto plano para la vista previa: quita las marcas de Markdown al inicio de línea. */
function plainPreview(md: string): string {
  return md
    .replace(/^\s*#{1,3}\s+/gm, '')
    .replace(/^\s*[-*]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\*\*|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}
