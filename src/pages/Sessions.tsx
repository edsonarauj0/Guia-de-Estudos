import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthContext } from '@/contexts/AuthContext';
import { deleteSession, getSessions, getQuestionLogs, deleteQuestionLog, getReviewCards } from '@/lib/firestore';
import { usePlanContext } from '@/contexts/PlanContext';
import { formatDuration } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import type { SessionType, StudySession, QuestionLog } from '@/types';
import { Button } from '@/components/ui/button';
import EditSessionModal from '@/components/sessions/EditSessionModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SESSION_TYPES: Array<{
  value: SessionType | 'questions_log';
  label: string;
  icon: typeof Video;
  className: string;
}> = [
    { value: 'video', label: 'Videoaulas', icon: Video, className: 'text-sky-500' },
    { value: 'pdf', label: 'PDF / Livro', icon: FileText, className: 'text-emerald-500' },
    { value: 'questions', label: 'Sessão de Questões', icon: HelpCircle, className: 'text-amber-500' },
    { value: 'questions_log', label: 'Registro de Questões', icon: CheckCircle2, className: 'text-purple-500' },
    { value: 'revision', label: 'Revisões', icon: RotateCcw, className: 'text-rose-500' },
  ];

interface UnifiedActivity {
  id: string;
  date: string; // yyyy-MM-dd
  timestamp: string;
  subjectId: string;
  subjectName: string;
  subjectColor?: string;
  topicName?: string;
  type: string;
  durationMinutes: number;
  subtitle: string;
  isQuestionLog: boolean;
  questionStats?: { correct: number; total: number };
  originalSession?: StudySession;
  originalLog?: QuestionLog;
}

