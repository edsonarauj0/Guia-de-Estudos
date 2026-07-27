import { useEffect, useMemo, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePlanContext } from '@/contexts/PlanContext';
import { getSubjects, getTopics, getSessions, getQuestionLogs, getReviewCards, getStudyCycles, getStudyPlans } from '@/lib/firestore';
import { calculatePlannerStats, calcTodayHours, calcStreak } from '@/lib/plannerEngine';
import Countdown from '@/components/dashboard/Countdown';
import ActivityHeatmap from '@/components/dashboard/ActivityHeatmap';
import SubjectProgressChart from '@/components/dashboard/SubjectProgressChart';
import { Progress } from '@/components/ui/progress';
import type { PlannerStats, StudyCycle, StudySession } from '@/types';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  BookOpen, CheckCircle2, Clock, Flame, Target, TrendingUp,
  AlertCircle, HelpCircle, RotateCcw
} from 'lucide-react';
import { formatDuration, getDayOfWeek } from '@/lib/helpers';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user, profile } = useAuthContext();
  const { selectedPlanId } = usePlanContext();
  const [stats, setStats] = useState<PlannerStats | null>(null);
  const [loading, setLoading] = useState(true);

  // New states
  const [todayQuestions, setTodayQuestions] = useState({ total: 0, correct: 0 });
  const [pendingReviews, setPendingReviews] = useState(0);
  const [streak, setStreak] = useState(0);
  const [todayStudiedHours, setTodayStudiedHours] = useState(0);
  const [todayGoalHours, setTodayGoalHours] = useState(0);
  const [activeCycle, setActiveCycle] = useState<StudyCycle | null>(null);
  const [cycleSessions, setCycleSessions] = useState<StudySession[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const plans = await getStudyPlans(user.uid);
        let targetPlanId = selectedPlanId;
        if (!targetPlanId && plans.length > 0) targetPlanId = plans[0].id;

        if (!targetPlanId) {
          setLoading(false);
          return;
        }
        const activePlan = plans.find(p => p.id === targetPlanId) || plans[0];

        const subjects = await getSubjects(activePlan.id);
        const subjectsWithTopics = await Promise.all(
          subjects.map(async s => ({
            ...s,
            topics: await getTopics(activePlan.id, s.id),
          }))
        );
        const sessions = await getSessions(user.uid, activePlan.id);
        const cycles = await getStudyCycles(user.uid, activePlan.id);
        setActiveCycle(cycles.find(cycle => cycle.status === 'active') ?? null);
        setCycleSessions(sessions);

        if (activePlan) {
          const s = calculatePlannerStats({
            plan: activePlan,
            subjects: subjectsWithTopics,
            sessions,
          });
          setStats(s);
        } else {
          setStats({
            plan: activePlan,
            daysUntilExam: 0,
            totalAvailableHours: 0,
            totalHoursStudied: sessions.reduce((acc, s) => acc + s.durationMinutes / 60, 0),
            overallProgress: 0,
            subjectStats: subjectsWithTopics.map(s => ({
              subject: s,
              topics: s.topics,
              progressPercent: 0,
              hoursStudied: 0,
              recommendedHours: 0,
              remainingHours: 0,
              hoursPerDay: 0,
              isOnTrack: true,
            })),
          } as unknown as PlannerStats);
        }

        setStreak(calcStreak(sessions));
        setTodayStudiedHours(calcTodayHours(sessions));
        const dow = getDayOfWeek(new Date()) as keyof typeof activePlan.dailyGoalHours;
        setTodayGoalHours(activePlan.dailyGoalHours?.[dow] ?? 0);

        // Additional fetches
        const logs = await getQuestionLogs(user.uid);
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayLogs = logs.filter(l => l.date === todayStr);
        const qTotal = todayLogs.reduce((acc, l) => acc + l.total, 0);
        const qCorrect = todayLogs.reduce((acc, l) => acc + l.correct, 0);
        setTodayQuestions({ total: qTotal, correct: qCorrect });

        const cards = await getReviewCards(user.uid);
        const pending = cards.filter(c => c.nextReview <= todayStr).length;
        setPendingReviews(pending);

      } finally {
        setLoading(false);
      }
    })();
  }, [user, profile, selectedPlanId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded-lg w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-48 bg-muted rounded-2xl" />
          <div className="col-span-2 h-48 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  const totalTopics = stats?.subjectStats.reduce((a, s) => a + s.topics.length, 0) ?? 0;
  const completedTopics = stats?.subjectStats.reduce((a, s) => a + s.topics.filter(t => t.progress.video.status === 'completed').length, 0) ?? 0; // rough estimation
  const pendingTopics = totalTopics - completedTopics;
  const atRiskSubjects = stats?.subjectStats.filter(s => !s.isOnTrack) ?? [];

  const dailyQuestionsGoal = profile?.dailyGoalQuestions || 50;
  const questionsAccuracy = todayQuestions.total > 0 ? Math.round((todayQuestions.correct / todayQuestions.total) * 100) : 0;
  const questionsProgress = (todayQuestions.total / dailyQuestionsGoal) * 100;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Olá, {profile?.displayName?.split(' ')[0] ?? 'Estudante'} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Setup banner if no exam date */}
      {!stats?.plan?.examDate && (
        <div className="glass border border-primary/30 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Configure seu concurso</p>
            <p className="text-sm text-muted-foreground">Adicione a data da prova e suas matérias para ativar o planejamento adaptativo.</p>
          </div>
          <Link to="/settings" className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-border bg-transparent hover:bg-secondary transition-colors">
            Configurar
          </Link>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<HelpCircle className="w-5 h-5 text-purple-400" />}
          label="Questões Hoje"
          value={todayQuestions.total}
          sub={`${questionsAccuracy}% de acerto`}
          color="primary"
          progress={questionsProgress}
        />
        <Link to="/reviews">
          <StatCard
            icon={<RotateCcw className="w-5 h-5 text-red-400" />}
            label="Revisões Pendentes"
            value={pendingReviews}
            sub="cartões para hoje"
            color="amber"
          />
        </Link>
        <StatCard
          icon={<Flame className="w-5 h-5 text-amber-500" />}
          label="Sequência"
          value={`${streak} dias`}
          sub="dias seguidos estudando"
          color="amber"
        />
        <StatCard
          icon={<Target className="w-5 h-5 text-amber-400" />}
          label="Meta de Horas"
          value={`${todayStudiedHours.toFixed(1)}h`}
          sub={`de ${todayGoalHours}h planejadas`}
          color="amber"
          progress={todayGoalHours ? (todayStudiedHours / todayGoalHours) * 100 : 0}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
          label="Progresso Geral"
          value={`${stats?.overallProgress ?? 0}%`}
          sub="ponderado por peso"
          color="primary"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          label="Tópicos Concluídos"
          value={completedTopics}
          sub={`de ${totalTopics} total`}
          color="emerald"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-blue-400" />}
          label="Horas Estudadas"
          value={formatDuration(Math.round((stats?.totalHoursStudied ?? 0) * 60))}
          sub="total acumulado"
          color="blue"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <Countdown examDate={stats?.plan?.examDate} examName={stats?.plan?.examName} />

          {/* Overall progress */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Progresso Geral</p>
              <span className="text-lg font-bold gradient-text">{stats?.overallProgress ?? 0}%</span>
            </div>
            <Progress value={stats?.overallProgress ?? 0} className="h-3" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{completedTopics} concluídos</span>
              <span>{pendingTopics} pendentes</span>
            </div>
          </div>

          {/* At-risk subjects */}
          {atRiskSubjects.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Matérias em risco</p>
              </div>
              <div className="space-y-2">
                {atRiskSubjects.slice(0, 3).map(s => (
                  <div key={s.subject.id} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.subject.color }} />
                    <span className="text-sm text-foreground flex-1 truncate">{s.subject.name}</span>
                    <span className="text-xs text-amber-400">{s.progressPercent}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subject progress chart */}
          {stats && stats.subjectStats.length > 0 ? (
            <SubjectProgressChart stats={stats.subjectStats} />
          ) : (
            <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center text-center h-48 border border-dashed">
              <BookOpen className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">Nenhuma matéria cadastrada ainda</p>
              <Link to="/subjects" className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-border bg-transparent hover:bg-secondary transition-colors mt-3">
                Adicionar Matérias
              </Link>
            </div>
          )}


          {/* Heatmap */}
          <ActivityHeatmap sessions={[]} />

          {/* Subject breakdown */}
          {stats && stats.subjectStats.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4">Detalhes por Matéria</p>
              <div className="space-y-3">
                {stats.subjectStats.map(s => (
                  <div key={s.subject.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.subject.color }} />
                        <span className="text-sm font-medium text-foreground">{s.subject.name}</span>
                        <span className="text-xs text-muted-foreground">({s.subject.weight}%)</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{s.topics.filter(t => t.progress.video.status === 'completed').length}/{s.topics.length} tópicos</span>
                        <span className="font-semibold text-foreground">{s.progressPercent}%</span>
                      </div>
                    </div>
                    <Progress
                      value={s.progressPercent}
                      className="h-1.5"
                      style={{ '--progress-color': s.subject.color } as any}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, sub, color, progress
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  color: 'primary' | 'emerald' | 'blue' | 'amber';
  progress?: number;
}) {
  const bgMap = {
    primary: 'bg-primary/10 border-primary/20',
    emerald: 'bg-emerald-500/10 border-emerald-500/20',
    blue: 'bg-blue-500/10 border-blue-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20',
  };

  return (
    <div className={`glass rounded-2xl p-5 border card-hover ${bgMap[color]} h-full block`}>
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-lg bg-background/60">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>
      {progress !== undefined && (
        <div className="mt-3">
          <Progress value={Math.min(100, progress)} className="h-1" />
        </div>
      )}
    </div>
  );
}
