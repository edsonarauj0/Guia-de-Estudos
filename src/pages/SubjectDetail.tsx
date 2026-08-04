import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePlanContext } from '@/contexts/PlanContext';
import {
  getSubjects,
  getTopics,
  getSessions,
  getQuestionLogs,
  getReviewCards,
} from '@/lib/firestore';
import type { Subject, Topic, StudySession, QuestionLog, ReviewCard } from '@/types';
import {
  formatDuration,
  getSubjectProgressPercent,
  getTopicProgressPercent,
  DIFFICULTY_LABELS,
} from '@/lib/helpers';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  HelpCircle,
  RotateCcw,
  TrendingUp,
  AlertCircle,
  Video,
  FileText,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Helpers ────────────────────────────────────────────────────
const STATUS_ICON = {
  not_started: <span className="w-2 h-2 rounded-full bg-muted-foreground/40 inline-block" />,
  in_progress: <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />,
  completed: <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />,
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
};

// ── Sub-components ─────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className={`glass rounded-sm p-5 border ${color} flex flex-col gap-2`}>
      <div className="p-2 rounded-sm bg-background/60 w-fit">{icon}</div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <div>
        <p className="text-xs font-medium text-foreground/80">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function MediaBadge({ type, status }: { type: string; status: string }) {
  const icons: Record<string, React.ReactNode> = {
    video: <Video className="w-3 h-3" />,
    pdf: <FileText className="w-3 h-3" />,
    questions: <HelpCircle className="w-3 h-3" />,
    revision: <RefreshCw className="w-3 h-3" />,
  };
  const labels: Record<string, string> = {
    video: 'Vídeo',
    pdf: 'PDF',
    questions: 'Questões',
    revision: 'Revisão',
  };

  const statusClass =
    status === 'completed'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
      : status === 'in_progress'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
      : 'border-border/50 bg-muted/30 text-muted-foreground';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass}`}
    >
      {icons[type]}
      {labels[type]}
    </span>
  );
}

function TopicRow({ topic }: { topic: Topic }) {
  const [expanded, setExpanded] = useState(false);
  const progress = getTopicProgressPercent(topic.progress);

  const difficultyClass: Record<string, string> = {
    easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    hard: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  return (
    <div className="rounded-sm border border-border/50 bg-background/40 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">{topic.name}</span>
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${difficultyClass[topic.difficulty]}`}
            >
              {DIFFICULTY_LABELS[topic.difficulty]}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Progress value={progress} className="h-1 max-w-[120px]" />
            <span className="text-[11px] text-muted-foreground">{progress}%</span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-border/40 pt-2">
          <div className="flex flex-wrap gap-2">
            {(['video', 'pdf', 'questions', 'revision'] as const).map((media) => (
              <div key={media} className="flex flex-col items-start gap-0.5">
                <MediaBadge type={media} status={topic.progress[media].status} />
                <span className="text-[9px] text-muted-foreground px-0.5">
                  {STATUS_LABEL[topic.progress[media].status]}
                </span>
              </div>
            ))}
          </div>
          {topic.notes && (
            <p className="text-xs text-muted-foreground mt-3 italic border-l-2 border-primary/30 pl-2">
              {topic.notes}
            </p>
          )}
          {topic.tags && topic.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {topic.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function SubjectDetailPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { selectedPlanId } = usePlanContext();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [questionLogs, setQuestionLogs] = useState<QuestionLog[]>([]);
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!user || !subjectId) return;
    (async () => {
      setLoading(true);
      try {
        // Resolve planId — fall back to first plan if context not set
        let planId = selectedPlanId;
        if (!planId) {
          const { getStudyPlans } = await import('@/lib/firestore');
          const plans = await getStudyPlans(user.uid);
          planId = plans[0]?.id ?? null;
        }
        if (!planId) { setLoading(false); return; }

        const [subs, allSessions, logs, cards] = await Promise.all([
          getSubjects(planId),
          getSessions(user.uid, planId),
          getQuestionLogs(user.uid, planId),
          getReviewCards(user.uid, planId),
        ]);

        const found = subs.find((s) => s.id === subjectId);
        if (!found) { navigate('/subjects'); return; }

        const subTopics = await getTopics(planId, subjectId);

        setSubject(found);
        setTopics(subTopics);
        setSessions(allSessions.filter((s) => s.subjectId === subjectId));
        setQuestionLogs(logs.filter((l) => l.subjectId === subjectId));
        setReviewCards(cards.filter((c) => c.subjectId === subjectId));
      } finally {
        setLoading(false);
      }
    })();
  }, [user, subjectId, selectedPlanId, navigate]);

  // ── Derived stats ──────────────────────────────────────────
  const stats = useMemo(() => {
    const totalTopics = topics.length;
    const completedTopics = topics.filter(
      (t) => t.progress.video.status === 'completed'
    ).length;
    const inProgressTopics = topics.filter((t) =>
      Object.values(t.progress).some((p) => (p as { status: string }).status === 'in_progress')
    ).length;

    const totalMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);

    const totalQuestions = questionLogs.reduce((acc, l) => acc + l.total, 0);
    const correctQuestions = questionLogs.reduce((acc, l) => acc + l.correct, 0);
    const accuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;

    const pendingReviews = reviewCards.filter((c) => c.nextReview <= todayStr).length;
    const overallProgress = getSubjectProgressPercent(topics);

    return {
      totalTopics,
      completedTopics,
      inProgressTopics,
      totalMinutes,
      totalQuestions,
      correctQuestions,
      accuracy,
      pendingReviews,
      overallProgress,
    };
  }, [topics, sessions, questionLogs, reviewCards, todayStr]);

  // ── Performance chart data (accuracy over time by day) ────
  const chartData = useMemo(() => {
    const byDay = new Map<string, { total: number; correct: number }>();
    for (const log of questionLogs) {
      const day = log.date;
      const existing = byDay.get(day) ?? { total: 0, correct: 0 };
      byDay.set(day, {
        total: existing.total + log.total,
        correct: existing.correct + log.correct,
      });
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([day, data]) => ({
        day: format(new Date(day + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
        acerto: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
        questoes: data.total,
      }));
  }, [questionLogs]);

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded-sm w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-sm" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded-sm" />
        <div className="h-64 bg-muted rounded-sm" />
      </div>
    );
  }

  if (!subject) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div>
        <Link
          to="/subjects"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para Matérias
        </Link>

        <div className="flex items-start gap-4">
          {/* color bar */}
          <div
            className="w-1.5 self-stretch rounded-full flex-shrink-0 mt-0.5"
            style={{ backgroundColor: subject.color }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{subject.name}</h1>
              <span
                className="rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                style={{
                  borderColor: `${subject.color}40`,
                  backgroundColor: `${subject.color}15`,
                  color: subject.color,
                }}
              >
                {subject.weight}% do edital
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Progress
                value={stats.overallProgress}
                className="h-2 max-w-xs"
                style={{ '--progress-color': subject.color } as React.CSSProperties}
              />
              <span className="text-sm text-muted-foreground">
                {stats.overallProgress}% concluído
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<BookOpen className="w-5 h-5 text-primary" />}
          label="Tópicos"
          value={stats.totalTopics}
          sub={`${stats.completedTopics} concluídos · ${stats.inProgressTopics} em andamento`}
          color="bg-primary/5 border-primary/15"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-sky-400" />}
          label="Horas estudadas"
          value={formatDuration(stats.totalMinutes)}
          sub={`${sessions.length} sessões registradas`}
          color="bg-sky-500/5 border-sky-500/15"
        />
        <StatCard
          icon={<HelpCircle className="w-5 h-5 text-purple-400" />}
          label="Questões"
          value={stats.totalQuestions}
          sub={`${stats.accuracy}% de acerto (${stats.correctQuestions} certas)`}
          color="bg-purple-500/5 border-purple-500/15"
        />
        <StatCard
          icon={<RotateCcw className="w-5 h-5 text-rose-400" />}
          label="Revisões pendentes"
          value={stats.pendingReviews}
          sub={`${reviewCards.length} cartões no total`}
          color="bg-rose-500/5 border-rose-500/15"
        />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Topics */}
        <div className="space-y-4">
          <div className="glass rounded-sm p-5 border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-foreground">Tópicos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats.totalTopics} tópicos nesta matéria
                </p>
              </div>
              <Layers className="w-4 h-4 text-muted-foreground" />
            </div>
            {topics.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum tópico cadastrado.
              </p>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {topics.map((t) => (
                  <TopicRow key={t.id} topic={t} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── Performance chart ── */}
          {chartData.length > 0 ? (
            <div className="glass rounded-sm p-5 border border-border/60">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-foreground">Desempenho em Questões</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Taxa de acerto nos últimos 30 dias
                  </p>
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const v = Number(value ?? 0);
                        return name === 'acerto' ? [`${v}%`, 'Acerto'] : [v, 'Questões'];
                      }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="acerto"
                      stroke={subject.color}
                      strokeWidth={2}
                      dot={{ fill: subject.color, r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="glass rounded-sm p-6 flex flex-col items-center justify-center text-center h-40 border border-dashed">
              <TrendingUp className="w-7 h-7 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum registro de questões ainda.
              </p>
              <Link
                to="/questions"
                className="mt-2 text-xs text-primary hover:underline"
              >
                Registrar questões →
              </Link>
            </div>
          )}

          {/* ── Question Logs ── */}
          <div className="glass rounded-sm p-5 border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-foreground">Histórico de Questões</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {questionLogs.length} registros
                </p>
              </div>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </div>
            {questionLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum registro de questões para esta matéria.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-sm border border-border/50">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card/90 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Data</th>
                      <th className="px-3 py-2.5 font-medium">Tópico</th>
                      <th className="px-3 py-2.5 text-right font-medium">Total</th>
                      <th className="px-3 py-2.5 text-right font-medium">Acerto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {questionLogs.slice(0, 20).map((log) => {
                      const acc = log.total > 0 ? Math.round((log.correct / log.total) * 100) : 0;
                      return (
                        <tr key={log.id} className="hover:bg-muted/30 bg-background/30">
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </td>
                          <td className="px-3 py-2 truncate max-w-[140px] text-foreground/80" title={log.topicName}>
                            {log.topicName ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{log.total}</td>
                          <td
                            className={`px-3 py-2 text-right font-semibold ${acc >= 70 ? 'text-emerald-500' : acc >= 50 ? 'text-amber-500' : 'text-red-500'}`}
                          >
                            {acc}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Review Cards ── */}
          <div className="glass rounded-sm p-5 border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-foreground">Cartões de Revisão</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats.pendingReviews} pendentes hoje · {reviewCards.length} no total
                </p>
              </div>
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
            </div>
            {reviewCards.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum cartão de revisão ainda. Adicione tópicos à fila de revisão.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {reviewCards.map((card) => {
                  const isPending = card.nextReview <= todayStr;
                  return (
                    <div
                      key={card.id}
                      className="flex items-center gap-3 rounded-sm border border-border/50 bg-background/30 px-3 py-2.5"
                    >
                      {isPending ? (
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{card.topicName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {isPending ? '⚠ Vence hoje ou atrasado' : `Próxima: ${format(new Date(card.nextReview + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-muted-foreground">Intervalo</p>
                        <p className="text-xs font-semibold text-foreground">{card.interval}d</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {reviewCards.length > 0 && (
              <Link
                to="/reviews"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                Ir para revisões →
              </Link>
            )}
          </div>

          {/* ── Study Sessions ── */}
          <div className="glass rounded-sm p-5 border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-foreground">Sessões de Estudo</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sessions.length} sessões · {formatDuration(stats.totalMinutes)} no total
                </p>
              </div>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma sessão de estudo registrada para esta matéria.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-sm border border-border/50">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card/90 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Data</th>
                      <th className="px-3 py-2.5 font-medium">Tópico</th>
                      <th className="px-3 py-2.5 font-medium">Tipo</th>
                      <th className="px-3 py-2.5 text-right font-medium">Duração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {sessions.slice(0, 20).map((session) => {
                      const typeLabels: Record<string, string> = {
                        video: 'Vídeo',
                        pdf: 'PDF',
                        questions: 'Questões',
                        revision: 'Revisão',
                        reading: 'Leitura',
                      };
                      return (
                        <tr key={session.id} className="hover:bg-muted/30 bg-background/30">
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {format(new Date(session.startedAt), 'dd/MM/yyyy', { locale: ptBR })}
                          </td>
                          <td
                            className="px-3 py-2 truncate max-w-[140px] text-foreground/80"
                            title={session.topicName}
                          >
                            {session.topicName ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {typeLabels[session.type] ?? session.type}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-foreground">
                            {formatDuration(session.durationMinutes)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
