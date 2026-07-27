import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, ListChecks, Pencil, Plus, RotateCcw, Target, Trash2 } from 'lucide-react';
import { Pie, PieChart as RechartsPieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePlanContext } from '@/contexts/PlanContext';
import { createStudyCycle, deleteStudyCycle, getSessions, getStudyCycles, getStudyPlans, getSubjects, getTopics, updateStudyCycle } from '@/lib/firestore';
import type { StudyCycle, StudyCycleItem, StudyPlan, StudySession, Subject, Topic } from '@/types';
import { formatDuration } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type SubjectTopics = Subject & { topics: Topic[] };

const statusLabel = (cycle: StudyCycle) => cycle.status === 'active' ? 'Em andamento' : cycle.status === 'planned' ? 'Na fila' : cycle.status === 'completed' ? 'Concluído' : 'Arquivado';

export default function StudyCyclePage() {
  const { user } = useAuthContext();
  const { selectedPlanId: globalPlanId, selectPlan } = usePlanContext();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [planId, setPlanId] = useState('');
  const [subjects, setSubjects] = useState<SubjectTopics[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [cycles, setCycles] = useState<StudyCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [cycleName, setCycleName] = useState('Ciclo atual');
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [topicMinutes, setTopicMinutes] = useState<Record<string, string>>({});

  const load = useCallback(async (requestedPlanId?: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const availablePlans = await getStudyPlans(user.uid);
      setPlans(availablePlans);
      const target = requestedPlanId || (globalPlanId && availablePlans.some(p => p.id === globalPlanId) ? globalPlanId : availablePlans[0]?.id);
      if (!target) { setPlanId(''); setSubjects([]); return; }
      setPlanId(target);
      selectPlan(target);
      const [rawSubjects, planSessions, planCycles] = await Promise.all([
        getSubjects(target), getSessions(user.uid, target), getStudyCycles(user.uid, target),
      ]);
      const withTopics = await Promise.all(rawSubjects.map(async subject => ({ ...subject, topics: await getTopics(target, subject.id) })));
      setSubjects(withTopics);
      setSessions(planSessions);
      setCycles(planCycles);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar o ciclo de estudos');
    } finally { setLoading(false); }
  }, [user, globalPlanId, selectPlan]);

  useEffect(() => { load(); }, [load]);

  const activeCycle = cycles.find(cycle => cycle.status === 'active') ?? null;
  const nextCycle = cycles.find(cycle => cycle.status === 'planned') ?? null;
  const studiedByItem = useMemo(() => {
    const result = new Map<string, number>();
    if (!activeCycle) return result;
    activeCycle.items.forEach(item => result.set(item.id, 0));
    const relevantSessions = sessions.filter(session =>
      session.cycleId === activeCycle.id ||
      (!session.cycleId && new Date(session.startedAt) >= new Date(activeCycle.createdAt))
    );
    for (const session of relevantSessions) {
      const exactItem = activeCycle.items.find(item => item.topicId === session.topicId);
      const subjectItems = activeCycle.items.filter(item => item.subjectId === session.subjectId);
      const targetItem = exactItem
        ?? subjectItems.find(item => (result.get(item.id) ?? 0) < item.plannedMinutes)
        ?? subjectItems[0];
      if (targetItem) result.set(targetItem.id, (result.get(targetItem.id) ?? 0) + session.durationMinutes);
    }
    return result;
  }, [activeCycle, sessions]);

  const totalPlanned = activeCycle?.items.reduce((total, item) => total + item.plannedMinutes, 0) ?? 0;
  const totalStudied = [...studiedByItem.values()].reduce((total, value) => total + value, 0);
  const completedItems = activeCycle?.items.filter(item => (studiedByItem.get(item.id) ?? 0) >= item.plannedMinutes).length ?? 0;
  const chartData = activeCycle?.items.map(item => ({ name: item.subjectName, value: item.plannedMinutes, color: item.subjectColor })) ?? [];
  const actualChartData = activeCycle?.items.map(item => ({
    name: item.subjectName,
    value: studiedByItem.get(item.id) ?? 0,
    color: item.subjectColor,
  })) ?? [];

  const openCycleDialog = () => {
    const nextNumber = cycles.length === 0 ? 1 : Math.max(...cycles.map(cycle => cycle.cycleNumber ?? 1)) + 1;
    setCycleName(`Ciclo ${nextNumber}`);
    setSelectedTopicIds(new Set());
    setTopicMinutes({});
    setDialogMode('create');
    setDialogOpen(true);
  };

  const openEditDialog = () => {
    if (!activeCycle) return;
    setCycleName(activeCycle.name);
    setSelectedTopicIds(new Set(activeCycle.items.map(item => item.topicId)));
    setTopicMinutes(Object.fromEntries(activeCycle.items.map(item => [item.topicId, String(item.plannedMinutes)])));
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const toggleTopic = (topicId: string) => {
    setSelectedTopicIds(current => {
      const next = new Set(current);
      if (next.has(topicId)) next.delete(topicId); else next.add(topicId);
      return next;
    });
  };

  const toggleSubject = (subject: SubjectTopics) => {
    const ids = subject.topics.map(topic => topic.id);
    const allSelected = ids.length > 0 && ids.every(id => selectedTopicIds.has(id));
    setSelectedTopicIds(current => {
      const next = new Set(current);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const buildItems = (): StudyCycleItem[] => subjects
    .flatMap(subject => subject.topics.map(topic => ({ subject, topic })))
    .filter(({ topic }) => selectedTopicIds.has(topic.id))
    .map(({ subject, topic }) => ({
      id: `${subject.id}:${topic.id}`,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectColor: subject.color,
      topicId: topic.id,
      topicName: topic.name,
      plannedMinutes: Math.max(5, Number(topicMinutes[topic.id]) || 60),
    }));

  const createCycle = async () => {
    if (!user || !planId) return;
    const items = buildItems();
    if (items.length === 0) { toast.info('Selecione pelo menos um tópico para o ciclo.'); return; }
    try {
      const shouldReplaceEmptyCycle = activeCycle && totalStudied === 0;
      if (shouldReplaceEmptyCycle) await updateStudyCycle(activeCycle.id, { status: 'archived' });
      const cycleNumber = cycles.length === 0 ? 1 : Math.max(...cycles.map(cycle => cycle.cycleNumber ?? 1)) + 1;
      const status = activeCycle && !shouldReplaceEmptyCycle ? 'planned' : 'active';
      const id = await createStudyCycle({
        userId: user.uid, planId, name: cycleName.trim() || `Ciclo ${cycleNumber}`, status, cycleNumber, items,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      if (status === 'active') localStorage.setItem(`activeCycleId:${planId}`, id);
      setDialogOpen(false);
      toast.success(status === 'active' ? `${items.length} sessões planejadas para este ciclo.` : `Ciclo ${cycleNumber} adicionado à fila.`);
      await load(planId);
    } catch (error) { console.error(error); toast.error('Não foi possível criar o ciclo'); }
  };

  const saveCycle = async () => {
    if (dialogMode === 'create') return createCycle();
    if (!activeCycle) return;
    const items = buildItems();
    if (items.length === 0) { toast.info('Selecione pelo menos um tópico para o ciclo.'); return; }
    try {
      await updateStudyCycle(activeCycle.id, { name: cycleName.trim() || activeCycle.name, items });
      setDialogOpen(false);
      toast.success('Ciclo atualizado.');
      await load(planId);
    } catch (error) { console.error(error); toast.error('Não foi possível atualizar o ciclo'); }
  };

  const removeCycle = async () => {
    if (!activeCycle || !window.confirm(`Excluir ${activeCycle.name}? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteStudyCycle(activeCycle.id);
      const next = cycles.find(cycle => cycle.status === 'planned');
      if (next) {
        await updateStudyCycle(next.id, { status: 'active' });
        localStorage.setItem(`activeCycleId:${planId}`, next.id);
      } else localStorage.removeItem(`activeCycleId:${planId}`);
      toast.success('Ciclo excluído.');
      await load(planId);
    } catch (error) { console.error(error); toast.error('Não foi possível excluir o ciclo'); }
  };

  const restartCycle = async () => {
    if (!activeCycle) return;
    try {
      await updateStudyCycle(activeCycle.id, { status: 'completed' });
      const nextCycle = cycles.find(cycle => cycle.status === 'planned');
      if (nextCycle) {
        await updateStudyCycle(nextCycle.id, { status: 'active' });
        localStorage.setItem(`activeCycleId:${planId}`, nextCycle.id);
        toast.success(`Ciclo ${nextCycle.cycleNumber ?? ''} iniciado.`);
      } else {
        localStorage.removeItem(`activeCycleId:${planId}`);
        toast.success('Ciclo concluído. Configure o próximo sprint quando quiser.');
      }
      await load(planId);
    } catch (error) { console.error(error); toast.error('Não foi possível encerrar o ciclo'); }
  };

  if (loading) return <div className="space-y-4 animate-pulse"><div className="h-12 rounded-xl bg-muted" /><div className="h-96 rounded-2xl bg-muted" /></div>;

  return <div className="space-y-6 animate-fade-in">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-primary text-sm font-semibold">Planejamento por tópicos</p>
        <h1 className="text-2xl font-bold text-foreground">Ciclo de estudos</h1>
        <p className="text-sm text-muted-foreground mt-1">Monte cada sprint escolhendo matérias, tópicos e duração.</p>
      </div>
      <div className="flex gap-3">
        <Select value={planId || undefined} onValueChange={value => { if (value) { selectPlan(value); load(value); } }}>
          <SelectTrigger className="min-w-48"><SelectValue placeholder="Planejamento" /></SelectTrigger>
          <SelectContent>{plans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={openCycleDialog}><Plus className="w-4 h-4" /> {activeCycle ? 'Novo ciclo' : 'Criar ciclo'}</Button>
      </div>
    </div>

    {!activeCycle ? <div className="glass rounded-2xl p-10 text-center border border-primary/15">
      <Target className="w-10 h-10 text-primary mx-auto mb-3" />
      <h2 className="text-lg font-semibold">Seu ciclo ainda não foi criado</h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto mt-2">Selecione exatamente as matérias e os tópicos que quer estudar neste sprint, definindo o tempo de cada sessão.</p>
      <Button className="mt-5" onClick={openCycleDialog}><Plus className="w-4 h-4" /> Criar primeiro ciclo</Button>
    </div> : <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Metric icon={ListChecks} label="Sessões concluídas" value={`${completedItems}/${activeCycle.items.length}`} />
        <Metric icon={Clock3} label="Progresso de horas" value={`${formatDuration(totalStudied)} / ${formatDuration(totalPlanned)}`} />
        <Metric icon={CheckCircle2} label={`Ciclo ${activeCycle.cycleNumber ?? 1}`} value={statusLabel(activeCycle)} />
      </div>
      {nextCycle && <p className="text-sm text-muted-foreground">Próximo sprint na fila: <strong className="text-foreground">Ciclo {nextCycle.cycleNumber ?? ''} — {nextCycle.name}</strong> ({nextCycle.items.length} tópicos).</p>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="min-w-0 glass rounded-2xl p-5 border border-border/60 lg:col-span-3">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold">Sequência dos estudos</h2>
              <p className="text-xs text-muted-foreground mt-1">Matéria e tópico de cada sessão planejada.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={openEditDialog}><Pencil className="w-3.5 h-3.5" /> Editar</Button>
              <Button variant="outline" size="sm" onClick={restartCycle}><RotateCcw className="w-3.5 h-3.5" /> Encerrar</Button>
              <Button variant="outline" size="icon" onClick={removeCycle} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Excluir ciclo"><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
          <div className="max-h-[360px] overflow-auto rounded-lg border border-border/70">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-12 px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Matéria</th>
                  <th className="px-3 py-2.5 font-medium">Tópico</th>
                  <th className="px-3 py-2.5 text-right font-medium">Planejado</th>
                  <th className="px-3 py-2.5 text-right font-medium">Realizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {activeCycle.items.map((item, index) => {
                  const actual = studiedByItem.get(item.id) ?? 0;
                  const done = actual >= item.plannedMinutes;
                  return <tr key={item.id} className="bg-background/30 hover:bg-muted/40">
                    <td className="px-3 py-2"><span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold" style={{ backgroundColor: `${item.subjectColor}26`, color: item.subjectColor }}>{index + 1}</span></td>
                    <td className="max-w-[180px] px-3 py-2 font-medium truncate" title={item.subjectName}>{item.subjectName}</td>
                    <td className="max-w-[300px] px-3 py-2 text-muted-foreground truncate" title={item.topicName}>{item.topicName}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">{formatDuration(item.plannedMinutes)}</td>
                    <td className={done ? 'px-3 py-2 text-right whitespace-nowrap font-medium text-emerald-500' : 'px-3 py-2 text-right whitespace-nowrap text-muted-foreground'}>{formatDuration(actual)}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="min-w-0 glass rounded-2xl p-5 border border-border/60 flex flex-col lg:col-span-2">
          <div><h2 className="font-semibold">Previsão de horas</h2><p className="text-xs text-muted-foreground mt-1">Distribuição planejada por matéria.</p></div>
          <div className="relative h-[260px] shrink-0"><ResponsiveContainer width="100%" height="100%"><RechartsPieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="82%" paddingAngle={2}>{chartData.map((item, index) => <Cell key={`${item.name}-${index}`} fill={item.color} fillOpacity={0.25} />)}</Pie><Pie data={actualChartData} dataKey="value" nameKey="name" innerRadius="43%" outerRadius="62%" paddingAngle={2}>{actualChartData.map((item, index) => <Cell key={`${item.name}-${index}`} fill={item.color} />)}</Pie><Tooltip formatter={value => formatDuration(Number(value ?? 0))} /></RechartsPieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-2xl font-bold">{formatDuration(totalStudied)}</span><span className="text-xs text-muted-foreground">de {formatDuration(totalPlanned)}</span></div></div>
          <div className="max-h-[100px] space-y-2 overflow-y-auto pr-1">{[...new Map(chartData.map(item => [item.name, item])).values()].map(item => <div key={item.name} className="flex justify-between gap-3 text-xs"><span className="min-w-0 truncate flex items-center gap-2"><i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />{item.name}</span><span className="text-muted-foreground whitespace-nowrap">{formatDuration(chartData.filter(data => data.name === item.name).reduce((sum, data) => sum + data.value, 0))}</span></div>)}</div>
        </section>
      </div>
    </>}

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{dialogMode === 'edit' ? 'Editar sprint de estudos' : 'Configurar sprint de estudos'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">Escolha apenas o que será estudado neste ciclo. O próximo ciclo ficará na fila até você encerrar este.</p>
          <div className="space-y-2">
            <Label htmlFor="cycle-name">Nome do ciclo</Label>
            <Input id="cycle-name" value={cycleName} onChange={event => setCycleName(event.target.value)} />
          </div>
          <div className="max-h-[48vh] overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {subjects.map(subject => {
              const topicIds = subject.topics.map(topic => topic.id);
              const allSelected = topicIds.length > 0 && topicIds.every(id => selectedTopicIds.has(id));
              const selectedCount = topicIds.filter(id => selectedTopicIds.has(id)).length;
              return <div key={subject.id} className="p-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={allSelected} onChange={() => toggleSubject(subject)} className="h-4 w-4 rounded border-border accent-primary" />
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} />
                  <span className="font-semibold text-sm">{subject.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{selectedCount}/{subject.topics.length} tópicos</span>
                </label>
                <div className="mt-3 space-y-2 pl-7">
                  {subject.topics.map(topic => {
                    const checked = selectedTopicIds.has(topic.id);
                    return <div key={topic.id} className="grid grid-cols-[auto_minmax(0,1fr)_92px] items-center gap-3">
                      <input type="checkbox" checked={checked} onChange={() => toggleTopic(topic.id)} className="h-4 w-4 rounded border-border accent-primary" aria-label={`Selecionar ${topic.name}`} />
                      <span className="truncate text-sm text-muted-foreground" title={topic.name}>{topic.name}</span>
                      <div className="flex items-center gap-1">
                        <Input type="number" min="5" step="5" disabled={!checked} value={topicMinutes[topic.id] ?? '60'} onChange={event => setTopicMinutes(current => ({ ...current, [topic.id]: event.target.value }))} className="h-8 text-right text-sm" aria-label={`Minutos para ${topic.name}`} />
                        <span className="text-xs text-muted-foreground">min</span>
                      </div>
                    </div>;
                  })}
                </div>
              </div>;
            })}
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground"><strong className="text-foreground">{selectedTopicIds.size}</strong> tópicos · <strong className="text-foreground">{formatDuration(buildItems().reduce((total, item) => total + item.plannedMinutes, 0))}</strong></p>
            <Button onClick={saveCycle}>{dialogMode === 'edit' ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {dialogMode === 'edit' ? 'Salvar alterações' : activeCycle && totalStudied > 0 ? 'Adicionar à fila' : 'Criar ciclo'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="glass rounded-2xl p-5 border border-border/60"><Icon className="w-5 h-5 text-primary mb-2" /><p className="text-lg font-bold truncate">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}
