import { useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePlanContext } from '@/contexts/PlanContext';
import { getStudyPlans, getSubjects, getTopics, getSessions } from '@/lib/firestore';
import { calculatePlannerStats } from '@/lib/plannerEngine';
import { formatDuration } from '@/lib/helpers';
import type { PlannerStats, StudyPlan } from '@/types';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import {
  Target, TrendingUp, Clock, AlertTriangle,
  CheckCircle2, Zap, Calendar
} from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

export default function PlannerPage() {
  const { user, profile, updateUserProfile } = useAuthContext();
  const { selectedPlanId: globalPlanId, selectPlan } = usePlanContext();
  const [stats, setStats] = useState<PlannerStats | null>(null);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadPlanner();
  }, [user, globalPlanId]);

  const loadPlanner = async (planIdOverride?: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const availablePlans = await getStudyPlans(user.uid);
      setPlans(availablePlans);

      let targetPlanId = planIdOverride || globalPlanId;
      if (!targetPlanId && availablePlans.length > 0) {
        targetPlanId = availablePlans[0].id;
        selectPlan(targetPlanId);
      }

      if (!targetPlanId) {
        setLoading(false);
        return;
      }

      const activePlan = availablePlans.find(p => p.id === targetPlanId) || availablePlans[0];
      setActivePlanId(activePlan.id);

      const [subjects, sessions] = await Promise.all([
        getSubjects(activePlan.id),
        getSessions(user.uid, activePlan.id),
      ]);

      if (!activePlan.examDate) {
        setStats(null);
        return;
      }

      const withTopics = await Promise.all(subjects.map(async s => ({
        ...s, topics: await getTopics(activePlan.id, s.id),
      })));

      const s = calculatePlannerStats({
        plan: activePlan,
        subjects: withTopics,
        sessions,
      });
      setStats(s);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = async (planId: string) => {
    if (!planId || planId === activePlanId) return;
    setActivePlanId(planId);
    selectPlan(planId);
    await loadPlanner(planId);
  };

  const activePlan = plans.find(plan => plan.id === activePlanId) ?? null;

  if (loading) {
    return <div className="animate-pulse space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-sm" />)}</div>;
  }

  const radarData = (stats?.subjectStats ?? []).map(s => ({
    subject: s.subject.name.length > 10 ? s.subject.name.slice(0, 10) + '…' : s.subject.name,
    progress: s.progressPercent,
    recommended: 100,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planejamento Adaptativo</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activePlan?.name ?? 'Planejamento selecionado'}
            {stats ? ` · ${stats.daysUntilExam} dias até a prova · ${stats.totalAvailableHours.toFixed(0)}h disponíveis` : ''}
          </p>
        </div>
        <Select
          value={activePlanId ?? undefined}
          onValueChange={(value) => value && handlePlanChange(value)}
        >
          <SelectTrigger className="min-w-56">
            <SelectValue placeholder="Selecione o planejamento" />
          </SelectTrigger>
          <SelectContent>
            {plans.map(plan => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!activePlan?.examDate && (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Calendar className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground text-center">Configure a data da prova nas Configurações para ativar o planejamento.</p>
          <Link to="/settings" className="inline-flex items-center gap-1.5 h-10 px-4 py-2 font-medium rounded-sm border border-border bg-transparent hover:bg-secondary transition-colors">Configurar</Link>
        </div>
      )}

      {!activePlan?.examDate || !stats ? null : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass rounded-sm p-5 border border-primary/20">
              <Target className="w-5 h-5 text-primary mb-2" />
              <p className="text-2xl font-bold">{stats.daysUntilExam}</p>
              <p className="text-xs text-muted-foreground">dias restantes</p>
            </div>
            <div className="glass rounded-sm p-5 border border-blue-500/20">
              <Clock className="w-5 h-5 text-blue-400 mb-2" />
              <p className="text-2xl font-bold">{stats.totalAvailableHours.toFixed(0)}h</p>
              <p className="text-xs text-muted-foreground">horas disponíveis</p>
            </div>
            <div className="glass rounded-sm p-5 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2" />
              <p className="text-2xl font-bold">{formatDuration(Math.round(stats.totalHoursStudied * 60))}</p>
              <p className="text-xs text-muted-foreground">já estudados</p>
            </div>
            <div className="glass rounded-sm p-5 border border-amber-500/20">
              <TrendingUp className="w-5 h-5 text-amber-400 mb-2" />
              <p className="text-2xl font-bold">{stats.overallProgress}%</p>
              <p className="text-xs text-muted-foreground">progresso geral</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-sm p-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4">Radar de Progresso</p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Radar name="Progresso" dataKey="progress" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass rounded-sm p-6 space-y-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Recomendação por Matéria</p>
              {stats.subjectStats.map(s => (
                <div key={s.subject.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.subject.color }} />
                      <span className="text-sm font-medium">{s.subject.name}</span>
                      {!s.isOnTrack && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {s.hoursStudied.toFixed(1)}h / {s.recommendedHours.toFixed(1)}h
                    </span>
                  </div>
                  <Progress value={Math.min(100, (s.hoursStudied / s.recommendedHours) * 100)} className="h-1.5" />
                  {s.remainingHours > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Precisa de ~<strong className={cn(s.hoursPerDay > 3 ? 'text-amber-400' : 'text-foreground')}>
                        {s.hoursPerDay.toFixed(1)}h/dia
                      </strong> para concluir no prazo
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {stats.subjectStats.some(s => !s.isOnTrack) && (
            <div className="glass rounded-sm p-6 border border-amber-500/30">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-foreground">Matérias que precisam de atenção</h3>
              </div>
              <div className="space-y-3">
                {stats.subjectStats
                  .filter(s => !s.isOnTrack)
                  .map(s => (
                    <div key={s.subject.id} className="flex items-center justify-between bg-amber-500/10 rounded-sm px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.subject.color }} />
                        <span className="text-sm font-medium">{s.subject.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-amber-400 font-medium">{s.hoursPerDay.toFixed(1)}h/dia necessárias</span>
                        <Link to="/sessions" className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-sm border border-border bg-transparent hover:bg-secondary transition-colors">
                          <Zap className="w-3.5 h-3.5" /> Estudar
                        </Link>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
