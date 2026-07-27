import { useCountdown } from '@/hooks/useCountdown';
import { cn } from '@/lib/utils';

interface CountdownProps {
  examDate?: string;
  examName?: string;
}

export default function Countdown({ examDate, examName }: CountdownProps) {
  const { countdown, isExpired } = useCountdown(examDate);

  if (!examDate) {
    return (
      <div className="glass rounded-2xl p-6 border border-dashed border-border text-center">
        <p className="text-muted-foreground text-sm">Configure a data da prova nas</p>
        <p className="text-primary font-medium text-sm">Configurações</p>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <p className="text-2xl font-bold text-primary">🎉 Prova realizada!</p>
        <p className="text-muted-foreground mt-1">{examName}</p>
      </div>
    );
  }

  const units = [
    { value: countdown.days, label: 'Dias' },
    { value: countdown.hours, label: 'Horas' },
    { value: countdown.minutes, label: 'Min' },
    { value: countdown.seconds, label: 'Seg' },
  ];

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Contagem regressiva</p>
        {examName && <p className="text-sm text-foreground font-medium mt-0.5">{examName}</p>}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {units.map(({ value, label }) => (
          <div
            key={label}
            className="bg-background/60 rounded-xl p-3 text-center border border-border/50"
          >
            <div
              className={cn(
                "text-2xl font-bold font-mono tabular-nums",
                label === 'Dias' && value <= 30 ? 'text-red-400' :
                label === 'Dias' && value <= 60 ? 'text-amber-400' :
                'gradient-text'
              )}
            >
              {String(value).padStart(2, '0')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
