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
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthContext } from '@/contexts/AuthContext';
import { deleteSession, getSessions } from '@/lib/firestore';
import { usePlanContext } from '@/contexts/PlanContext';
import { formatDuration } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import type { SessionType, StudySession } from '@/types';
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
  const { selectedPlanId, selectedPlan } = usePlanContext();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingAll, setDeletingAll] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | SessionType>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | '7' | '30' | '90'>('all');
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const fetchedSessions = selectedPlanId ? await getSessions(user.uid, selectedPlanId) : [];
      setSessions(fetchedSessions);
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const executeDeleteAll = async () => {
    if (sessions.length === 0) return;
    setDeletingAll(true);
    try {
      await Promise.all(sessions.map(session => deleteSession(session.id)));
      setSessions([]);
      toast.success('Todos os registros foram excluídos com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir os registros.');
    } finally {
      setDeletingAll(false);
      setConfirmDeleteOpen(false);
    }
  };

  const filteredSessions = useMemo(() => sessions.filter(session => {
    if (typeFilter !== 'all' && session.type !== typeFilter) return false;
    if (periodFilter === 'all') return true;
    const since = new Date();
    since.setDate(since.getDate() - Number(periodFilter));
    return new Date(session.startedAt) >= since;
  }), [sessions, typeFilter, periodFilter]);

  const groupedSessions = filteredSessions.reduce((groups, session) => {
    const date = format(new Date(session.startedAt), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(session);
    return groups;
  }, {} as Record<string, StudySession[]>);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const totalMinutes = filteredSessions.reduce((total, session) => total + session.durationMinutes, 0);
  const todayMinutes = (groupedSessions[todayStr] ?? []).reduce(
    (total, session) => total + session.durationMinutes,
    0
  );
  const studiedSubjects = new Set(filteredSessions.map(session => session.subjectId)).size;

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

          <Select value={typeFilter} onValueChange={value => setTypeFilter((value ?? 'all') as typeof typeFilter)}>
            <SelectTrigger className="w-36">
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
          {sessions.length > 0 && (
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

      <div className="glass rounded-sm p-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tempo por tipo
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          {SESSION_TYPES.map(({ className, icon: Icon, label, value }) => {
            const minutesByType = filteredSessions
              .filter(session => session.type === value)
              .reduce((total, session) => total + session.durationMinutes, 0);

            return (
              <div key={value} className="rounded-sm border border-border bg-background/50 p-4">
                <Icon className={cn('mb-3 h-5 w-5', className)} />
                <p className="font-semibold">{formatDuration(minutesByType)}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            );
          })}
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
        ) : filteredSessions.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-10 text-center">
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
                      <div
                        key={session.id}
                        onClick={() => setEditingSession(session)}
                        className="flex cursor-pointer items-center gap-3 rounded-sm bg-background/50 px-4 py-3 transition-colors hover:bg-muted/60"
                      >
                        <div className="rounded-sm border border-border bg-muted/50 p-2">
                          <Icon className={cn('h-4 w-4', type.className)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {session.topicName ?? session.subjectName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {type.label} · {session.subjectName}
                            {session.videoTitle ? ` · ${session.videoTitle}` : ''}
                            {session.videoStartedAt && session.videoEndedAt ? ` (${session.videoStartedAt}–${session.videoEndedAt})` : ''}
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

      {/* Modal de Confirmação do Shadcn */}
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
              Tem certeza que deseja excluir <strong>TODOS os {sessions.length} registros de estudo</strong> deste planejamento? Esta ação é irreversível e zerará seu progresso de horas acumuladas.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={deletingAll}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={executeDeleteAll} disabled={deletingAll}>
                {deletingAll ? 'Excluindo tudo...' : 'Sim, excluir tudo'}
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