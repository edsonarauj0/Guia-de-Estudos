import React, { useState, useEffect, useMemo } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePlanContext } from '@/contexts/PlanContext';
import { getStudyPlans, getSubjects, getTopics, getQuestionLogs, createQuestionLog, deleteQuestionLog } from '@/lib/firestore';
import type { StudyPlan, Subject, Topic, QuestionLog } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Target, CheckCircle2, ListTodo, TrendingUp, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, subDays, isSameDay, parseISO } from 'date-fns';
import { toast } from 'sonner';

export default function Questions() {
  const { user } = useAuthContext();
  const { selectedPlanId: globalPlanId } = usePlanContext();
  const [logs, setLogs] = useState<QuestionLog[]>([]);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [selectedPlanIdFilter, setSelectedPlanIdFilter] = useState<string>('all');
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formPlanId, setFormPlanId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formTopicId, setFormTopicId] = useState('');
  const [formType, setFormType] = useState<'practice' | 'exam' | 'review'>('practice');
  const [formTotal, setFormTotal] = useState('');
  const [formCorrect, setFormCorrect] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');

  // Loaded relational data for form
  const [formSubjects, setFormSubjects] = useState<Subject[]>([]);
  const [formTopics, setFormTopics] = useState<Topic[]>([]);

  useEffect(() => {
    if (!user) return;
    loadInitialData();
  }, [user, globalPlanId]);

  useEffect(() => {
    setSelectedPlanIdFilter(globalPlanId ?? 'all');
    setFormPlanId(globalPlanId ?? '');
  }, [globalPlanId]);

  async function loadInitialData() {
    if (!user) return;
    const [fetchedLogs, fetchedPlans] = await Promise.all([
      getQuestionLogs(user.uid, globalPlanId ?? undefined),
      getStudyPlans(user.uid),
    ]);
    setLogs(fetchedLogs);
    setPlans(fetchedPlans);
  }

  useEffect(() => {
    if (formPlanId) {
      getSubjects(formPlanId).then(setFormSubjects);
      setFormSubjectId('');
      setFormTopicId('');
      setFormTopics([]);
    } else {
      setFormSubjects([]);
    }
  }, [formPlanId]);

  useEffect(() => {
    if (formPlanId && formSubjectId) {
      getTopics(formPlanId, formSubjectId).then(setFormTopics);
      setFormTopicId('');
    } else {
      setFormTopics([]);
    }
  }, [formPlanId, formSubjectId]);

  const filteredLogs = useMemo(() => {
    if (selectedPlanIdFilter === 'all') return logs;
    return logs.filter(l => l.planId === selectedPlanIdFilter);
  }, [logs, selectedPlanIdFilter]);

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    let totalToday = 0;
    let correctToday = 0;
    let totalAll = 0;
    let correctAll = 0;

    filteredLogs.forEach(log => {
      totalAll += log.total;
      correctAll += log.correct;
      if (log.date === today) {
        totalToday += log.total;
        correctToday += log.correct;
      }
    });

    const accuracyToday = totalToday > 0 ? (correctToday / totalToday) * 100 : 0;
    const accuracyAll = totalAll > 0 ? (correctAll / totalAll) * 100 : 0;

    return { totalToday, accuracyToday, totalAll, accuracyAll };
  }, [filteredLogs]);

  // --- CHART DATA (Last 30 days) ---
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayLogs = filteredLogs.filter(l => l.date === dateStr);
      
      let dayTotal = 0;
      let dayCorrect = 0;
      dayLogs.forEach(l => {
        dayTotal += l.total;
        dayCorrect += l.correct;
      });
      
      data.push({
        date: format(date, 'dd/MM'),
        accuracy: dayTotal > 0 ? Math.round((dayCorrect / dayTotal) * 100) : null,
      });
    }
    return data;
  }, [filteredLogs]);

  // --- SUBJECT PERFORMANCE ---
  const subjectStats = useMemo(() => {
    const statsMap = new Map<string, { name: string; color: string; total: number; correct: number }>();
    
    filteredLogs.forEach(log => {
      const existing = statsMap.get(log.subjectId) || { name: log.subjectName, color: log.subjectColor, total: 0, correct: 0 };
      existing.total += log.total;
      existing.correct += log.correct;
      statsMap.set(log.subjectId, existing);
    });

    return Array.from(statsMap.values()).map(s => ({
      ...s,
      accuracy: s.total > 0 ? (s.correct / s.total) * 100 : 0
    })).sort((a, b) => a.accuracy - b.accuracy); // Worst first
  }, [filteredLogs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formPlanId || !formSubjectId || !formTotal || !formCorrect) return;

    const t = parseInt(formTotal);
    const c = parseInt(formCorrect);
    
    if (c > t) {
      toast.error('Acertos não podem ser maiores que o total de questões');
      return;
    }

    setIsSubmitting(true);
    try {
      const subject = formSubjects.find(s => s.id === formSubjectId);
      const topic = formTopics.find(t => t.id === formTopicId);

      const logData: Omit<QuestionLog, 'id'> = {
        userId: user.uid,
        planId: formPlanId,
        subjectId: formSubjectId,
        subjectName: subject?.name || 'Desconhecida',
        subjectColor: subject?.color || '#ccc',
        topicId: formTopicId || undefined,
        topicName: topic?.name || undefined,
        date: formDate,
        total: t,
        correct: c,
        wrong: t - c,
        sessionType: formType,
        notes: formNotes,
        createdAt: new Date().toISOString(),
      };

      await createQuestionLog(logData);
      toast.success('Questões registradas com sucesso!');
      setIsDialogOpen(false);
      
      // Reset form (keep plan and date to facilitate multiple entries)
      setFormSubjectId('');
      setFormTotal('');
      setFormCorrect('');
      setFormNotes('');
      
      loadInitialData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar questões');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;
    try {
      await deleteQuestionLog(id);
      setLogs(logs.filter(l => l.id !== id));
      toast.success('Registro excluído');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir');
    }
  };

  const formPreviewAccuracy = formTotal && formCorrect && !isNaN(parseInt(formCorrect)) && !isNaN(parseInt(formTotal)) && parseInt(formTotal) > 0
    ? (parseInt(formCorrect) / parseInt(formTotal)) * 100
    : 0;

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Target className="w-8 h-8 text-primary" />
            Questões
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe seu desempenho e taxa de acertos
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <Select value={selectedPlanIdFilter} onValueChange={(v) => setSelectedPlanIdFilter(v as string)}>
            <SelectTrigger className="w-full md:w-[200px] bg-background/50 backdrop-blur">
              <SelectValue placeholder="Filtrar por plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Planos</SelectItem>
              {plans.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={<Button className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all" />}>
              <Plus className="w-4 h-4" />
              Registrar
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-card/95 backdrop-blur-xl border-white/10">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Registrar Questões</DialogTitle>
                  <DialogDescription>
                    Insira os detalhes das questões que você acabou de resolver.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input 
                        type="date" 
                        required 
                        value={formDate} 
                        onChange={e => setFormDate(e.target.value)} 
                        className="bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="practice">Prática</SelectItem>
                          <SelectItem value="exam">Simulado</SelectItem>
                          <SelectItem value="review">Revisão</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Plano de Estudo</Label>
                    <Select value={formPlanId} onValueChange={(v) => setFormPlanId(v as string)} required>
                      <SelectTrigger className="bg-background/50">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Matéria</Label>
                    <Select value={formSubjectId} onValueChange={(v) => setFormSubjectId(v as string)} required disabled={!formPlanId}>
                      <SelectTrigger className="bg-background/50">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {formSubjects.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tópico (Opcional)</Label>
                    <Select value={formTopicId} onValueChange={(v) => setFormTopicId(v as string)} disabled={!formSubjectId}>
                      <SelectTrigger className="bg-background/50">
                        <SelectValue placeholder="Geral / Não especificado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Geral / Não especificado</SelectItem>
                        {formTopics.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Total de Questões</Label>
                      <Input 
                        type="number" 
                        min="1" 
                        required 
                        value={formTotal} 
                        onChange={e => setFormTotal(e.target.value)}
                        className="bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Acertos</Label>
                      <Input 
                        type="number" 
                        min="0" 
                        max={formTotal || "999"} 
                        required 
                        value={formCorrect} 
                        onChange={e => setFormCorrect(e.target.value)}
                        className="bg-background/50"
                      />
                    </div>
                  </div>

                  {formTotal && formCorrect && (
                    <div className="p-3 bg-muted/50 rounded-lg flex items-center justify-between border border-border/50">
                      <span className="text-sm font-medium">Prévia de Aproveitamento:</span>
                      <Badge variant={formPreviewAccuracy >= 70 ? "default" : formPreviewAccuracy >= 50 ? "secondary" : "destructive"}>
                        {formPreviewAccuracy.toFixed(1)}%
                      </Badge>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Notas (Opcional)</Label>
                    <Textarea 
                      value={formNotes} 
                      onChange={e => setFormNotes(e.target.value)} 
                      placeholder="Alguma observação importante sobre estas questões?"
                      className="resize-none h-20 bg-background/50"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando...' : 'Salvar Registro'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-card to-card/50 border-white/5 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Questões Hoje</CardTitle>
            <ListTodo className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalToday}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-card to-card/50 border-white/5 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acerto Hoje</CardTitle>
            <TrendingUp className={`h-4 w-4 ${stats.accuracyToday >= 70 ? 'text-green-500' : stats.accuracyToday >= 50 ? 'text-yellow-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.accuracyToday.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-white/5 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Geral</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalAll}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-white/5 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acerto Geral</CardTitle>
            <CheckCircle2 className={`h-4 w-4 ${stats.accuracyAll >= 70 ? 'text-green-500' : stats.accuracyAll >= 50 ? 'text-yellow-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.accuracyAll.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Chart & Recent Logs */}
        <div className="lg:col-span-2 space-y-6">
          
          <Card className="border-white/10 bg-card/40 backdrop-blur-md shadow-xl">
            <CardHeader>
              <CardTitle>Aproveitamento - Últimos 30 dias</CardTitle>
              <CardDescription>Evolução da sua taxa de acerto diária</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
                    <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => [`${value}%`, 'Aproveitamento']}
                    />
                    <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="3 3" opacity={0.5} />
                    <Line 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="#8b5cf6" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: '#a78bfa' }}
                      connectNulls={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card/40 backdrop-blur-md shadow-xl">
            <CardHeader>
              <CardTitle>Registros Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px] pr-4">
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    Nenhum registro encontrado.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredLogs.slice(0, 20).map(log => (
                      <div key={log.id} className="flex items-center justify-between p-4 rounded-xl bg-background/40 hover:bg-background/60 transition-colors border border-white/5">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-3 h-12 rounded-full shrink-0" 
                            style={{ backgroundColor: log.subjectColor }}
                          />
                          <div>
                            <div className="font-medium text-white flex items-center gap-2">
                              {log.subjectName}
                              <Badge variant="outline" className="text-xs font-normal border-white/10">
                                {log.sessionType === 'practice' ? 'Prática' : log.sessionType === 'exam' ? 'Simulado' : 'Revisão'}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                              <span>{format(parseISO(log.date), 'dd/MM/yyyy')}</span>
                              {log.topicName && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                                  <span className="truncate max-w-[200px]">{log.topicName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="font-semibold text-white">
                              {log.correct} / {log.total}
                            </div>
                            <div className={`text-sm ${((log.correct/log.total)*100) >= 70 ? 'text-green-400' : ((log.correct/log.total)*100) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {((log.correct / log.total) * 100).toFixed(1)}%
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-400 hover:bg-red-400/10" onClick={() => handleDelete(log.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
          
        </div>

        {/* Right Column: Subjects Performance */}
        <div className="space-y-6">
          <Card className="border-white/10 bg-card/40 backdrop-blur-md shadow-xl h-full">
            <CardHeader>
              <CardTitle>Desempenho por Matéria</CardTitle>
              <CardDescription>Classificado pelos menores acertos</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[700px] pr-4">
                <div className="space-y-4">
                  {subjectStats.map(stat => (
                    <div key={stat.name} className="flex flex-col gap-2 p-4 rounded-xl bg-background/40 border border-white/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }} />
                          <span className="font-medium text-white text-sm truncate max-w-[150px]" title={stat.name}>{stat.name}</span>
                        </div>
                        <Badge variant={stat.accuracy >= 70 ? "default" : stat.accuracy >= 50 ? "secondary" : "destructive"}>
                          {stat.accuracy.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex justify-between">
                        <span>{stat.correct} acertos</span>
                        <span>{stat.total} questões</span>
                      </div>
                      {/* Simple progress bar */}
                      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                        <div 
                          className="h-full rounded-full transition-all" 
                          style={{ 
                            width: `${stat.accuracy}%`,
                            backgroundColor: stat.accuracy >= 70 ? '#22c55e' : stat.accuracy >= 50 ? '#eab308' : '#ef4444'
                          }} 
                        />
                      </div>
                    </div>
                  ))}
                  {subjectStats.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                      Nenhum dado disponível.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
