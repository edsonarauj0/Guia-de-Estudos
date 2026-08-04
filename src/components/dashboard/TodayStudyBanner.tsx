import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Layers, Sparkles, Target } from 'lucide-react';
import type { StudyCycle, StudyCycleItem } from '@/types';

interface TodayStudyBannerProps {
  activeCycle: StudyCycle | null;
  todayStudiedHours: number;
  todayGoalHours: number;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getMotivationalMessage(progress: number, cycle: StudyCycle | null): string {
  if (!cycle) return 'Configure um ciclo de estudos para começar.';
  if (progress === 0) return 'Hora de começar! Que tal iniciar a primeira matéria do ciclo?';
  if (progress < 30) return 'Ótimo começo! Continue assim e bata sua meta hoje.';
  if (progress < 70) return 'Você está indo muito bem! Siga o ritmo do ciclo.';
  if (progress < 100) return 'Quase lá! Mais um esforço para completar o ciclo.';
  return 'Ciclo concluído! 🎉 Incrível dedicação!';
}

function getPrioritySubjects(items: StudyCycleItem[]): StudyCycleItem[] {
  // Return up to 3 items — prioritize the ones with least studied (planned first, then rest)
  return items.slice(0, 3);
}

export default function TodayStudyBanner({
  activeCycle,
  todayStudiedHours,
  todayGoalHours,
}: TodayStudyBannerProps) {
  const todayProgressPercent = useMemo(() => {
    if (!todayGoalHours || todayGoalHours === 0) return 0;
    return Math.min(100, Math.round((todayStudiedHours / todayGoalHours) * 100));
  }, [todayStudiedHours, todayGoalHours]);

  const prioritySubjects = useMemo(() => {
    if (!activeCycle) return [];
    return getPrioritySubjects(activeCycle.items);
  }, [activeCycle]);

  const motivational = getMotivationalMessage(todayProgressPercent, activeCycle);
  const greeting = getGreeting();

  return (
    <div className="relative overflow-hidden rounded-sm border border-primary/20 bg-gradient-to-br from-primary/10 via-sky-500/5 to-cyan-400/5 p-5 backdrop-blur-md">
      {/* Decorative blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 left-20 h-28 w-28 rounded-full bg-sky-400/10 blur-2xl"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: text content */}
        <div className="flex-1 min-w-0">
          {/* Greeting + cycle badge */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary/80">
              {greeting} — plano de hoje
            </span>
            {activeCycle && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                <Layers className="w-3 h-3" />
                Ciclo {activeCycle.cycleNumber ?? 1}
              </span>
            )}
          </div>

          {/* Main message */}
          <p className="text-sm text-foreground/80 font-medium mb-3 max-w-lg">
            {motivational}
          </p>

          {/* Subject chips */}
          {prioritySubjects.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
                <BookOpen className="w-3 h-3" />
                Estudar hoje:
              </span>
              {prioritySubjects.map((item, idx) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    borderColor: `${item.subjectColor}40`,
                    backgroundColor: `${item.subjectColor}18`,
                    color: item.subjectColor,
                  }}
                  title={item.topicName}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.subjectColor }}
                  />
                  {idx + 1}. {item.subjectName}
                </span>
              ))}
              {(activeCycle?.items.length ?? 0) > 3 && (
                <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  +{activeCycle!.items.length - 3} mais
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Target className="w-4 h-4" />
              <span>Nenhum ciclo ativo. Configure um para guiar seus estudos.</span>
            </div>
          )}
        </div>

        {/* Right: progress + CTA */}
        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          {/* Daily progress ring */}
          {todayGoalHours > 0 && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Meta diária</p>
                <p className="text-lg font-bold text-foreground leading-tight">
                  {todayStudiedHours.toFixed(1)}
                  <span className="text-xs font-normal text-muted-foreground">
                    /{todayGoalHours}h
                  </span>
                </p>
              </div>
              {/* Circular progress */}
              <div className="relative w-14 h-14 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                  <circle
                    cx="28"
                    cy="28"
                    r="23"
                    fill="none"
                    strokeWidth="4"
                    className="stroke-border/40"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="23"
                    fill="none"
                    strokeWidth="4"
                    strokeLinecap="round"
                    stroke="hsl(var(--primary))"
                    strokeDasharray={`${2 * Math.PI * 23}`}
                    strokeDashoffset={`${2 * Math.PI * 23 * (1 - todayProgressPercent / 100)}`}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Sparkles className="w-3 h-3 text-primary mb-0.5" />
                  <span className="text-[10px] font-bold text-foreground leading-none">
                    {todayProgressPercent}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* CTA button */}
          <Link
            to="/cycle"
            className="inline-flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary/20 hover:border-primary/50"
          >
            {activeCycle ? 'Ver ciclo completo' : 'Criar ciclo'}
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
