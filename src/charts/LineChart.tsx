import { useState } from 'react';
import { fmtAxisHours, hourTicks, TipRow, TipTitle, useTooltip, useWidth } from './common';
import { fmtDuration } from '../lib/dates';

export interface LineSeries {
  key: string;
  name: string;
  color: string;
  values: number[];
  dashed?: boolean;
  area?: boolean;
}

/** Gráfico de líneas con cruz de guía y tooltip con todas las series. */
export function LineChart({
  labels,
  titles,
  series,
  height = 220,
  formatValue = (v: number) => fmtDuration(v),
  formatAxis = fmtAxisHours,
  ariaLabel,
}: {
  labels: string[];
  titles: string[];
  series: LineSeries[];
  height?: number;
  formatValue?: (v: number) => string;
  formatAxis?: (v: number) => string;
  ariaLabel?: string;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const { containerRef, showAt, hide, node } = useTooltip();
  const [hi, setHi] = useState<number | null>(null);

  const n = labels.length;
  const maxVal = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = hourTicks(maxVal);
  const top = ticks[ticks.length - 1] || 1;
  const padL = 40;
  const padR = 12;
  const padT = 10;
  const axisH = 22;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - axisH;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 56))));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg || n === 0) return;
    const r = svg.getBoundingClientRect();
    const px = e.clientX - r.left - padL;
    const i = Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (px / plotW) * (n - 1))));
    setHi(i);
    showAt(
      r.left + x(i),
      r.top + padT + 4,
      <div>
        <TipTitle>{titles[i]}</TipTitle>
        {series.map((s) => (
          <TipRow key={s.key} color={s.color} label={s.name} value={i < s.values.length ? formatValue(s.values[i]) : '—'} />
        ))}
      </div>,
    );
  };

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
                  shapeRendering="crispEdges"
                />
                <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-[var(--muted)] text-[11px]">
                  {formatAxis(t)}
                </text>
              </g>
            ))}
            {labels.map((l, i) =>
              i % every === 0 || i === n - 1 ? (
                <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">
                  {i === n - 1 || n - 1 - i >= every * 0.6 ? l : ''}
                </text>
              ) : null,
            )}
            {series.map((s) => {
              const m = s.values.length;
              if (m === 0) return null;
              const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
              return (
                <g key={s.key}>
                  {s.area && m > 1 && (
                    <path d={`${d} L${x(m - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={s.color} opacity={0.1} />
                  )}
                  <path
                    d={d}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={s.dashed ? '5 4' : undefined}
                  />
                  {!s.dashed && (
                    <circle cx={x(m - 1)} cy={y(s.values[m - 1])} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} />
                  )}
                </g>
              );
            })}
            {hi !== null && (
              <g>
                <line x1={x(hi)} x2={x(hi)} y1={padT} y2={padT + plotH} stroke="var(--ink-2)" strokeWidth={1} opacity={0.5} />
                {series
                  .filter((s) => hi < s.values.length)
                  .map((s) => (
                    <circle key={s.key} cx={x(hi)} cy={y(s.values[hi])} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} />
                  ))}
              </g>
            )}
            <rect
              x={padL}
              y={padT}
              width={plotW}
              height={plotH}
              fill="transparent"
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => {
                setHi(null);
                hide();
              }}
            />
          </svg>
        )}
      </div>
      {node}
    </div>
  );
}
