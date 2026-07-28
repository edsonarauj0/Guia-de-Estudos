import { useMemo, useState } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HelpCircle, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudySession } from '@/types';

interface StudyConsistencyCardProps {
  sessions: StudySession[];
}

const WINDOW_SIZE = 30; // days shown per "page"

function buildDayMap(sessions: StudySession[]): Record<string, number> {
  const map: Record<string, number> = {};
  sessions.forEach(s => {
    const d = format(new Date(s.startedAt), 'yyyy-MM-dd');
    map[d] = (map[d] ?? 0) + s.durationMinutes;
  });
  return map;
}

function calcStreak(dayMap: Record<string, number>): number {
  let streak = 0;
  let cur = startOfDay(new Date());
  // allow today to be counted even if not yet studied (don't penalise)
  const todayIso = format(cur, 'yyyy-MM-dd');
  if (!dayMap[todayIso]) {
    cur = subDays(cur, 1);
  }
  while (true) {
    const iso = format(cur, 'yyyy-MM-dd');
    if (!dayMap[iso]) break;
    streak++;
    cur = subDays(cur, 1);
  }
  return streak;
}

function calcRecord(dayMap: Record<string, number>): number {
  const sortedDates = Object.keys(dayMap).sort();
  if (sortedDates.length === 0) return 0;

  let best = 0;
  let current = 0;
  let prev: Date | null = null;

  for (const iso of sortedDates) {
    const d = new Date(iso + 'T12:00:00');
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
      if (diff === 1) {
        current++;
      } else {
        best = Math.max(best, current);
        current = 1;
      }
    } else {
      current = 1;
    }
    prev = d;
  }
  return Math.max(best, current);
}

function formatDateRange(offsetDays: number): { start: string; end: string } {
  const today = startOfDay(new Date());
  const end = subDays(today, offsetDays);
  const start = subDays(end, WINDOW_SIZE - 1);
  return {
    start: format(start, 'dd/MM', { locale: ptBR }),
    end: format(end, 'dd/MM', { locale: ptBR }),
  };
}

export default function StudyConsistencyCard({ sessions }: StudyConsistencyCardProps) {
  const [offset, setOffset] = useState(0); // 0 = current window, 30 = previous, etc.

  const dayMap = useMemo(() => buildDayMap(sessions), [sessions]);
  const streak = useMemo(() => calcStreak(dayMap), [dayMap]);
  const record = useMemo(() => calcRecord(dayMap), [dayMap]);

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: WINDOW_SIZE }, (_, i) => {
      const date = subDays(today, offset + (WINDOW_SIZE - 1 - i));
      const iso = format(date, 'yyyy-MM-dd');
      const minutes = dayMap[iso] ?? 0;
      const isToday = iso === format(today, 'yyyy-MM-dd');
      return { date, iso, minutes, isToday };
    });
  }, [dayMap, offset]);

  const { start, end } = formatDateRange(offset);
  const canGoForward = offset > 0;

  return (
    <div className="glass rounded-2xl p-5 border border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Constância nos Estudos
          </p>
          <div className="group relative">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-5 w-52 bg-popover border border-border rounded-lg p-2 text-xs text-muted-foreground shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Dias em que você registrou ao menos uma sessão de estudo.
            </div>
          </div>
        </div>

        {/* Date range navigator */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <button
            onClick={() => setOffset(o => o + WINDOW_SIZE)}
            className="p-0.5 rounded hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-medium tabular-nums">{start} – {end}</span>
          <button
            onClick={() => setOffset(o => Math.max(0, o - WINDOW_SIZE))}
            disabled={!canGoForward}
            className={cn(
              'p-0.5 rounded transition-colors',
              canGoForward ? 'hover:bg-secondary' : 'opacity-30 cursor-not-allowed'
            )}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Streak info */}
      <p className="text-sm text-muted-foreground mb-4">
        {streak > 0 ? (
          <>
            Você está há{' '}
            <span className="font-bold text-foreground">{streak} {streak === 1 ? 'dia' : 'dias'}</span>{' '}
            estudando! Seu recorde é de{' '}
            <span className="font-bold text-foreground">{record} {record === 1 ? 'dia' : 'dias'}</span>{' '}
            sem falhas. <Calendar className="inline w-3.5 h-3.5 ml-0.5 text-muted-foreground" />
          </>
        ) : (
          <>
            Você está há{' '}
            <span className="font-bold text-foreground">0 dias</span>{' '}
            sem estudar! Seu recorde é de{' '}
            <span className="font-bold text-foreground">{record} {record === 1 ? 'dia' : 'dias'}</span>{' '}
            sem falhas. <Calendar className="inline w-3.5 h-3.5 ml-0.5 text-muted-foreground" />
          </>
        )}
      </p>

      {/* Day bubbles strip */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {days.map(({ iso, minutes, isToday }) => {
          const studied = minutes > 0;
          return (
            <div key={iso} className="group relative flex-shrink-0">
              <div
                className={cn(
                  'w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 cursor-default',
                  studied
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 hover:bg-emerald-500/30 hover:scale-110'
                    : 'bg-rose-500/10 border-rose-400/60 text-rose-400/70 hover:scale-110',
                  isToday && !studied && 'border-amber-400/80 bg-amber-400/10 text-amber-400',
                  isToday && studied && 'ring-2 ring-offset-1 ring-emerald-500/50 ring-offset-background',
                )}
              >
                {studied ? (
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                ) : (
                  <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none">
                    <line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </div>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap">
                <div className="bg-popover border border-border rounded-md px-2 py-1 text-xs shadow-md text-foreground">
                  {format(new Date(iso + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })}
                  <br />
                  {studied ? (
                    <span className="text-emerald-400 font-semibold">
                      {Math.floor(minutes / 60)}h{minutes % 60 > 0 ? ` ${minutes % 60}min` : ''} estudados
                    </span>
                  ) : (
                    <span className="text-rose-400">Sem estudo</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
          <span>Estudou</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-rose-500/10 border-2 border-rose-400/60 flex items-center justify-center">
            <svg viewBox="0 0 14 14" className="w-2.5 h-2.5 text-rose-400/70" fill="none">
              <line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span>Não estudou</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-amber-400/10 border-2 border-amber-400/80" />
          <span>Hoje</span>
        </div>
      </div>
    </div>
  );
}
