import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, ListChecks, Pencil, Plus, RotateCcw, Target, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Pie, PieChart as RechartsPieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePlanContext } from '@/contexts/PlanContext';
import { createStudyCycle, deleteStudyCycle, getSessions, getStudyCycles, getStudyPlans, getSubjects, getTopics, updateStudyCycle } from '@/lib/firestore';
import { buildCalendarPlan } from '@/lib/calendarEngine';
import type { StudyCycle, StudyCycleItem, StudyPlan, StudySession, Subject, Topic } from '@/types';
import type { CycleSummary } from '@/lib/calendarEngine';
import { formatDuration } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';

type SubjectTopics = Subject & { topics: Topic[] };

const statusLabel = (cycle: { status?: string }) => cycle.status === 'active' ? 'Em andamento' : cycle.status === 'planned' ? 'Na fila' : 'Projetado';

export default function StudyCyclePage() {
  const { user } = useAuthContext();
  const { selectedPlanId: globalPlanId, selectPlan } = usePlanContext();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [planId, setPlanId] = useState('');
  const [subjects, setSubjects] = useState<SubjectTopics[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [cycles, setCycles] = useState<StudyCycle[]>([]);
  const [projectedCycles, setProjectedCycles] = useState<CycleSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // ID ou Número do ciclo selecionado no Select do topo
  const [selectedCycleKey, setSelectedCycleKey] = useState<string>('1');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [cycleName, setCycleName] = useState('');
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [topicMinutes, setTopicMinutes] = useState<Record<string, string>>({});
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

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
        getSubjects(target),
        getSessions(user.uid, target),
        getStudyCycles(user.uid, target),
      ]);

      const withTopics = await Promise.all(rawSubjects.map(async subject => ({ ...subject, topics: await getTopics(target, subject.id) })));
      setSubjects(withTopics);
      setSessions(planSessions);
      setCycles(planCycles);

      const currentPlan = availablePlans.find(p => p.id === target);
      if (currentPlan) {
        const calendarResult = buildCalendarPlan({
          plan: currentPlan,
          cycles: planCycles,
          subjectsWithTopics: withTopics,
          sessions: planSessions,
        });
        setProjectedCycles(calendarResult.cycleSummaries);
        if (calendarResult.cycleSummaries.length > 0 && !selectedCycleKey) {
          setSelectedCycleKey(String(calendarResult.cycleSummaries[0].cycleNumber));
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar o ciclo de estudos');
    } finally { setLoading(false); }
  }, [user, globalPlanId, selectPlan, selectedCycleKey]);

  useEffect(() => { load(); }, [load]);

  // Ciclo selecionado atualmente na lista gerada pela engine do calendário
  const currentSummary = projectedCycles.find(c => String(c.cycleNumber) === selectedCycleKey) ?? projectedCycles[0] ?? null;
  const activeDbCycle = cycles.find(c => c.status === 'active') ?? null;

  const studiedByItem = useMemo(() => {
    const result = new Map<string, number>();
    if (!currentSummary) return result;
    currentSummary.items.forEach(item => result.set(item.id, 0));
    const relevantSessions = sessions.filter(session =>
      (activeDbCycle && session.cycleId === activeDbCycle.id) ||
      (!session.cycleId && new Date(session.startedAt) >= new Date(activeDbCycle?.createdAt || 0))
    );
    for (const session of relevantSessions) {
      const exactItem = currentSummary.items.find(item => item.topicId === session.topicId);
      const subjectItems = currentSummary.items.filter(item => item.subjectId === session.subjectId);
      const targetItem = exactItem
        ?? subjectItems.find(item => (result.get(item.id) ?? 0) < item.plannedMinutes)
        ?? subjectItems[0];
      if (targetItem) result.set(targetItem.id, (result.get(targetItem.id) ?? 0) + session.durationMinutes);
    }
    return result;
  }, [currentSummary, sessions, activeDbCycle]);

  const totalPlanned = currentSummary?.totalMinutes ?? 0;
  const totalStudied = [...studiedByItem.values()].reduce((total, value) => total + value, 0);
  const completedItems = currentSummary?.items.filter(item => (studiedByItem.get(item.id) ?? 0) >= item.plannedMinutes).length ?? 0;

  const chartData = currentSummary?.items.map(item => ({ name: item.subjectName, value: item.plannedMinutes, color: item.subjectColor })) ?? [];
  const actualChartData = currentSummary?.items.map(item => ({
    name: item.subjectName,
    value: studiedByItem.get(item.id) ?? 0,
    color: item.subjectColor,
  })) ?? [];

  const openEditDialog = () => {
    if (!currentSummary) return;
    setCycleName(currentSummary.cycleName);
    setSelectedTopicIds(new Set(currentSummary.items.map(item => item.topicId).filter(Boolean) as string[]));
    setTopicMinutes(Object.fromEntries(currentSummary.items.map(item => [item.topicId, String(item.plannedMinutes)])));
    setExpandedSubjects({});
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

  const toggleExpandSubject = (subjectId: string) => {
    setExpandedSubjects(prev => ({ ...prev, [subjectId]: !prev[subjectId] }));
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

  const saveCycle = async () => {
    if (!user || !planId || !currentSummary) return;
    const items = buildItems();
    if (items.length === 0) { toast.info('Selecione pelo menos um tópico para o ciclo.'); return; }

    try {
      // Verifica se já existe um documento de ciclo no Firestore para este cycleNumber
      const existingCycleDoc = cycles.find(c => c.cycleNumber === currentSummary.cycleNumber);
      const now = new Date().toISOString();

      if (existingCycleDoc) {
        await updateStudyCycle(existingCycleDoc.id, {
          name: cycleName.trim() || currentSummary.cycleName,
          items,
          updatedAt: now,
        });
      } else {
        await createStudyCycle({
          userId: user.uid,
          planId,
          name: cycleName.trim() || currentSummary.cycleName,
          status: currentSummary.cycleNumber === 1 ? 'active' : 'planned',
          cycleNumber: currentSummary.cycleNumber,
          items,
          createdAt: now,
          updatedAt: now,
        });
      }

      setDialogOpen(false);
      toast.success('Ciclo ajustado com sucesso! O calendário foi recalculado.');
      await load(planId);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível salvar as alterações do ciclo');
    }
  };

  if (loading) return <div className="space-y-4 animate-pulse"><div className="h-12 rounded-sm bg-muted" /><div className="h-96 rounded-sm bg-muted" /></div>;

  return <div className="space-y-6 animate-fade-in">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-primary text-sm font-semibold">Planejamento por tópicos</p>
        <h1 className="text-2xl font-bold text-foreground">Ciclo de estudos</h1>
        <p className="text-sm text-muted-foreground mt-1">Selecione qualquer ciclo previsto pela engine para visualizar ou ajustar a sua composição.</p>
      </div>
      <div className="flex items-center gap-3">
        <Select value={selectedCycleKey} onValueChange={value => value && setSelectedCycleKey(value)}>
          <SelectTrigger className="h-2 w-full text-xs">
            <SelectValue placeholder="Selecione um plano">
              {projectedCycles.find(p => String(p.cycleNumber) === selectedCycleKey)?.cycleName ?? "Selecione um ciclo"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-40 overflow-y-auto">
            <SelectGroup>
              <SelectLabel>Ciclos</SelectLabel>
              {projectedCycles.map(cycle => (
                <SelectItem key={cycle.cycleNumber} value={String(cycle.cycleNumber)}>
                  {cycle.cycleName}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>

    {!currentSummary ? <div className="glass rounded-sm p-10 text-center border border-primary/15">
      <Target className="w-10 h-10 text-primary mx-auto mb-3" />
      <h2 className="text-lg font-semibold">Nenhuma previsão de ciclo encontrada</h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto mt-2">Cadastre matérias e tópicos para gerar os ciclos automaticamente.</p>
    </div> : <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Metric icon={ListChecks} label="Tópicos no ciclo" value={`${completedItems}/${currentSummary.items.length}`} />
        <Metric icon={Clock3} label="Duração total" value={formatDuration(totalPlanned)} />
        <Metric icon={CheckCircle2} label={currentSummary.cycleName} value={`Período: ${currentSummary.startDate ? format(parseISO(currentSummary.startDate), 'dd/MM') : '—'}`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="min-w-0 glass rounded-sm p-5 border border-border/60 lg:col-span-3">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold">Sequência dos estudos</h2>
              <p className="text-xs text-muted-foreground mt-1">Matéria e tópico planejados para este ciclo.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={openEditDialog}><Pencil className="w-3.5 h-3.5" /> Ajustar Ciclo</Button>
            </div>
          </div>
          <div className="max-h-[360px] overflow-auto rounded-sm border border-border/70">
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
                {currentSummary.items.map((item, index) => {
                  const actual = studiedByItem.get(item.id) ?? 0;
                  const done = actual >= item.plannedMinutes;
                  return <tr key={`${item.id}-${index}`} className="bg-background/30 hover:bg-muted/40">
                    <td className="px-3 py-2"><span className="flex h-6 w-6 items-center justify-center rounded-sm text-[11px] font-bold" style={{ backgroundColor: `${item.subjectColor}26`, color: item.subjectColor }}>{index + 1}</span></td>
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
        <section className="min-w-0 glass rounded-sm p-5 border border-border/60 flex flex-col lg:col-span-2">
          <div><h2 className="font-semibold">Previsão de horas</h2><p className="text-xs text-muted-foreground mt-1">Distribuição planejada por matéria.</p></div>
          <div className="relative h-[260px] shrink-0"><ResponsiveContainer width="100%" height="100%"><RechartsPieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="82%" paddingAngle={2}>{chartData.map((item, index) => <Cell key={`${item.name}-${index}`} fill={item.color} fillOpacity={0.25} />)}</Pie><Pie data={actualChartData} dataKey="value" nameKey="name" innerRadius="43%" outerRadius="62%" paddingAngle={2}>{actualChartData.map((item, index) => <Cell key={`${item.name}-${index}`} fill={item.color} />)}</Pie><Tooltip formatter={value => formatDuration(Number(value ?? 0))} /></RechartsPieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-2xl font-bold">{formatDuration(totalStudied)}</span><span className="text-xs text-muted-foreground">de {formatDuration(totalPlanned)}</span></div></div>
          <div className="max-h-[100px] space-y-2 overflow-y-auto pr-1">{[...new Map(chartData.map(item => [item.name, item])).values()].map(item => <div key={item.name} className="flex justify-between gap-3 text-xs"><span className="min-w-0 truncate flex items-center gap-2"><i className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />{item.name}</span><span className="text-muted-foreground whitespace-nowrap">{formatDuration(chartData.filter(data => data.name === item.name).reduce((sum, data) => sum + data.value, 0))}</span></div>)}</div>
        </section>
      </div>
    </>}

    {/* MODAL DE AJUSTE DO CICLO */}
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl flex flex-col">
        <DialogHeader>
          <DialogTitle>Ajustar {currentSummary?.cycleName || 'Ciclo'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2 flex-1 overflow-hidden flex flex-col">
          <p className="text-sm text-muted-foreground shrink-0">Altere os tópicos ou durações deste ciclo. O calendário se atualizará imediatamente.</p>
          <div className="space-y-2 shrink-0">
            <Label htmlFor="cycle-name">Nome do ciclo</Label>
            <Input id="cycle-name" value={cycleName} onChange={event => setCycleName(event.target.value)} />
          </div>

          <div className="max-h-[46vh] overflow-y-auto rounded-sm border border-border divide-y divide-border">
            {subjects.map(subject => {
              const topicIds = subject.topics.map(topic => topic.id);
              const allSelected = topicIds.length > 0 && topicIds.every(id => selectedTopicIds.has(id));
              const selectedCount = topicIds.filter(id => selectedTopicIds.has(id)).length;
              const isExpanded = !!expandedSubjects[subject.id];

              return (
                <div key={subject.id} className="bg-background/40">
                  <div className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => toggleExpandSubject(subject.id)}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => { e.stopPropagation(); toggleSubject(subject); }}
                        className="h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
                        aria-label={`Selecionar todos os tópicos de ${subject.name}`}
                      />
                      <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: subject.color }} />
                      <span className="font-semibold text-sm truncate">{subject.name}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground font-medium">{selectedCount}/{subject.topics.length} tópicos</span>
                      <button
                        type="button"
                        onClick={() => toggleExpandSubject(subject.id)}
                        className="text-muted-foreground hover:text-foreground p-1 transition-transform"
                        aria-label={isExpanded ? `Recolher tópicos de ${subject.name}` : `Expandir tópicos de ${subject.name}`}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 space-y-2 border-t border-border/50 bg-muted/10">
                      {subject.topics.map(topic => {
                        const checked = selectedTopicIds.has(topic.id);
                        return (
                          <div key={topic.id} className="grid grid-cols-[auto_minmax(0,1fr)_92px] items-center gap-3 py-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTopic(topic.id)}
                              className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                              aria-label={`Selecionar ${topic.name}`}
                            />
                            <span className="truncate text-sm text-muted-foreground" title={topic.name}>{topic.name}</span>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="5"
                                step="5"
                                disabled={!checked}
                                value={topicMinutes[topic.id] ?? '60'}
                                onChange={event => setTopicMinutes(current => ({ ...current, [topic.id]: event.target.value }))}
                                className="h-8 text-right text-sm"
                                aria-label={`Minutos para ${topic.name}`}
                              />
                              <span className="text-xs text-muted-foreground">min</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 shrink-0 border-t">
            <p className="text-sm text-muted-foreground"><strong className="text-foreground">{selectedTopicIds.size}</strong> tópicos · <strong className="text-foreground">{formatDuration(buildItems().reduce((total, item) => total + item.plannedMinutes, 0))}</strong></p>
            <Button onClick={saveCycle}>Salvar alterações do ciclo</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="glass rounded-sm p-5 border border-border/60"><Icon className="w-5 h-5 text-primary mb-2" /><p className="text-lg font-bold truncate">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}