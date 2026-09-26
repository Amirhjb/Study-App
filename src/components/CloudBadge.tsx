import { useCloud } from '../lib/cloud';
import { cx } from './ui';

/** Estado de la sincronización (solo cuando la app corre dentro de claude.ai). */
export function CloudBadge() {
  const status = useCloud((s) => s.status);
  if (status === 'off') return null;
  const label =
    status === 'loading'
      ? 'Cargando de la nube…'
      : status === 'saving'
        ? 'Guardando…'
        : status === 'synced'
          ? 'Guardado en la nube'
          : 'Sin sincronizar';
  return (
    <div className="mt-3 flex items-center gap-2 px-3 text-[12px] text-muted" role="status">
      <span
        className={cx('h-2 w-2 rounded-full', status === 'saving' || status === 'loading' ? 'animate-pulse' : '')}
        style={{ background: status === 'error' ? 'var(--critical)' : status === 'synced' ? 'var(--good)' : 'var(--muted)' }}
      />
      {label}
      {status === 'error' && <a href="#/ajustes" className="ml-auto text-accent-ink hover:underline">Ver</a>}
    </div>
  );
}