export default function SessionsPage() {
  const { user } = useAuthContext();
  const { selectedPlanId, selectedPlan } = usePlanContext();
  const [activities, setActivities] = useState<UnifiedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingAll, setDeletingAll] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | '7' | '30' | '90'>('all');
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !selectedPlanId) {
      setActivities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [fetchedSessions, fetchedLogs] = await Promise.all([
        getSessions(user.uid, selectedPlanId),
        getQuestionLogs(user.uid, selectedPlanId),
      ]);

      const mappedSessions: UnifiedActivity[] = fetchedSessions.map(s => ({
        id: s.id,
        date: s.startedAt.slice(0, 10),
        timestamp: s.startedAt,
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        topicName: s.topicName,
        type: s.type,
        durationMinutes: s.durationMinutes,
        subtitle: `${s.type === 'video' ? 'Videoaula' : s.type === 'pdf' ? 'PDF/Livro' : s.type === 'questions' ? 'Questões' : 'Revisão'} · ${s.subjectName}${s.videoTitle ? ` · ${s.videoTitle}` : ''}`,
        isQuestionLog: false,
        originalSession: s,
      }));

      const mappedLogs: UnifiedActivity[] = fetchedLogs.map(l => {
        const accuracy = l.total > 0 ? ((l.correct / l.total) * 100).toFixed(0) : '0';
        return {
          id: l.id,
          date: l.date,
          timestamp: l.createdAt || `${l.date}T12:00:00.000Z`,
          subjectId: l.subjectId,
          subjectName: l.subjectName,
          subjectColor: l.subjectColor,
          topicName: l.topicName,
          type: 'questions_log',
          durationMinutes: 0,
          subtitle: `Questões (${l.sessionType === 'exam' ? 'Simulado' : l.sessionType === 'review' ? 'Revisão' : 'Prática'}) · ${l.subjectName} · ${l.correct}/${l.total} (${accuracy}%)`,
          isQuestionLog: true,
          questionStats: { correct: l.correct, total: l.total },
          originalLog: l,
        };
      });

      const combined = [...mappedSessions, ...mappedLogs].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(combined);
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteItem = async (act: UnifiedActivity) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;
    try {
      if (act.isQuestionLog && act.originalLog) {
        await deleteQuestionLog(act.originalLog.id);
      } else if (act.originalSession) {
        await deleteSession(act.originalSession.id);
      }
      toast.success('Registro excluído com sucesso.');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir o registro.');
    }
  };

  const executeDeleteAll = async () => {
    if (!user || !selectedPlanId) return;
    setDeletingAll(true);
    try {
      const [fetchedSessions, fetchedLogs] = await Promise.all([
        getSessions(user.uid, selectedPlanId),
        getQuestionLogs(user.uid, selectedPlanId),
      ]);

      await Promise.all([
        ...fetchedSessions.map(s => deleteSession(s.id)),
        ...fetchedLogs.map(l => deleteQuestionLog(l.id)),
      ]);

      setActivities([]);
      toast.success('Histórico completo excluído com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir o histórico.');
    } finally {
      setDeletingAll(false);
      setConfirmDeleteOpen(false);
      loadData();
    }
  };

  const filteredActivities = useMemo(() => activities.filter(act => {
    if (typeFilter !== 'all' && act.type !== typeFilter) return false;
    if (periodFilter === 'all') return true;
    const since = new Date();
    since.setDate(since.getDate() - Number(periodFilter));
    return new Date(act.timestamp) >= since;
  }), [activities, typeFilter, periodFilter]);

  const groupedActivities = filteredActivities.reduce((groups, act) => {
    const date = act.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(act);
    return groups;
  }, {} as Record<string, UnifiedActivity[]>);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const totalMinutes = filteredActivities.reduce((total, act) => total + act.durationMinutes, 0);
  const todayMinutes = (groupedActivities[todayStr] ?? []).reduce(
    (total, act) => total + act.durationMinutes,
    0
  );
  const studiedSubjects = new Set(filteredActivities.map(act => act.subjectId)).size;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Histórico de estudos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registros de {selectedPlan?.name ?? 'seu planejamento'} agrupados por dia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodFilter} onValueChange={value => setPeriodFilter((value ?? 'all') as typeof periodFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Período">
                {(value: string) => {
                  const labels: Record<string, string> = {
                    all: 'Todo período',
                    '7': 'Últimos 7 dias',
                    '30': 'Últimos 30 dias',
                    '90': 'Últimos 90 dias',
                  }
                  return labels[value] ?? 'Período'
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo período</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={value => setTypeFilter(value ?? 'all')}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Categoria">
                {(value: string) =>
                  value === 'all'
                    ? 'Todas categorias'
                    : SESSION_TYPES.find(t => t.value === value)?.label ?? 'Categoria'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {SESSION_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={loadData} disabled={loading || deletingAll}>
            Atualizar
          </Button>

          {activities.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={loading || deletingAll}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Excluir histórico
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-sm p-5">
          <Clock className="mb-3 h-5 w-5 text-primary" />
          <p className="text-2xl font-bold">{formatDuration(todayMinutes)}</p>
          <p className="text-sm text-muted-foreground">estudados hoje</p>
        </div>
        <div className="glass rounded-sm p-5">
          <BarChart3 className="mb-3 h-5 w-5 text-emerald-500" />
          <p className="text-2xl font-bold">{formatDuration(totalMinutes)}</p>
          <p className="text-sm text-muted-foreground">tempo total no plano</p>
        </div>
        <div className="glass rounded-sm p-5">
          <BookOpen className="mb-3 h-5 w-5 text-amber-500" />
          <p className="text-2xl font-bold">{studiedSubjects}</p>
          <p className="text-sm text-muted-foreground">matérias estudadas</p>
        </div>
      </div>

      <div className="glass rounded-sm p-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Registros</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(item => (
              <div key={item} className="h-16 animate-pulse rounded-sm bg-muted" />
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-10 text-center">
            <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Nenhuma atividade registrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Suas sessões de estudo, revisões e registros de questões aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(groupedActivities).map(([date, dayActs]) => (
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
                  {dayActs.map(act => {
                    const typeConfig = SESSION_TYPES.find(item => item.value === act.type) ?? SESSION_TYPES[0];
                    const Icon = typeConfig.icon;

                    return (
                      <div
                        key={act.id}
                        className="flex items-center gap-3 rounded-sm bg-background/50 px-4 py-3 transition-colors hover:bg-muted/60"
                      >
                        <div className="rounded-sm border border-border bg-muted/50 p-2">
                          <Icon className={cn('h-4 w-4', typeConfig.className)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {act.topicName ?? act.subjectName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {act.subtitle}
                          </p>
                        </div>
                        <div className="shrink-0 text-right flex items-center gap-4">
                          <div>
                            {act.isQuestionLog ? (
                              <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                                {act.questionStats?.correct} / {act.questionStats?.total} acertos
                              </p>
                            ) : (
                              <p className="text-sm font-bold">{formatDuration(act.durationMinutes)}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(act.timestamp), 'HH:mm')}
                            </p>
                          </div>
                          
                          {/* Botões de Ação por Linha */}
                          <div className="flex items-center gap-1">
                            {act.originalSession && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => setEditingSession(act.originalSession!)}
                                title="Editar sessão"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteItem(act)}
                              title="Excluir registro"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      {/* Modal de Confirmação */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir todo o histórico?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tem certeza que deseja excluir <strong>todos os registros de estudo, questões e revisões</strong> deste planejamento? Esta ação é irreversível.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={deletingAll}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={executeDeleteAll} disabled={deletingAll}>
                {deletingAll ? 'Excluindo...' : 'Sim, excluir tudo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditSessionModal
        session={editingSession}
        open={editingSession !== null}
        onClose={() => setEditingSession(null)}
        onSaved={() => { setEditingSession(null); loadData(); }}
        onDeleted={() => { setEditingSession(null); loadData(); }}
      />
    </div>
  );
}