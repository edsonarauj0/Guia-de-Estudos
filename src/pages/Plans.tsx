import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { getStudyPlans, createStudyPlan, updateStudyPlan, deleteStudyPlan, getSubjects } from '@/lib/firestore';
import type { StudyPlan, WeeklyGoal, PlanStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Calendar, Archive, Play, Pause, Library } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const PLAN_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#0ea5e9','#3b82f6'];

const DEFAULT_WEEKLY: WeeklyGoal = { monday: 3, tuesday: 3, wednesday: 3, thursday: 3, friday: 3, saturday: 5, sunday: 2 };

const DAY_LABELS = [
  { key: 'monday', short: 'Seg' },
  { key: 'tuesday', short: 'Ter' },
  { key: 'wednesday', short: 'Qua' },
  { key: 'thursday', short: 'Qui' },
  { key: 'friday', short: 'Sex' },
  { key: 'saturday', short: 'Sáb' },
  { key: 'sunday', short: 'Dom' },
];

interface PlanWithStats extends StudyPlan {
  subjectCount: number;
}

export default function PlansPage() {
  const { user } = useAuthContext();
  const [plans, setPlans] = useState<PlanWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<StudyPlan | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');

  // Form State
  const [name, setName] = useState('');
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [status, setStatus] = useState<PlanStatus>('active');
  const [color, setColor] = useState(PLAN_COLORS[0]);
  const [dailyGoalQuestions, setDailyGoalQuestions] = useState<number>(30);
  const [weeklyGoal, setWeeklyGoal] = useState<WeeklyGoal>(DEFAULT_WEEKLY);

  const loadPlans = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const fetchedPlans = await getStudyPlans(user.uid);
      const plansWithStats = await Promise.all(
        fetchedPlans.map(async (plan) => {
          const subjects = await getSubjects(plan.id);
          return { ...plan, subjectCount: subjects.length };
        })
      );
      setPlans(plansWithStats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadPlans();
    }
  }, [user, loadPlans]);

  const openDialog = (plan?: StudyPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setName(plan.name);
      setExamName(plan.examName || '');
      setExamDate(plan.examDate ? new Date(plan.examDate).toISOString().slice(0, 16) : '');
      setStatus(plan.status);
      setColor(plan.color || PLAN_COLORS[0]);
      setDailyGoalQuestions(plan.dailyGoalQuestions || 30);
      setWeeklyGoal(plan.dailyGoalHours || DEFAULT_WEEKLY);
    } else {
      setEditingPlan(null);
      setName('');
      setExamName('');
      setExamDate('');
      setStatus('active');
      setColor(PLAN_COLORS[0]);
      setDailyGoalQuestions(30);
      setWeeklyGoal(DEFAULT_WEEKLY);
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
  };

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    const now = new Date().toISOString();
    
    const planData: Partial<StudyPlan> = {
      name: name.trim(),
      examName: examName.trim() || undefined,
      examDate: examDate ? new Date(examDate).toISOString() : undefined,
      status,
      color,
      dailyGoalHours: weeklyGoal,
      dailyGoalQuestions,
      updatedAt: now,
    };

    if (editingPlan) {
      await updateStudyPlan(editingPlan.id, planData);
    } else {
      await createStudyPlan({
        ...planData,
        userId: user.uid,
        createdAt: now,
      } as Omit<StudyPlan, 'id'>);
    }
    closeDialog();
    await loadPlans();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este planejamento?')) return;
    await deleteStudyPlan(id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleStatus = async (plan: StudyPlan, newStatus: PlanStatus) => {
    await updateStudyPlan(plan.id, { status: newStatus, updatedAt: new Date().toISOString() });
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, status: newStatus } : p)));
  };

  const getStatusBadgeClass = (s: PlanStatus) => {
    if (s === 'active') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    if (s === 'paused') return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    return 'bg-muted text-muted-foreground border border-border';
  };

  const filteredPlans = plans.filter((p) => {
    if (activeTab === 'all') return true;
    return p.status === activeTab;
  });

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Planejamentos</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus planos de estudo e concursos</p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Planejamento
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col items-left">
        <TabsList className="w-10/12 grid grid-cols-4 mb-6 h-12">
          <TabsTrigger value="all">Todos ({plans.length})</TabsTrigger>
          <TabsTrigger value="active">Ativos ({plans.filter((p) => p.status === 'active').length})</TabsTrigger>
          <TabsTrigger value="paused">Pausados ({plans.filter((p) => p.status === 'paused').length})</TabsTrigger>
          <TabsTrigger value="archived">Arquivados ({plans.filter((p) => p.status === 'archived').length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          {filteredPlans.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center border border-dashed flex flex-col items-center">
              <Library className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="font-semibold text-foreground mb-2 text-xl">Nenhum planejamento encontrado</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Crie um novo planejamento para organizar suas matérias, metas e acompanhar seu progresso.
              </p>
              <Button onClick={() => openDialog()}>
                <Plus className="w-4 h-4 mr-2" /> Novo Planejamento
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlans.map((plan) => {
                let daysUntil = null;
                if (plan.examDate) {
                  daysUntil = differenceInDays(new Date(plan.examDate), new Date());
                }
                const progressVal = 0; // You'd compute this properly in a full app

                return (
                  <div key={plan.id} className="glass rounded-2xl overflow-hidden card-hover flex flex-col border border-border/50 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: plan.color }} />
                    <div className="p-5 pl-6 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <Badge className={getStatusBadgeClass(plan.status)}>
                            {plan.status === 'active' ? 'Ativo' : plan.status === 'paused' ? 'Pausado' : 'Arquivado'}
                          </Badge>
                          <h3 className="text-xl font-bold mt-2 text-foreground">{plan.name}</h3>
                          {plan.examName && <p className="text-sm text-muted-foreground mt-1">{plan.examName}</p>}
                        </div>
                      </div>

                      <div className="space-y-3 mt-auto">
                        {plan.examDate && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 mr-2 opacity-70" />
                            <span>
                              {format(new Date(plan.examDate), 'dd/MM/yyyy')} 
                              {daysUntil !== null && daysUntil >= 0 && (
                                <span className="ml-2 font-medium text-foreground">({daysUntil} dias)</span>
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Library className="w-4 h-4 mr-2 opacity-70" />
                          <span>{plan.subjectCount} {plan.subjectCount === 1 ? 'matéria' : 'matérias'}</span>
                        </div>
                        
                        <div className="pt-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progresso</span>
                            <span className="font-medium">{progressVal}%</span>
                          </div>
                          <Progress value={progressVal} className="h-1.5" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t border-border/50 p-3 pl-6 flex justify-between items-center bg-muted/10">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDialog(plan)}>
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)}>
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        {plan.status !== 'archived' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => toggleStatus(plan, plan.status === 'active' ? 'paused' : 'active')}
                          >
                            {plan.status === 'active' ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                            {plan.status === 'active' ? 'Pausar' : 'Retomar'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => toggleStatus(plan, plan.status === 'archived' ? 'active' : 'archived')}
                        >
                          <Archive className="w-3 h-3 mr-1" />
                          {plan.status === 'archived' ? 'Desarquivar' : 'Arquivar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Planejamento' : 'Novo Planejamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do planejamento *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: TRF 6" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(val) => setStatus(val as PlanStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do concurso/curso</Label>
                <Input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="Ex: Tribunal Regional Federal" />
              </div>
              <div className="space-y-2">
                <Label>Data da prova</Label>
                <Input type="datetime-local" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor de identificação</Label>
              <div className="flex flex-wrap gap-2">
                {PLAN_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-foreground">Metas de Estudo</h4>
              
              <div className="space-y-2 max-w-sm">
                <Label>Questões por dia</Label>
                <Input
                  type="number"
                  min="0"
                  value={dailyGoalQuestions}
                  onChange={(e) => setDailyGoalQuestions(Number(e.target.value))}
                />
              </div>

              <div className="space-y-3 pt-2">
                <Label>Horas diárias disponíveis</Label>
                <div className="grid grid-cols-7 gap-2">
                  {DAY_LABELS.map((day) => (
                    <div key={day.key} className="space-y-1 text-center">
                      <Label className="text-xs text-muted-foreground">{day.short}</Label>
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        className="text-center px-1"
                        value={weeklyGoal[day.key as keyof WeeklyGoal]}
                        onChange={(e) => setWeeklyGoal({ ...weeklyGoal, [day.key]: Number(e.target.value) })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!name.trim()}>
                {editingPlan ? 'Salvar Alterações' : 'Criar Planejamento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
