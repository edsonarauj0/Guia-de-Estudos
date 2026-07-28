import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { StudySession } from '@/types';

interface ActivityHeatmapProps {
  sessions: StudySession[];
}

function buildHeatmapData(sessions: StudySession[]) {
  const today = startOfDay(new Date());
  const days = 91; // 13 weeks

  // Build map of date -> hours
  const hoursMap: Record<string, number> = {};
  sessions.forEach(s => {
    const date = format(new Date(s.startedAt), 'yyyy-MM-dd');
    hoursMap[date] = (hoursMap[date] ?? 0) + s.durationMinutes / 60;
  });

  // Build array of days (last 91 days)
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const iso = format(date, 'yyyy-MM-dd');
    result.push({ date, iso, hours: hoursMap[iso] ?? 0 });
  }
  return result;
}

function getIntensity(hours: number): number {
  if (hours === 0) return 0;
  if (hours < 1) return 1;
  if (hours < 2) return 2;
  if (hours < 4) return 3;
  return 4;
}

const WEEK_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function ActivityHeatmap({ sessions }: ActivityHeatmapProps) {
  const data = buildHeatmapData(sessions);

  // Group into weeks
  const firstDayOfWeek = data[0].date.getDay(); // 0 = Sunday
  const paddedData = [
    ...Array(firstDayOfWeek).fill(null),
    ...data,
  ];

  const weeks: (typeof data[0] | null)[][] = [];
  for (let i = 0; i < paddedData.length; i += 7) {
    weeks.push(paddedData.slice(i, i + 7) as any);
  }

  return (
    <div className="glass rounded-sm p-6">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4">Atividade dos últimos 3 meses</p>

      <div className="flex gap-1 overflow-x-auto pb-2">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-1 justify-around pt-5">
          {WEEK_LABELS.map((d, i) => (
            i % 2 === 1 ? <span key={i} className="text-xs text-muted-foreground h-3 flex items-center">{d}</span> : <span key={i} className="h-3" />
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {/* Month label */}
            <div className="h-5 flex items-center">
              {week[0] && format(week[0].date, 'd') === '1' && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(week[0].date, 'MMM', { locale: ptBR })}
                </span>
              )}
            </div>
            {week.map((day, di) => (
              <div
                key={di}
                title={day ? `${format(day.date, 'dd/MM/yyyy')}: ${day.hours.toFixed(1)}h` : ''}
                className={cn(
                  'w-3 h-3 rounded-sm transition-all duration-200 hover:scale-125 cursor-default',
                  !day && 'invisible',
                  day && getIntensity(day.hours) === 0 && 'bg-muted/50',
                  day && getIntensity(day.hours) === 1 && 'bg-primary/25',
                  day && getIntensity(day.hours) === 2 && 'bg-primary/50',
                  day && getIntensity(day.hours) === 3 && 'bg-primary/75',
                  day && getIntensity(day.hours) === 4 && 'bg-primary',
                )}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-xs text-muted-foreground">Menos</span>
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={cn(
              'w-3 h-3 rounded-sm',
              i === 0 && 'bg-muted/50',
              i === 1 && 'bg-primary/25',
              i === 2 && 'bg-primary/50',
              i === 3 && 'bg-primary/75',
              i === 4 && 'bg-primary',
            )}
          />
        ))}
        <span className="text-xs text-muted-foreground">Mais</span>
      </div>
    </div>
  );
}
