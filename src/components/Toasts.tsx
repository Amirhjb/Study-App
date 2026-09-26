import { X } from 'lucide-react';
import { useUI } from '../store/ui';

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-pop pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-[#1d1d1b] px-4 py-2.5 text-sm text-white shadow-xl dark:bg-[#f2f2ef] dark:text-[#111]"
        >
          <span>{t.text}</span>
          {t.actionLabel && (
            <button
              className="font-semibold text-[#b3aefa] hover:underline dark:text-[#3f36c9]"
              onClick={() => {
                t.onAction?.();
                dismiss(t.id);
              }}
            >
              {t.actionLabel}
            </button>
          )}
          <button className="opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
