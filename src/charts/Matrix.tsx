import { fmtDuration } from '../lib/dates';
import { cx } from '../components/ui';

export interface MatrixRow {
  key: string;
  name: string;
  color?: string;
}

/**
 * Tabla-matriz con mapa de calor secuencial (un solo tono). Cada celda muestra su
 * valor, así que el color nunca es la única pista.
 */
export function Matrix({
  rows,
  cols,
  value,
  formatValue = (v: number) => (v > 0 ? fmtDuration(v, { compact: true }) : '·'),
}: {
  rows: MatrixRow[];
  cols: { key: string; name: string }[];
  value: (row: string, col: string) => number;
  formatValue?: (v: number) => string;
}) {
  let max = 0;
  for (const r of rows) for (const c of cols) max = Math.max(max, value(r.key, c.key));
  const level = (v: number) => (v <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  const rowTotal = (r: string) => cols.reduce((a, c) => a + value(r, c.key), 0);
  const colTotal = (c: string) => rows.reduce((a, r) => a + value(r.key, c), 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-[12px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card" />
            {cols.map((c) => (
              <th key={c.key} className="px-1 pb-1 text-center font-medium whitespace-nowrap text-muted">
                {c.name}
              </th>
            ))}
            <th className="px-2 pb-1 text-right font-medium text-muted">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th className="sticky left-0 max-w-40 bg-card pr-2 text-left font-normal">
                <span className="flex items-center gap-1.5">
                  {r.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />}
                  <span className="truncate text-ink">{r.name}</span>
                </span>
              </th>
              {cols.map((c) => {
                const v = value(r.key, c.key);
                const l = level(v);
                return (
                  <td
                    key={c.key}
                    title={`${r.name} · ${c.name}: ${fmtDuration(v)}`}
                    className={cx(
                      'tabular min-w-12 rounded-[4px] px-1.5 py-1.5 text-center whitespace-nowrap',
                      l <= 2 && 'text-ink',
                      l === 0 && 'text-muted',
                      l === 3 && 'font-medium text-white',
                      l === 4 && 'font-medium text-white dark:text-[#0b0b0b]',
                    )}
                    style={{ background: `var(--h${l})` }}
                  >
                    {formatValue(v)}
                  </td>
                );
              })}
              <td className="tabular px-2 text-right font-semibold whitespace-nowrap">{fmtDuration(rowTotal(r.key), { compact: true })}</td>
            </tr>
          ))}
          <tr>
            <th className="sticky left-0 bg-card pt-1 pr-2 text-left font-medium text-muted">Total</th>
            {cols.map((c) => (
              <td key={c.key} className="tabular pt-1 text-center font-medium whitespace-nowrap text-ink-2">
                {fmtDuration(colTotal(c.key), { compact: true })}
              </td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
