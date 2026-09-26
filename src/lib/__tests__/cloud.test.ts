import { describe, expect, it } from 'vitest';
import { fromDocs, toDocs } from '../cloud';
import { demoData } from '../demo';

describe('documentos de la nube', () => {
  it('ida y vuelta sin perder datos', () => {
    const data = demoData('Ana');
    const docs = toDocs(data);
    const back = fromDocs(docs);
    const sortById = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
    expect(sortById(back.sessions)).toEqual(sortById(data.sessions));
    expect(sortById(back.tasks)).toEqual(sortById(data.tasks));
    expect(sortById(back.exams)).toEqual(sortById(data.exams));
    expect(sortById(back.notes)).toEqual(sortById(data.notes));
    expect(back.subjects).toEqual(data.subjects);
    expect(back.settings).toEqual(data.settings);
  });

  it('cada documento cabe en el límite y las rutas son válidas', () => {
    const data = demoData();
    // Sesiones con notas largas para forzar la partición de una semana.
    data.sessions = Array.from({ length: 300 }, (_, i) => ({
      ...data.sessions[0],
      id: `s${i}`,
      note: 'x'.repeat(2000),
    }));
    const docs = toDocs(data);
    for (const [path, doc] of docs) {
      expect(JSON.stringify(doc).length).toBeLessThan(256 * 1024);
      const segs = path.split('/');
      expect(segs.length).toBe(2);
      for (const s of segs) expect(s).toMatch(/^[A-Za-z0-9_\-.~:@+]+$/);
    }
    const parts = [...docs.keys()].filter((p) => p.startsWith('sessions/'));
    expect(parts.length).toBeGreaterThan(1);
    expect(fromDocs(docs).sessions).toHaveLength(300);
  });
});
