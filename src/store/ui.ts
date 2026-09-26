import { create } from 'zustand';
import type { Exam, ID, Session, Subject, Task } from '../lib/types';

export type ModalState =
  | { kind: 'session'; id?: ID; defaults?: Partial<Session> }
  | { kind: 'task'; id?: ID; defaults?: Partial<Task> }
  | { kind: 'exam'; id?: ID; defaults?: Partial<Exam> }
  | { kind: 'subject'; id?: ID; defaults?: Partial<Subject> }
  | { kind: 'finish' };

export interface Toast {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface UIState {
  modal: ModalState | null;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
  toasts: Toast[];
  toast: (text: string, action?: { label: string; onAction: () => void }) => void;
  dismissToast: (id: number) => void;
  focusMode: boolean;
  setFocusMode: (v: boolean) => void;
}

let toastId = 0;

export const useUI = create<UIState>()((set, get) => ({
  modal: null,
  openModal: (m) => set({ modal: m }),
  closeModal: () => set({ modal: null }),
  toasts: [],
  toast: (text, action) => {
    const id = ++toastId;
    set((s) => ({
      toasts: [...s.toasts.slice(-2), { id, text, actionLabel: action?.label, onAction: action?.onAction }],
    }));
    window.setTimeout(() => get().dismissToast(id), action ? 6000 : 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  focusMode: false,
  setFocusMode: (v) => set({ focusMode: v }),
}));
