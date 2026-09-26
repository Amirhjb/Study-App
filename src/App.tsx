import { useEffect, useState, type ComponentType } from 'react';
import {
  CalendarDays,
  ChartColumn,
  Clock,
  GraduationCap,
  LayoutDashboard,
  Library,
  ListChecks,
  Menu,
  NotebookPen,
  Settings as SettingsIcon,
  Target,
  Timer as TimerIcon,
  Trophy,
  X,
} from 'lucide-react';
import { useApplyTheme, useHashRoute } from './lib/hooks';
import { useStore } from './store/useStore';
import { TimerEngine } from './components/TimerEngine';
import { GlobalModals } from './components/forms';
import { Toasts } from './components/Toasts';
import { MiniTimer } from './components/MiniTimer';
import { CloudBadge } from './components/CloudBadge';
import { Onboarding } from './components/Onboarding';
import { FocusOverlay } from './components/FocusOverlay';
import { cx } from './components/ui';
import Dashboard from './pages/Dashboard';
import TimerPage from './pages/TimerPage';
import Sessions from './pages/Sessions';
import Stats from './pages/Stats';
import CalendarPage from './pages/CalendarPage';
import Tasks from './pages/Tasks';
import Exams from './pages/Exams';
import Grades from './pages/Grades';
import Notes from './pages/Notes';
import Subjects from './pages/Subjects';
import Goals from './pages/Goals';
import SettingsPage from './pages/SettingsPage';

const pages: Record<string, ComponentType> = {
  panel: Dashboard,
  temporizador: TimerPage,
  sesiones: Sessions,
  estadisticas: Stats,
  calendario: CalendarPage,
  tareas: Tasks,
  examenes: Exams,
  calificaciones: Grades,
  notas: Notes,
  asignaturas: Subjects,
  objetivos: Goals,
  ajustes: SettingsPage,
};

const NAV: { group: string; items: { id: string; label: string; icon: ComponentType<{ size?: number }> }[] }[] = [
  {
    group: '',
    items: [
      { id: 'panel', label: 'Panel', icon: LayoutDashboard },
      { id: 'temporizador', label: 'Temporizador', icon: TimerIcon },
      { id: 'estadisticas', label: 'Estadísticas', icon: ChartColumn },
      { id: 'sesiones', label: 'Sesiones', icon: Clock },
      { id: 'calendario', label: 'Calendario', icon: CalendarDays },
    ],
  },
  {
    group: 'Organización',
    items: [
      { id: 'tareas', label: 'Tareas', icon: ListChecks },
      { id: 'examenes', label: 'Exámenes', icon: Target },
      { id: 'calificaciones', label: 'Calificaciones', icon: GraduationCap },
      { id: 'notas', label: 'Notas', icon: NotebookPen },
      { id: 'asignaturas', label: 'Asignaturas', icon: Library },
    ],
  },
  {
    group: 'Progreso',
    items: [
      { id: 'objetivos', label: 'Objetivos y logros', icon: Trophy },
      { id: 'ajustes', label: 'Ajustes', icon: SettingsIcon },
    ],
  },
];

const MOBILE_TABS = ['panel', 'temporizador', 'estadisticas', 'tareas'];

export default function App() {
  useApplyTheme();
  const [route, go] = useHashRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const onboarded = useStore((s) => s.settings.onboarded);
  const Page = pages[route] ?? Dashboard;

  useEffect(() => {
    setMenuOpen(false);
    document.getElementById('main')?.scrollTo({ top: 0 });
  }, [route]);

  const allItems = NAV.flatMap((g) => g.items);

  const nav = (
    <nav className="flex flex-col gap-5">
      {NAV.map((g) => (
        <div key={g.group || 'main'} className="flex flex-col gap-0.5">
          {g.group && <div className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{g.group}</div>}
          {g.items.map((it) => {
            const Icon = it.icon;
            const active = route === it.id;
            return (
              <a
                key={it.id}
                href={`#/${it.id}`}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-accent-soft text-accent-ink' : 'text-ink-2 hover:bg-hover hover:text-ink',
                )}
              >
                <Icon size={18} />
                {it.label}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex h-full">
      <TimerEngine />
      {/* Barra lateral (escritorio) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-card px-3 py-5 lg:flex">
        <Brand />
        <div className="mt-6 flex-1 overflow-y-auto">{nav}</div>
        <CloudBadge />
        <MiniTimer onOpen={() => go('temporizador')} />
      </aside>

      {/* Menú móvil */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="animate-pop absolute inset-y-0 left-0 flex w-72 flex-col bg-card px-3 py-5 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button className="rounded-lg p-2 text-ink-2 hover:bg-hover" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">{nav}</div>
            <CloudBadge />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera móvil */}
        <header className="flex items-center justify-between border-b border-line bg-card px-4 py-2.5 lg:hidden">
          <button className="rounded-lg p-2 text-ink-2 hover:bg-hover" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <Menu size={20} />
          </button>
          <Brand compact />
          <MiniTimer compact onOpen={() => go('temporizador')} />
        </header>

        <main id="main" className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Page key={route} />
          </div>
        </main>

        {/* Pestañas inferiores (móvil) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
          {MOBILE_TABS.map((id) => {
            const it = allItems.find((x) => x.id === id)!;
            const Icon = it.icon;
            const active = route === id;
            return (
              <a
                key={id}
                href={`#/${id}`}
                className={cx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', active ? 'text-accent-ink' : 'text-muted')}
              >
                <Icon size={20} />
                {it.label}
              </a>
            );
          })}
        </nav>
      </div>

      <GlobalModals />
      <FocusOverlay />
      <Toasts />
      {!onboarded && <Onboarding />}
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <a href="#/panel" className="flex items-center gap-2.5 px-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M7 10.8V15c0 1.4 2.2 3 5 3s5-1.6 5-3v-4.2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && <span className="text-[17px] font-semibold tracking-tight">Studium</span>}
      {compact && <span className="text-[16px] font-semibold tracking-tight">Studium</span>}
    </a>
  );
}
