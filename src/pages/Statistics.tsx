import { useEffect, useMemo, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePlanContext } from '@/contexts/PlanContext';
import {
  getSessions, getQuestionLogs, getSubjects, getTopics, getStudyPlans,
} from '@/lib/firestore';
import { formatDuration } from '@/lib/helpers';
import { format, subDays, startOfDay, eachDayOfInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie,
} from 'recharts';
import {
  TrendingUp, Clock, Zap, Target, ChevronDown,
  BookOpen, AlertCircle,
} from 'lucide-react';
import type { StudySession, QuestionLog, Subject, Topic } from '@/types';

// ─── date range options ───────────────────────────────────────
type Range = '7d' | '30d' | '90d' | 'all';
const RANGE_LABELS: Record<Range, string> = {
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  all: 'Todo o período',
};

// ─── color palette ────────────────────────────────────────────
const PALETTE = [
  '#6366f1', '#14b8a6', '#f43f5e', '#f97316',
  '#8b5cf6', '#ec4899', '#eab308', '#22c55e',
  '#0ea5e9', '#3b82f6',
];

function getPct(correct: number, total: number) {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
}

// ─── custom tooltip ───────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function StatisticsPage() {
  const { user } = useAuthContext();
  const { selectedPlanId } = usePlanContext();
  const [range, setRange] = useState<Range>('30d');
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [loading, setLoading] = useState(true);

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [logs, setLogs] = useState<QuestionLog[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topicsMap, setTopicsMap] = useState<Record<string, Topic[]>>({});

  // ─── fetch data ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const plans = await getStudyPlans(user.uid);
        const planId = selectedPlanId ?? plans[0]?.id;
        const [s, l, subs] = await Promise.all([
          getSessions(user.uid, planId),
          getQuestionLogs(user.uid, planId),
          planId ? getSubjects(planId) : Promise.resolve([]),
        ]);
        setSessions(s);
        setLogs(l);
        setSubjects(subs);
        if (planId && subs.length) {
          const entries = await Promise.all(
            subs.map(async sub => [sub.id, await getTopics(planId, sub.id)] as [string, Topic[]])
          );
          setTopicsMap(Object.fromEntries(entries));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user, selectedPlanId]);

  // ─── filter by range ─────────────────────────────────────────
  const cutoff = useMemo(() => {
    if (range === 'all') return new Date(0);
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    return subDays(startOfDay(new Date()), days);
  }, [range]);

  const filteredSessions = useMemo(
    () => sessions.filter(s => new Date(s.startedAt) >= cutoff),
    [sessions, cutoff]
  );
  const filteredLogs = useMemo(
    () => logs.filter(l => new Date(l.createdAt) >= cutoff),
    [logs, cutoff]
  );

  // ─── top-level stats ─────────────────────────────────────────
  const totalMinutes = useMemo(
    () => filteredSessions.reduce((a, s) => a + s.durationMinutes, 0),
    [filteredSessions]
  );
  const totalQuestions = useMemo(
    () => filteredLogs.reduce((a, l) => a + l.total, 0),
    [filteredLogs]
  );
  const totalCorrect = useMemo(
    () => filteredLogs.reduce((a, l) => a + l.correct, 0),
    [filteredLogs]
  );
  const accuracy = getPct(totalCorrect, totalQuestions);

  // study days / consistency
  const studiedDays = useMemo(() => {
    const days = new Set(filteredSessions.map(s => s.startedAt.slice(0, 10)));
    return days.size;
  }, [filteredSessions]);

  const rangeDays = range === 'all'
    ? Math.max(1, Math.ceil((Date.now() - new Date(sessions[sessions.length - 1]?.startedAt ?? Date.now()).getTime()) / 86400000))
    : parseInt(range);
  const consistency = Math.round((studiedDays / Math.max(1, rangeDays)) * 100);

  // missed days
  const missedDays = useMemo(() => {
    if (range === 'all') return rangeDays - studiedDays;
    const days = eachDayOfInterval({ start: cutoff, end: new Date() });
    const studiedSet = new Set(filteredSessions.map(s => s.startedAt.slice(0, 10)));
    return days.filter(d => !studiedSet.has(format(d, 'yyyy-MM-dd'))).length;
  }, [filteredSessions, cutoff, range, rangeDays, studiedDays]);

  // total topics
  const allTopics = useMemo(() => Object.values(topicsMap).flat(), [topicsMap]);
  const completedTopics = useMemo(
    () => allTopics.filter(t => t.progress.video.status === 'completed').length,
    [allTopics]
  );
  const pendingTopics = allTopics.length - completedTopics;
  const topicsProgress = Math.round((completedTopics / Math.max(1, allTopics.length)) * 100);

  // ─── Evolução no Tempo (questões + acerto %) ─────────────────
  const evolutionData = useMemo(() => {
    const grouped: Record<string, { questions: number; correct: number }> = {};
    filteredLogs.forEach(l => {
      const k = l.date;
      if (!grouped[k]) grouped[k] = { questions: 0, correct: 0 };
      grouped[k].questions += l.total;
      grouped[k].correct += l.correct;
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
        Questões: v.questions,
        'Acerto %': getPct(v.correct, v.questions),
      }));
  }, [filteredLogs]);

  // ─── Horas de Estudo por dia ──────────────────────────────────
  const hoursData = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredSessions.forEach(s => {
      const k = s.startedAt.slice(0, 10);
      grouped[k] = (grouped[k] ?? 0) + s.durationMinutes;
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, mins]) => ({
        date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
        Horas: +(mins / 60).toFixed(2),
      }));
  }, [filteredSessions]);

  // ─── Disciplinas x Horas ─────────────────────────────────────
  const subjectHoursData = useMemo(() => {
    const map: Record<string, { name: string; color: string; mins: number }> = {};
    filteredSessions.forEach(s => {
      if (!map[s.subjectId]) {
        const sub = subjects.find(x => x.id === s.subjectId);
        map[s.subjectId] = { name: s.subjectName, color: sub?.color ?? PALETTE[0], mins: 0 };
      }
      map[s.subjectId].mins += s.durationMinutes;
    });
    return Object.values(map)
      .sort((a, b) => b.mins - a.mins)
      .map(v => ({ name: v.name, Horas: +(v.mins / 60).toFixed(1), color: v.color }));
  }, [filteredSessions, subjects]);

  // ─── Radar: disciplinas x horas ──────────────────────────────
  const radarData = useMemo(() =>
    subjectHoursData.slice(0, 8).map(v => ({
      subject: v.name.length > 12 ? v.name.slice(0, 12) + '…' : v.name,
      Horas: v.Horas,
    })),
    [subjectHoursData]
  );

  // ─── Disciplinas x Desempenho ─────────────────────────────────
  const subjectPerfData = useMemo(() => {
    const map: Record<string, { name: string; color: string; total: number; correct: number }> = {};
    filteredLogs.forEach(l => {
      if (!map[l.subjectId]) {
        const sub = subjects.find(x => x.id === l.subjectId);
        map[l.subjectId] = { name: l.subjectName, color: sub?.color ?? PALETTE[0], total: 0, correct: 0 };
      }
      map[l.subjectId].total += l.total;
      map[l.subjectId].correct += l.correct;
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .map(v => ({
        name: v.name.length > 14 ? v.name.slice(0, 14) + '…' : v.name,
        Questões: v.total,
        'Acerto %': getPct(v.correct, v.total),
        color: v.color,
      }));
  }, [filteredLogs, subjects]);

  // ─── Tópicos x Desempenho (table) ─────────────────────────────
  const topicsPerfData = useMemo(() => {
    const map: Record<string, { topicName: string; subjectName: string; total: number; correct: number }> = {};
    filteredLogs.forEach(l => {
      const k = l.topicId ?? `${l.subjectId}-general`;
      if (!map[k]) map[k] = { topicName: l.topicName ?? 'Geral', subjectName: l.subjectName, total: 0, correct: 0 };
      map[k].total += l.total;
      map[k].correct += l.correct;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredLogs]);

  // ─── Donut: desempenho geral ──────────────────────────────────
  const donutData = [
    { name: 'Corretas', value: totalCorrect, color: '#14b8a6' },
    { name: 'Erradas', value: totalQuestions - totalCorrect, color: '#f43f5e' },
  ];

  // ─── performance badge ─────────────────────────────────────────
  function PerfBadge({ pct }: { pct: number }) {
    const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
    return (
      <span className={`inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${color}`}>
        {pct}%
      </span>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded-lg w-40" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-2xl" />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-muted rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Estatísticas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral do seu desempenho</p>
        </div>

        {/* Range picker */}
        <div className="relative">
          <button
            onClick={() => setShowRangeMenu(v => !v)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border bg-card text-sm font-medium hover:bg-secondary transition-colors"
          >
            {RANGE_LABELS[range]}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          {showRangeMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-xl z-20 py-1">
              {(Object.keys(RANGE_LABELS) as Range[]).map(r => (
                <button
                  key={r}
                  onClick={() => { setRange(r); setShowRangeMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors ${r === range ? 'text-primary font-semibold' : 'text-foreground'}`}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Desempenho */}
        <div className="glass rounded-2xl p-5 border border-border/50 flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Desempenho</p>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    innerRadius="62%"
                    outerRadius="85%"
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={2}
                  >
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">{accuracy}%</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <p><span className="font-bold text-foreground">{totalQuestions}</span> questões</p>
              <p className="text-emerald-400 font-medium">{totalCorrect} corretas</p>
              <p className="text-rose-400 font-medium">{totalQuestions - totalCorrect} erradas</p>
            </div>
          </div>
        </div>

        {/* Tempo de Estudo */}
        <div className="glass rounded-2xl p-5 border border-border/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tempo de Estudo</p>
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground tracking-tight">
            {Math.floor(totalMinutes / 60)}h<span className="text-xl">{String(totalMinutes % 60).padStart(2, '0')}min</span>
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>{studiedDays} dias de estudo</p>
            <p>{studiedDays > 0 ? formatDuration(Math.round(totalMinutes / studiedDays)) : '—'} por dia (média)</p>
          </div>
        </div>

        {/* Constância */}
        <div className="glass rounded-2xl p-5 border border-border/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Constância</p>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-foreground">{consistency}%</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="text-emerald-400 font-medium">{studiedDays} dias estudados</p>
            <p className="text-rose-400">{missedDays} dias faltou</p>
          </div>
        </div>

        {/* Progresso */}
        <div className="glass rounded-2xl p-5 border border-border/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progresso no Edital</p>
            <Target className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-foreground">{topicsProgress}%</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="text-emerald-400 font-medium">{completedTopics} tópicos concluídos</p>
            <p>{pendingTopics} tópicos pendentes</p>
          </div>
          {/* mini progress bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-primary transition-all"
              style={{ width: `${topicsProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Evolução no Tempo ──────────────────────────────────── */}
      <div className="glass rounded-2xl p-6 border border-border/50">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Evolução no Tempo</p>
        </div>
        {evolutionData.length === 0 ? (
          <EmptyChart message="Nenhum log de questões no período" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={evolutionData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line yAxisId="left" type="monotone" dataKey="Questões" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="Acerto %" stroke="#14b8a6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Horas de Estudo ────────────────────────────────────── */}
      <div className="glass rounded-2xl p-6 border border-border/50">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Horas de Estudo</p>
        </div>
        {hoursData.length === 0 ? (
          <EmptyChart message="Nenhuma sessão de estudo no período" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hoursData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} unit="h" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Horas" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {hoursData.map((_, i) => (
                  <Cell key={i} fill={`hsl(${237 + i * 4} 84% 65%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Disciplinas x Horas + Radar ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horizontal bar */}
        <div className="glass rounded-2xl p-6 border border-border/50">
          <div className="flex items-center gap-2 mb-5">
            <BookOpen className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Disciplinas × Horas</p>
          </div>
          {subjectHoursData.length === 0 ? (
            <EmptyChart message="Sem dados de sessão no período" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, subjectHoursData.length * 44)}>
              <BarChart
                layout="vertical"
                data={subjectHoursData}
                margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} unit="h" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Horas" radius={[0, 6, 6, 0]} maxBarSize={20}>
                  {subjectHoursData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Radar */}
        <div className="glass rounded-2xl p-6 border border-border/50">
          <div className="flex items-center gap-2 mb-5">
            <Target className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Distribuição por Matéria</p>
          </div>
          {radarData.length === 0 ? (
            <EmptyChart message="Sem dados no período" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                <Radar name="Horas" dataKey="Horas" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Disciplinas x Desempenho ───────────────────────────── */}
      <div className="glass rounded-2xl p-6 border border-border/50">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Disciplinas × Desempenho</p>
        </div>
        {subjectPerfData.length === 0 ? (
          <EmptyChart message="Sem logs de questões no período" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={subjectPerfData} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar yAxisId="left" dataKey="Questões" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {subjectPerfData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
              <Bar yAxisId="right" dataKey="Acerto %" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={28} fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Tópicos x Desempenho (tabela) ─────────────────────── */}
      <div className="glass rounded-2xl border border-border/50 overflow-hidden">
        <div className="flex items-center gap-2 p-6 pb-4">
          <BookOpen className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tópicos × Desempenho</p>
        </div>

        {topicsPerfData.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyChart message="Nenhuma questão resolvida por tópico no período" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border bg-muted/30">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Disciplina</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tópico</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Questões</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Desempenho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topicsPerfData.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3 text-foreground font-medium">{row.subjectName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.topicName}</td>
                    <td className="px-4 py-3 text-right font-semibold">{row.total}</td>
                    <td className="px-6 py-3 text-right">
                      <PerfBadge pct={getPct(row.correct, row.total)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topicsPerfData.length > 20 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                +{topicsPerfData.length - 20} tópicos não exibidos
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
      <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
