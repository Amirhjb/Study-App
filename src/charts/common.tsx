import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Mide el ancho de un contenedor (responsive). */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

/**
 * Tooltip flotante dentro de un contenedor `relative`. Las coordenadas son relativas
 * al contenedor; el tooltip se recoloca para no salirse por los bordes.
 */
export function useTooltip() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const showAt = useCallback((clientX: number, clientY: number, content: ReactNode) => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTip({ x: clientX - r.left, y: clientY - r.top, content });
  }, []);

  const showForElement = useCallback((target: Element, content: ReactNode) => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    setTip({ x: t.left + t.width / 2 - r.left, y: t.top - r.top, content });
  }, []);

  const hide = useCallback(() => setTip(null), []);

  const node = tip ? <TooltipBox tip={tip} containerRef={containerRef} /> : null;
  return { containerRef, showAt, showForElement, hide, node, tip };
}

function TooltipBox({
  tip,
  containerRef,
}: {
  tip: TipState;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    const cont = containerRef.current;
    if (!box || !cont) return;
    const bw = box.offsetWidth;
    const bh = box.offsetHeight;
    const cw = cont.clientWidth;
    let left = tip.x - bw / 2;
    left = Math.max(-8, Math.min(cw - bw + 8, left));
    let top = tip.y - bh - 10;
    if (top < -40) top = tip.y + 16;
    setPos({ left, top });
  }, [tip, containerRef]);
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none absolute z-20 min-w-32 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg"
      style={{ left: pos?.left ?? tip.x, top: pos?.top ?? tip.y, visibility: pos ? 'visible' : 'hidden' }}
    >
      {tip.content}
    </div>
  );
}

/** Fila de tooltip: el valor manda, la etiqueta acompaña; clave de línea de color. */
export function TipRow({ color, label, value }: { color?: string; label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {color && <span className="h-[3px] w-3 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="tabular font-semibold text-ink">{value}</span>
      <span className="truncate text-ink-2">{label}</span>
    </div>
  );
}

export function TipTitle({ children }: { children: ReactNode }) {
  return <div className="mb-1 font-medium text-muted">{children}</div>;
}

/** Ticks "bonitos" para un eje de 0 a max. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/** Ticks en horas para valores en segundos. Devuelve valores en segundos. */
export function hourTicks(maxSec: number, count = 4): number[] {
  const maxH = maxSec / 3600;
  if (maxH <= 0) return [0, 3600];
  if (maxH < 1) {
    // minutos: 15, 30, 45, 60
    const stepMin = maxH * 60 <= 30 ? 10 : 15;
    const top = Math.ceil((maxH * 60) / stepMin) * stepMin;
    const out: number[] = [];
    for (let m = 0; m <= top; m += stepMin) out.push(m * 60);
    return out;
  }
  return niceTicks(maxH, count).map((h) => h * 3600);
}

export function fmtAxisHours(sec: number): string {
  if (sec === 0) return '0';
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  const h = sec / 3600;
  return `${h.toLocaleString('es-ES', { maximumFractionDigits: 1 })}h`;
}

/** Leyenda: muestra rectángulo (barras) o línea (líneas) + nombre. */
export function Legend({
  items,
  shape = 'rect',
}: {
  items: { key: string; name: string; color: string; dashed?: boolean }[];
  shape?: 'rect' | 'line';
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
      {items.map((it) => (
        <span key={it.key} className="inline-flex items-center gap-1.5">
          {shape === 'rect' ? (
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} />
          ) : (
            <svg width="14" height="6" aria-hidden>
              <line
                x1="1"
                y1="3"
                x2="13"
                y2="3"
                stroke={it.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={it.dashed ? '3 3' : undefined}
              />
            </svg>
          )}
          {it.name}
        </span>
      ))}
    </div>
  );
}
