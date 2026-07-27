import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock,
  FileText,
  HelpCircle,
  RotateCcw,
  Video,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { getSessions, getStudyPlans } from '@/lib/firestore';
import { formatDuration } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import type { SessionType, StudyPlan, StudySession } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SESSION_TYPES: Array<{
  value: SessionType;
  label: string;
  icon: typeof Video;
  className: string;
}> = [
  { value: 'video', label: 'Videoaulas', icon: Video, className: 'text-sky-500' },
  { value: 'pdf', label: 'PDF / Livro', icon: FileText, className: 'text-emerald-500' },
  { value: 'questions', label: 'Questões', icon: HelpCircle, className: 'text-amber-500' },
  { value: 'revision', label: 'Revisões', icon: RotateCcw, className: 'text-rose-500' },
];

export default function SessionsPage() {
  const { user } = useAuthContext();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState(() => localStorage.getItem('selectedPlanId') ?? '');
  const [loading, setLoading] = useState(true);

  const selectedPlan = plans.find(plan => plan.id === selectedPlanId);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const fetchedPlans = await getStudyPlans(user.uid);
      const targetPlan = fetchedPlans.find(plan => plan.id === selectedPlanId)
        ?? fetchedPlans.find(plan => plan.status === 'active')
        ?? fetchedPlans[0];
      const targetPlanId = targetPlan?.id ?? '';

      setPlans(fetchedPlans);
      setSelectedPlanId(targetPlanId);
      if (targetPlanId) localStorage.setItem('selectedPlanId', targetPlanId);

      const fetchedSessions = targetPlanId ? await getSessions(user.uid, targetPlanId) : [];
      setSessions(fetchedSessions);
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePlanChange = async (value: string | null) => {
    if (!user || !value) return;
    setSelectedPlanId(value);
    localStorage.setItem('selectedPlanId', value);
    setLoading(true);
    try {
      setSessions(await getSessions(user.uid, value));
    } finally {
      setLoading(false);
    }
  };

  const groupedSessions = sessions.reduce((groups, session) => {
    const date = format(new Date(session.startedAt), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(session);
    return groups;
  }, {} as Record<string, StudySession[]>);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const totalMinutes = sessions.reduce((total, session) => total + session.durationMinutes, 0);
  const todayMinutes = (groupedSessions[todayStr] ?? []).reduce(
    (total, session) => total + session.durationMinutes,
    0
  );
  const studiedSubjects = new Set(sessions.map(session => session.subjectId)).size;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Histórico de Sessões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe o tempo registrado pelo botão flutuante de estudo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedPlanId || undefined} onValueChange={handlePlanChange}>
            <SelectTrigger className="min-w-56">
              {selectedPlan ? (
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: selectedPlan.color }}
                  />
                  <span className="truncate">{selectedPlan.name}</span>
                </span>
              ) : (
                <SelectValue placeholder="Selecione o planejamento" />
              )}
            </SelectTrigger>
            <SelectContent>
              {plans.map(plan => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-xl p-5">
          <Clock className="mb-3 h-5 w-5 text-primary" />
          <p className="text-2xl font-bold">{formatDuration(todayMinutes)}</p>
          <p className="text-sm text-muted-foreground">estudados hoje</p>
        </div>
        <div className="glass rounded-xl p-5">
          <BarChart3 className="mb-3 h-5 w-5 text-emerald-500" />
          <p className="text-2xl font-bold">{formatDuration(totalMinutes)}</p>
          <p className="text-sm text-muted-foreground">tempo total no plano</p>
        </div>
        <div className="glass rounded-xl p-5">
          <BookOpen className="mb-3 h-5 w-5 text-amber-500" />
          <p className="text-2xl font-bold">{studiedSubjects}</p>
          <p className="text-sm text-muted-foreground">matérias estudadas</p>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tempo por tipo
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          {SESSION_TYPES.map(({ className, icon: Icon, label, value }) => {
            const minutesByType = sessions
              .filter(session => session.type === value)
              .reduce((total, session) => total + session.durationMinutes, 0);

            return (
              <div key={value} className="rounded-lg border border-border bg-background/50 p-4">
                <Icon className={cn('mb-3 h-5 w-5', className)} />
                <p className="font-semibold">{formatDuration(minutesByType)}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Registros</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(item => (
              <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Nenhuma sessão registrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use o botão flutuante “Estudar” para iniciar seu primeiro registro.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(groupedSessions).map(([date, daySessions]) => (
              <section key={date}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="px-2 text-xs font-medium text-muted-foreground">
                    {date === todayStr
                      ? 'Hoje'
                      : format(new Date(`${date}T12:00:00`), "d 'de' MMMM", { locale: ptBR })}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="space-y-2">
                  {daySessions.map(session => {
                    const type = SESSION_TYPES.find(item => item.value === session.type) ?? SESSION_TYPES[0];
                    const Icon = type.icon;

                    return (
                      <div key={session.id} className="flex items-center gap-3 rounded-lg bg-background/50 px-4 py-3">
                        <div className="rounded-lg border border-border bg-muted/50 p-2">
                          <Icon className={cn('h-4 w-4', type.className)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {session.topicName ?? session.subjectName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {type.label} · {session.subjectName}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold">{formatDuration(session.durationMinutes)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(session.startedAt), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
