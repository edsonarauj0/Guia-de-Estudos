import { useEffect, useMemo, useState } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers3,
  Pencil,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import SimulateReviewModal from '@/components/reviews/SimulateReviewModal';
import { toast } from 'sonner';

import { useAuthContext } from '@/contexts/AuthContext';
import { usePlanContext } from '@/contexts/PlanContext';
import { deleteReviewCard, getReviewCards, getStudyPlans, submitReview } from '@/lib/firestore';
import { describeInterval, formatDateYMD, getQualityLabel, isDueToday } from '@/lib/sm2';
import type { SM2Quality } from '@/lib/sm2';
import type { ReviewCard, StudyPlan } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const REVIEW_QUALITIES: SM2Quality[] = [0, 2, 4, 5];

export default function Reviews() {
  const { user } = useAuthContext();
  const { selectedPlanId: globalPlanId } = usePlanContext();
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionCompletedCount, setSessionCompletedCount] = useState(0);
  const [simulatingCard, setSimulatingCard] = useState<ReviewCard | null>(null);

  useEffect(() => {
    if (user) loadData();
  }, [user, globalPlanId]);

  useEffect(() => { setSelectedPlanId(globalPlanId ?? 'all'); }, [globalPlanId]);

  async function loadData() {
    if (!user) return;

    try {
      const [fetchedCards, fetchedPlans] = await Promise.all([
        getReviewCards(user.uid, globalPlanId ?? undefined),
        getStudyPlans(user.uid),
      ]);
      setCards(fetchedCards);
      setPlans(fetchedPlans);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar as revisões');
    } finally {
      setLoading(false);
    }
  }

  const filteredCards = useMemo(() => {
    if (selectedPlanId === 'all') return cards;
    return cards.filter(card => card.planId === selectedPlanId);
  }, [cards, selectedPlanId]);

  const dueCards = useMemo(
    () => filteredCards.filter(isDueToday),
    [filteredCards],
  );

  const upcomingDays = useMemo(() => {
    const today = new Date();

    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index + 1);
      const dateString = formatDateYMD(date);

      return {
        date: dateString,
        dayName: format(date, 'EEE', { locale: ptBR }).replace('.', ''),
        dayNumber: format(date, 'dd'),
        month: format(date, 'MMM', { locale: ptBR }).replace('.', ''),
        count: filteredCards.filter(card => card.nextReview === dateString).length,
      };
    });
  }, [filteredCards]);

  const nextSevenDaysCount = upcomingDays.reduce((total, day) => total + day.count, 0);
  const selectedPlanName = selectedPlanId === 'all'
    ? 'Todos os planejamentos'
    : plans.find(plan => plan.id === selectedPlanId)?.name ?? 'Planejamento';

  const selectItems = [
    { value: 'all', label: 'Todos os planejamentos' },
    ...plans.map(plan => ({ value: plan.id, label: plan.name })),
  ];

  const startReviewSession = () => {
    if (dueCards.length === 0) {
      toast.info('Não há tópicos para revisar hoje');
      return;
    }

    setSessionQueue([...dueCards]);
    setCurrentIndex(0);
    setSessionCompletedCount(0);
    setIsReviewing(true);
  };

  const finishSession = (completed = false) => {
    setIsReviewing(false);
    setSessionQueue([]);
    loadData();

    if (completed) toast.success('Sessão de revisão concluída!');
  };

  const handleReview = async (quality: SM2Quality) => {
    const card = sessionQueue[currentIndex];

    try {
      await submitReview(card.id, card, quality);
      setSessionCompletedCount(count => count + 1);

      if (currentIndex < sessionQueue.length - 1) {
        setCurrentIndex(index => index + 1);
      } else {
        finishSession(true);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar a revisão');
    }
  };

  const handleSkip = () => {
    if (currentIndex < sessionQueue.length - 1) {
      setCurrentIndex(index => index + 1);
    } else {
      finishSession();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este tópico das revisões?')) return;

    try {
      await deleteReviewCard(id);
      setCards(currentCards => currentCards.filter(card => card.id !== id));
      toast.success('Tópico removido da fila');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover o tópico');
    }
  };

  const getSimulatedInterval = (card: ReviewCard, quality: SM2Quality) => {
    let { repetitions, interval, easeFactor } = card;

    if (quality < 3) interval = 1;
    else if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);

    return describeInterval(interval);
  };

  if (loading) return <ReviewsSkeleton />;

  if (isReviewing && sessionQueue.length > 0) {
    const currentCard = sessionQueue[currentIndex];
    const progress = (currentIndex / sessionQueue.length) * 100;

    return (
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-4xl flex-col justify-center animate-fade-in">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary/15 text-primary">
              <BrainCircuit className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Sessão de revisão</p>
              <p className="truncate text-sm text-muted-foreground">
                {sessionCompletedCount} concluída{sessionCompletedCount === 1 ? '' : 's'} nesta sessão
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => finishSession()} aria-label="Encerrar sessão">
            <X className="size-5" />
          </Button>
        </div>

        <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Tópico {currentIndex + 1} de {sessionQueue.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="mb-6" />

        <Card className="relative gap-0 overflow-hidden border-primary/15 bg-gradient-to-b from-primary/10 via-card to-card py-0 shadow-2xl shadow-primary/5">
          <CardContent className="flex min-h-[300px] flex-col items-center justify-center px-6 py-12 text-center sm:min-h-[360px] sm:px-12">
            <Badge
              variant="outline"
              className="mb-6 border-transparent px-3"
              style={{ backgroundColor: `${currentCard.subjectColor}20`, color: currentCard.subjectColor }}
            >
              {currentCard.subjectName}
            </Badge>
            <h1 className="max-w-2xl text-balance text-2xl font-bold leading-tight text-foreground sm:text-4xl">
              {currentCard.topicName}
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Tente explicar o tópico com suas próprias palavras e avalie quanto conseguiu lembrar.
            </p>
          </CardContent>

          <CardFooter className="flex-col gap-5 border-border/70 bg-muted/30 p-4 sm:p-6">
            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {REVIEW_QUALITIES.map(quality => {
                const { label, color } = getQualityLabel(quality);

                return (
                  <Button
                    key={quality}
                    variant="outline"
                    className={`h-auto min-h-20 flex-col gap-1.5 whitespace-normal py-3 text-center ${color}`}
                    onClick={() => handleReview(quality)}
                  >
                    <span className="font-semibold">{label}</span>
                    <span className="text-xs font-normal opacity-75">
                      {getSimulatedInterval(currentCard, quality)}
                    </span>
                  </Button>
                );
              })}
            </div>
            <Button variant="ghost" className="self-end text-muted-foreground" onClick={handleSkip}>
              Pular por agora
              <SkipForward className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 animate-fade-in">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
            <RotateCcw className="size-4" />
            Memória ativa
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Revisões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fortaleça o que estudou no momento certo.
          </p>
        </div>

      </header>

      <section className="relative overflow-hidden rounded-sm border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-sm bg-primary/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <div className="hidden size-12 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-lg shadow-primary/20 sm:flex">
              <Sparkles className="size-6" />
            </div>
            <div>
              <Badge variant="secondary" className="mb-3">{selectedPlanName}</Badge>
              <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                {dueCards.length > 0
                  ? `${dueCards.length} ${dueCards.length === 1 ? 'tópico espera' : 'tópicos esperam'} por você`
                  : 'Sua revisão de hoje está em dia'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {dueCards.length > 0
                  ? 'Uma sessão curta agora ajuda a manter esse conteúdo acessível por muito mais tempo.'
                  : 'Ótimo ritmo. Você pode conferir as próximas revisões ou revisar novamente mais tarde.'}
              </p>
            </div>
          </div>
          <Button
            size="lg"
            className="w-full gap-2 shadow-lg shadow-primary/15 lg:w-auto"
            disabled={dueCards.length === 0}
            onClick={startReviewSession}
          >
            <Play className="size-4 fill-current" />
            Iniciar revisão
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ReviewMetric
          icon={<Clock3 className="size-5 text-amber-500" />}
          label="Pendentes agora"
          value={dueCards.length}
          helper="inclui revisões atrasadas"
        />
        <ReviewMetric
          icon={<CalendarDays className="size-5 text-sky-500" />}
          label="Próximos 7 dias"
          value={nextSevenDaysCount}
          helper="revisões programadas"
        />
        <ReviewMetric
          icon={<Layers3 className="size-5 text-emerald-500" />}
          label="Na rotina"
          value={filteredCards.length}
          helper="tópicos em repetição"
        />
      </section>

      <Tabs defaultValue="today" className="gap-5">
        <div className="overflow-x-auto pb-1">
          <TabsList className="grid h-10 min-w-[430px] grid-cols-3 sm:min-w-0 sm:w-fit">
            <TabsTrigger value="today" className="px-3">
              Para hoje
              {dueCards.length > 0 && <Badge variant="secondary">{dueCards.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="px-3">Próximos dias</TabsTrigger>
            <TabsTrigger value="all" className="px-3">Todos os tópicos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="today">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="size-4 text-primary" />
                Fila de hoje
              </CardTitle>
              <CardDescription>Ordenada pela data prevista de revisão.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {dueCards.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="size-7" />}
                  title="Tudo revisado por hoje"
                  description="Novas revisões aparecerão aqui automaticamente nas datas programadas."
                />
              ) : (
                <div className="divide-y divide-border/70">
                  {dueCards.map((card, index) => (
                    <ReviewRow key={card.id} card={card} today={formatDateYMD(new Date())} order={index + 1} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" />
                Agenda dos próximos 7 dias
              </CardTitle>
              <CardDescription>Uma visão rápida da carga de revisão que está chegando.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {upcomingDays.map((day, index) => {
                  const maxCount = Math.max(...upcomingDays.map(item => item.count), 1);
                  const barHeight = day.count === 0 ? 8 : Math.max(18, (day.count / maxCount) * 72);

                  return (
                    <div
                      key={day.date}
                      className={`flex min-h-40 flex-col rounded-sm border p-3 ${index === 0 ? 'border-primary/30 bg-primary/5' : 'border-border/70 bg-muted/20'}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">{day.dayName}</span>
                        <span className="text-xs text-muted-foreground">{day.month}</span>
                      </div>
                      <span className="mt-1 text-xl font-bold text-foreground">{day.dayNumber}</span>
                      <div className="mt-auto flex items-end gap-2 pt-4">
                        <div className="flex h-[72px] w-2 items-end overflow-hidden rounded-sm bg-muted">
                          <div className="w-full rounded-sm bg-primary" style={{ height: `${barHeight}px` }} />
                        </div>
                        <div className="pb-0.5">
                          <p className="text-lg font-bold leading-none text-foreground">{day.count}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{day.count === 1 ? 'revisão' : 'revisões'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
              <CardTitle>Todos os tópicos</CardTitle>
              <CardDescription>{filteredCards.length} tópico{filteredCards.length === 1 ? '' : 's'} na rotina de revisão.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredCards.length === 0 ? (
                <EmptyState
                  icon={<Layers3 className="size-7" />}
                  title="Nenhum tópico nesta fila"
                  description="Adicione tópicos pela tela de Matérias para começar sua rotina de revisão."
                />
              ) : (
                <div className="divide-y divide-border/70">
                  {filteredCards.map(card => (
                    <div key={card.id} className="group flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-muted/25 sm:flex-row sm:items-center sm:px-6">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="h-10 w-1 shrink-0 rounded-sm" style={{ backgroundColor: card.subjectColor }} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{card.topicName}</p>
                          <p className="truncate text-sm text-muted-foreground">{card.subjectName}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 pl-4 sm:justify-end sm:pl-0">
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-medium text-foreground">
                            {card.nextReview <= formatDateYMD(new Date())
                              ? card.nextReview < formatDateYMD(new Date()) ? 'Revisão atrasada' : 'Revisar hoje'
                              : format(parseISO(card.nextReview), "dd 'de' MMM", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {card.repetitions} repetiç{card.repetitions === 1 ? 'ão' : 'ões'} · {describeInterval(card.interval)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            onClick={() => setSimulatingCard(card)}
                            aria-label={`Simular histórico de ${card.topicName}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(card.id)}
                            aria-label={`Remover ${card.topicName} das revisões`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SimulateReviewModal
        card={simulatingCard}
        open={simulatingCard !== null}
        onClose={() => setSimulatingCard(null)}
        onApplied={() => { setSimulatingCard(null); loadData(); }}
      />
    </div>
  );
}

function ReviewMetric({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: number; helper: string }) {
  return (
    <Card size="sm" className="card-hover">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-muted/70">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{value}</span>
            <span className="truncate text-xs text-muted-foreground">{helper}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewRow({ card, today, order }: { card: ReviewCard; today: string; order: number }) {
  const overdue = card.nextReview < today;

  return (
    <div className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/25 sm:px-6">
      <span className="hidden w-6 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground sm:block">
        {String(order).padStart(2, '0')}
      </span>
      <div className="h-10 w-1 shrink-0 rounded-sm" style={{ backgroundColor: card.subjectColor }} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{card.topicName}</p>
        <p className="truncate text-sm text-muted-foreground">{card.subjectName}</p>
      </div>
      <Badge variant={overdue ? 'destructive' : 'secondary'}>
        {overdue ? 'Atrasado' : 'Hoje'}
      </Badge>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-sm bg-primary/10 text-primary">{icon}</div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="hidden h-8 w-64 sm:block" />
      </div>
      <Skeleton className="h-44 rounded-sm" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-sm" />
        <Skeleton className="h-20 rounded-sm" />
        <Skeleton className="h-20 rounded-sm" />
      </div>
      <Skeleton className="h-80 rounded-sm" />
    </div>
  );
}
