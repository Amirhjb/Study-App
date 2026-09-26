import { useEffect, useMemo, useRef } from 'react';
import { addDaysKey, capitalize, daysBetween, fmt, fromKey, weekStartKey } from '../lib/dates';
import { TipRow, TipTitle, useTooltip, useWidth } from './common';
import { fmtDuration } from '../lib/dates';
import type { DateKey } from '../lib/types';

/** Umbrales en horas de cada nivel de color. */
const LEVELS = [0, 1, 2, 4];
const LEVEL_LABELS = ['0', '< 1 h', '1–2 h', '2–4 h', '4 h +'];

export function levelFor(sec: number): number {
  if (sec <= 0) return 0;
  const h = sec / 3600;
  if (h < LEVELS[1]) return 1;
  if (h < LEVELS[2]) return 2;
  if (h < LEVELS[3]) return 3;
  return 4;
}

/**
 * Calendario tipo "contribuciones": columnas = semanas, filas = días.
 * Escala secuencial de un solo tono (más oscuro = más tiempo).
 */
export function Heatmap({
  start,
  end,
  valueOf,
  goalOf,
  weekStartsOn,
  today,
  cell: cellMax = 16,
  onDayClick,
}: {
  start: DateKey;
  end: DateKey;
  valueOf: (k: DateKey) => number;
  goalOf?: (k: DateKey) => number;
  weekStartsOn: 0 | 1;
  today: DateKey;
  cell?: number;
  onDayClick?: (k: DateKey) => void;
}) {
  const { containerRef, showForElement, hide, node } = useTooltip();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [widthRef, width] = useWidth<HTMLDivElement>();
  const gap = 3;

  const weeks = useMemo(() => {
    const first = weekStartKey(start, weekStartsOn);
    const out: DateKey[][] = [];
    let cur = first;
    while (cur <= end) {
      out.push(daysBetween(cur, addDaysKey(cur, 6)));
      cur = addDaysKey(cur, 7);
    }
    return out;
  }, [start, end, weekStartsOn]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length]);

  const rowLabels = weekStartsOn === 1 ? ['Lun', '', 'Mié', '', 'Vie', '', 'Dom'] : ['Dom', '', 'Mar', '', 'Jue', '', 'Sáb'];
  const labelW = 30;
  // Celdas que llenan el ancho disponible (entre 10 y cellMax px); si no caben, scroll.
  const cell = width > 0 ? Math.max(10, Math.min(cellMax, Math.floor((width - labelW) / weeks.length) - gap)) : 12;
  // Semanas que empiezan mes (para las etiquetas de arriba).
  const monthStarts = weeks.map((w) => w.find((k) => k.endsWith('-01') && k >= start && k <= end) ?? null);
  const firstLabelWeek = monthStarts.findIndex((m) => m !== null);

  return (
    <div ref={containerRef} className="relative">
      <div ref={widthRef} />
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col" style={{ minWidth: 'max-content' }}>
          {/* meses */}
          <div className="flex" style={{ paddingLeft: labelW, height: 16 }}>
            {weeks.map((w, i) => {
              const firstOfMonth = monthStarts[i];
              // La primera columna solo lleva etiqueta si el siguiente mes queda lejos (evita solapes).
              const show = firstOfMonth !== null || (i === 0 && (firstLabelWeek === -1 || firstLabelWeek >= 3));
              const k = firstOfMonth ?? (w[0] < start ? start : w[0]);
              return (
                <div key={w[0]} className="relative text-[11px] text-muted" style={{ width: cell + gap }}>
                  {show && <span className="absolute left-0 whitespace-nowrap">{capitalize(fmt(k, 'MMM'))}</span>}
                </div>
              );
            })}
          </div>
          <div className="flex">
            <div className="flex flex-col" style={{ width: labelW, gap }}>
              {rowLabels.map((l, i) => (
                <div key={i} className="text-[10.5px] leading-none text-muted" style={{ height: cell, lineHeight: `${cell}px` }}>
                  {l}
                </div>
              ))}
            </div>
            <div className="flex" style={{ gap }}>
              {weeks.map((w) => (
                <div key={w[0]} className="flex flex-col" style={{ gap }}>
                  {w.map((k) => {
                    const out = k < start || k > end;
                    const future = k > today;
                    const v = out || future ? 0 : valueOf(k);
                    const lvl = levelFor(v);
                    const goal = goalOf?.(k) ?? 0;
                    const met = goal > 0 && v >= goal;
                    if (out) return <div key={k} style={{ width: cell, height: cell }} />;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-label={`${fmt(k, "EEEE d 'de' MMMM")}: ${fmtDuration(v)}`}
                        className="rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        style={{
                          width: cell,
                          height: cell,
                          background: `var(--h${lvl})`,
                          opacity: future ? 0.45 : 1,
                          boxShadow: k === today ? 'inset 0 0 0 1.5px var(--ink)' : undefined,
                        }}
                        onPointerEnter={(e) =>
                          showForElement(
                            e.currentTarget,
                            <div>
                              <TipTitle>{capitalize(fmt(k, "EEEE, d 'de' MMMM yyyy"))}</TipTitle>
                              <TipRow label="estudiado" value={fmtDuration(v)} />
                              {goal > 0 && <TipRow label={met ? 'objetivo cumplido ✓' : 'objetivo'} value={fmtDuration(goal)} />}
                            </div>,
                          )
                        }
                        onFocus={(e) =>
                          showForElement(
                            e.currentTarget,
                            <div>
                              <TipTitle>{capitalize(fmt(k, "EEEE, d 'de' MMMM yyyy"))}</TipTitle>
                              <TipRow label="estudiado" value={fmtDuration(v)} />
                            </div>,
                          )
                        }
                        onPointerLeave={hide}
                        onBlur={hide}
                        onClick={() => onDayClick?.(k)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <HeatLegend />
      {node}
    </div>
  );
}

export function HeatLegend() {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] text-muted">
      {LEVEL_LABELS.map((l, i) => (
        <span key={l} className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `var(--h${i})` }} />
          {l}
        </span>
      ))}
    </div>
  );
}

/** Día de la semana (0 = domingo) de una clave. */
export function weekdayOf(k: DateKey) {
  return fromKey(k).getDay();
}
