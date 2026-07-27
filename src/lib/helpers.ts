// ============================================================
// HELPERS DE DOMÍNIO — separados do utils.ts do shadcn
// ============================================================
import { differenceInCalendarDays, differenceInSeconds, format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDate(date: string | Date, fmt = 'dd/MM/yyyy'): string {
  return format(new Date(date), fmt, { locale: ptBR });
}

export function daysUntil(targetDate: string | Date): number {
  return Math.max(0, differenceInCalendarDays(new Date(targetDate), new Date()));
}

export function secondsUntil(targetDate: string | Date): number {
  return Math.max(0, differenceInSeconds(new Date(targetDate), new Date()));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function formatCountdown(totalSeconds: number): {
  days: number; hours: number; minutes: number; seconds: number;
} {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export function getTopicOverallStatus(progress: {
  video: { status: string };
  pdf: { status: string };
  questions: { status: string };
  revision: { status: string };
}): 'not_started' | 'in_progress' | 'completed' {
  const statuses = [
    progress.video.status,
    progress.pdf.status,
    progress.questions.status,
    progress.revision.status,
  ];
  if (statuses.every(s => s === 'not_started')) return 'not_started';
  if (statuses.every(s => s === 'completed')) return 'completed';
  return 'in_progress';
}

export function getTopicProgressPercent(progress: {
  video: { status: string };
  pdf: { status: string };
  questions: { status: string };
  revision: { status: string };
}): number {
  const keys = ['video', 'pdf', 'questions', 'revision'] as const;
  const total = keys.length;
  let score = 0;
  for (const key of keys) {
    if (progress[key].status === 'completed') score += 1;
    else if (progress[key].status === 'in_progress') score += 0.5;
  }
  return Math.round((score / total) * 100);
}

export function getSubjectProgressPercent(topics: Array<{
  progress: {
    video: { status: string };
    pdf: { status: string };
    questions: { status: string };
    revision: { status: string };
  }
}>): number {
  if (topics.length === 0) return 0;
  const sum = topics.reduce((acc, t) => acc + getTopicProgressPercent(t.progress), 0);
  return Math.round(sum / topics.length);
}

export function getDayOfWeek(date: Date = new Date()): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

export const SUBJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6',
];

export const MEDIA_LABELS: Record<string, string> = {
  video: 'Vídeo',
  pdf: 'PDF / Livro',
  questions: 'Questões',
  revision: 'Revisão',
};

export const STATUS_LABELS: Record<string, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
};

export function generateId(): string {
  return crypto.randomUUID();
}

export function todayISO(): string {
  return startOfDay(new Date()).toISOString();
}
