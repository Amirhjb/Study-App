import { useState, type ReactNode } from 'react';
import { fmtAxisHours, hourTicks, TipRow, TipTitle, useTooltip, useWidth } from './common';
import { fmtDuration } from '../lib/dates';

export interface BarSegment {
  key: string;
  name: string;
  color: string;
  value: number;
}

export interface BarDatum {
  key: string;
  /** Etiqueta corta del eje X. */
  label: string;
  /** Título del tooltip. */
  title: string;
  segments: BarSegment[];
  /** Objetivo para esta barra (se dibuja como marca horizontal). */
  goal?: number;
  highlight?: boolean;
}

/**
 * Columnas apiladas (valores en segundos). Barras finas (≤ 24px), extremo redondeado
 * de 4px, base recta y separación de 2px entre segmentos.
 */
export function BarChart({
  data,
  height = 220,
  formatValue = (v: number) => fmtDuration(v),
  formatAxis = fmtAxisHours,
  ticks: ticksFn = hourTicks,
  maxBar = 24,
  labelEvery,
  showTotalOnTop = false,
  onBarClick,
  footer,
  ariaLabel,
}: {
  data: BarDatum[];
  height?: number;
  formatValue?: (v: number) => string;
  formatAxis?: (v: number) => string;
  ticks?: (max: number) => number[];
  maxBar?: number;
  labelEvery?: number;
  showTotalOnTop?: boolean;
  onBarClick?: (d: BarDatum) => void;
  footer?: (d: BarDatum) => ReactNode;
  ariaLabel?: string;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const { containerRef, showForElement, hide, node } = useTooltip();
  const [hover, setHover] = useState<string | null>(null);

  const totals = data.map((d) => d.segments.reduce((a, s) => a + s.value, 0));
  const maxVal = Math.max(0, ...totals, ...data.map((d) => d.goal ?? 0));
  const ticks = ticksFn(maxVal);
  const top = ticks[ticks.length - 1] || 1;

  const padL = 38;
  const padR = 6;
  const padT = showTotalOnTop ? 18 : 8;
  const axisH = 22;
  const plotH = height - padT - axisH;
  const plotW = Math.max(0, width - padL - padR);
  const n = data.length || 1;
  const slot = plotW / n;
  const barW = Math.max(3, Math.min(maxBar, slot * 0.62));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const every = labelEvery ?? Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 44))));
  const GAP = 2;
  const R = Math.min(4, barW / 2);

  return (
    <div ref={containerRef} className="relative">
      <div ref={wrapRef} className="w-full">
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-[var(--muted)] text-[11px]">
                  {formatAxis(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = padL + slot * i + slot / 2;
              const x = cx - barW / 2;
              const total = totals[i];
              const segs = d.segments.filter((s) => s.value > 0);
              let acc = 0;
              const dim = hover !== null && hover !== d.key;
              return (
                <g key={d.key} opacity={dim ? 0.55 : 1} style={{ transition: 'opacity .15s' }}>
                  {segs.map((s, si) => {
                    const y0 = y(acc);
                    acc += s.value;
                    const y1 = y(acc);
                    const isTop = si === segs.length - 1;
                    // separación de 2px entre segmentos (restada al segmento inferior)
                    const h = Math.max(0, y0 - y1 - (isTop ? 0 : GAP));
                    if (h <= 0) return null;
                    const top = isTop ? y1 : y1 + GAP;
                    return (
                      <path key={s.key} d={roundedTopRect(x, top, barW, h, isTop ? Math.min(R, h) : 0)} fill={s.color} />
                    );
                  })}
                  {d.goal !== undefined && d.goal > 0 && (
                    <line
                      x1={cx - Math.min(slot * 0.45, barW / 2 + 5)}
                      x2={cx + Math.min(slot * 0.45, barW / 2 + 5)}
                      y1={y(d.goal)}
                      y2={y(d.goal)}
                      stroke="var(--ink-2)"
                      strokeWidth={2}
                      strokeLinecap="round"
                      opacity={0.75}
                    />
                  )}
                  {showTotalOnTop && total > 0 && (
                    <text x={cx} y={y(total) - 5} textAnchor="middle" className="tabular fill-[var(--ink-2)] text-[10.5px]">
                      {formatAxis(total)}
                    </text>
                  )}
                  {(i % every === 0 || d.highlight) && (
                    <text
                      x={cx}
                      y={height - 6}
                      textAnchor="middle"
                      className={d.highlight ? 'fill-[var(--ink)] text-[11px] font-semibold' : 'fill-[var(--muted)] text-[11px]'}
                    >
                      {d.label}
                    </text>
                  )}
                  {/* zona de interacción: toda la columna */}
                  <rect
                    x={padL + slot * i}
                    y={padT}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${d.title}: ${formatValue(total)}`}
                    className="cursor-pointer outline-none"
                    onPointerEnter={(e) => {
                      setHover(d.key);
                      showForElement(e.currentTarget, tipFor(d, total, formatValue, footer));
                    }}
                    onFocus={(e) => {
                      setHover(d.key);
                      showForElement(e.currentTarget, tipFor(d, total, formatValue, footer));
                    }}
                    onPointerLeave={() => {
                      setHover(null);
                      hide();
                    }}
                    onBlur={() => {
                      setHover(null);
                      hide();
                    }}
                    onClick={() => onBarClick?.(d)}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {node}
    </div>
  );
}

function tipFor(
  d: BarDatum,
  total: number,
  formatValue: (v: number) => string,
  footer?: (d: BarDatum) => ReactNode,
) {
  const segs = d.segments.filter((s) => s.value > 0).slice().reverse();
  return (
    <div>
      <TipTitle>{d.title}</TipTitle>
      {segs.length > 1 && segs.map((s) => <TipRow key={s.key} color={s.color} label={s.name} value={formatValue(s.value)} />)}
      <div className={segs.length > 1 ? 'mt-1 border-t border-line pt-1' : ''}>
        <TipRow label="total" value={formatValue(total)} />
        {d.goal !== undefined && d.goal > 0 && <TipRow label="objetivo" value={formatValue(d.goal)} />}
      </div>
      {footer?.(d)}
    </div>
  );
}

/** Rectángulo con esquinas superiores redondeadas y base recta. */
function roundedTopRect(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `M${x},${y}h${w}v${h}h${-w}Z`;
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + w - r}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `V${y + h}`,
    'Z',
  ].join(' ');
}
