import type { ExamType, Priority, TaskStatus, TaskType } from './types';

export const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'deberes', label: 'Deberes' },
  { value: 'trabajo', label: 'Trabajo' },
  { value: 'proyecto', label: 'Proyecto' },
  { value: 'lectura', label: 'Lectura' },
  { value: 'repaso', label: 'Repaso' },
  { value: 'otro', label: 'Otro' },
];

export const TASK_STATUS: { value: TaskStatus; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_progreso', label: 'En progreso' },
  { value: 'hecha', label: 'Hecha' },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

export const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: 'final', label: 'Examen final' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'quiz', label: 'Test / quiz' },
  { value: 'oral', label: 'Oral' },
  { value: 'practica', label: 'Práctica' },
  { value: 'presentacion', label: 'Presentación' },
];

export const labelOf = <T extends string>(list: { value: T; label: string }[], v: T) =>
  list.find((x) => x.value === v)?.label ?? v;

export const COLOR_NAMES = ['Azul', 'Naranja', 'Aguamarina', 'Amarillo', 'Rosa', 'Verde', 'Violeta', 'Rojo'];
