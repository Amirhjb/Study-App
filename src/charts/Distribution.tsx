import { useState } from 'react';
import { fmtDuration, fmtNumber } from '../lib/dates';
import { cx } from '../components/ui';

export interface DistItem {
  key: string;
  name: string;
  color: string;
  value: number;
  /** Texto extra a la derecha (p. ej. objetivo). */
  extra?: string;
}

/**
 * Reparto en barras horizontales con nombre, tiempo y porcentaje visibles
 * (las etiquetas visibles hacen que el color nunca sea la única pista).
 */
export function DistributionBars({
  items,
  formatValue = (v: number) => fmtDuration(v, { compact: true }),
  maxItems = 8,
}: {
  items: DistItem[];
  formatValue?: (v: number) => string;
  maxItems?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  // Más de 8 categorías: el resto se agrupa en "Otras".
  let list = sorted;
  if (sorted.length > maxItems) {
    const head = sorted.slice(0, maxItems - 1);
    const rest = sorted.slice(maxItems - 1).reduce((a, b) => a + b.value, 0);
    list = [...head, { key: '__other__', name: 'Otras', color: 'var(--s-none)', value: rest }];
  }
  const total = list.reduce((a, b) => a + b.value, 0);
  const max = list[0]?.value ?? 1;
  if (total === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {/* barra 100% apilada para ver el conjunto */}
      <div className="mb-2 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
        {list.map((it) => (
          <div
            key={it.key}
            className="h-full transition-opacity first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(it.value / total) * 100}%`,
              background: it.color,
              opacity: hover && hover !== it.key ? 0.4 : 1,
            }}
          />
        ))}
      </div>
      {list.map((it) => (
        <div
          key={it.key}
          className={cx('grid grid-cols-[minmax(0,8rem)_minmax(3rem,1fr)_auto] items-center gap-3 rounded-lg px-1.5 py-1', hover === it.key && 'bg-hover')}
          onPointerEnter={() => setHover(it.key)}
          onPointerLeave={() => setHover(null)}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} />
            <span className="truncate text-[13px] text-ink">{it.name}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--grid)]">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: it.color }} />
          </div>
          <div className="tabular flex items-baseline gap-2 text-right text-[13px]">
            <span className="font-medium text-ink">{formatValue(it.value)}</span>
            <span className="w-10 text-xs text-muted">{fmtNumber((it.value / total) * 100, 0)}%</span>
            {it.extra && <span className="text-xs text-muted">{it.extra}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
