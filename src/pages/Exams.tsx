import { useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { getExams, createExam, deleteExam, getSubjects, getStudyPlans } from '@/lib/firestore';
import type { Exam, Subject } from '@/types';
import { formatDate } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Plus, BarChart3, Trophy, Trash2, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export default function ExamsPage() {
  const { user, profile } = useAuthContext();
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);

  const [eName, setEName] = useState('');
  const [eDate, setEDate] = useState('');
  const [eTotal, setETotal] = useState('');
  const [eCorrect, setECorrect] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const savedPlanId = localStorage.getItem('selectedPlanId');
      const plans = await getStudyPlans(user.uid);
      let targetPlanId = savedPlanId;
      if (!targetPlanId && plans.length > 0) targetPlanId = plans[0].id;

      if (!targetPlanId) {
        setLoading(false);
        return;
      }
      
      setActivePlanId(targetPlanId);
      const [e, s] = await Promise.all([getExams(user.uid, targetPlanId), getSubjects(targetPlanId)]);
      setExams(e);
      setSubjects(s);
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user || !activePlanId || !eName || !eDate || !eTotal || !eCorrect) return;
    const now = new Date().toISOString();
    const data: Omit<Exam, 'id'> = {
      userId: user.uid,
      planId: activePlanId,
      name: eName,
      date: eDate,
      totalQuestions: parseInt(eTotal),
      totalCorrect: parseInt(eCorrect),
      results: [],
      createdAt: now,
    };
    const id = await createExam(data);
    setExams(prev => [{ id, ...data }, ...prev]);
    setDialog(false);
    setEName(''); setEDate(''); setETotal(''); setECorrect('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este simulado?')) return;
    await deleteExam(id);
    setExams(prev => prev.filter(e => e.id !== id));
  };

  const chartData = [...exams]
    .reverse()
    .map(e => ({
      name: format(new Date(e.date), 'dd/MM'),
      acertos: Math.round((e.totalCorrect / e.totalQuestions) * 100),
    }));

  const avgScore = exams.length
    ? Math.round(exams.reduce((a, e) => a + (e.totalCorrect / e.totalQuestions) * 100, 0) / exams.length)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Simulados</h1>
          <p className="text-muted-foreground text-sm mt-1">{exams.length} simulados registrados</p>
        </div>
        <Button size="sm" onClick={() => setDialog(true)}>
          <Plus className="w-4 h-4" /> Novo Simulado
        </Button>
      </div>

      {/* Stats */}
      {exams.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-5 border border-primary/20">
            <Trophy className="w-5 h-5 text-primary mb-2" />
            <p className="text-2xl font-bold">{avgScore}%</p>
            <p className="text-xs text-muted-foreground">média de acertos</p>
          </div>
          <div className="glass rounded-2xl p-5 border border-emerald-500/20">
            <TrendingUp className="w-5 h-5 text-emerald-400 mb-2" />
            <p className="text-2xl font-bold">
              {Math.round((exams[0]?.totalCorrect / exams[0]?.totalQuestions) * 100) ?? 0}%
            </p>
            <p className="text-xs text-muted-foreground">último simulado</p>
          </div>
          <div className="glass rounded-2xl p-5 border border-blue-500/20">
            <BarChart3 className="w-5 h-5 text-blue-400 mb-2" />
            <p className="text-2xl font-bold">{exams.length}</p>
            <p className="text-xs text-muted-foreground">simulados realizados</p>
          </div>
        </div>
      )}

      {/* Performance chart */}
      {exams.length > 1 && (
        <div className="glass rounded-2xl p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4">Evolução de Desempenho</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: any) => [`${v}%`, 'Acertos']}
              />
              <ReferenceLine y={60} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: '60%', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <Line type="monotone" dataKey="acertos" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Exams list */}
      {exams.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-dashed">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">Nenhum simulado registrado</h3>
          <p className="text-muted-foreground text-sm mb-6">Registre seus simulados para acompanhar sua evolução.</p>
          <Button onClick={() => setDialog(true)}><Plus className="w-4 h-4" /> Adicionar simulado</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map(exam => {
            const pct = Math.round((exam.totalCorrect / exam.totalQuestions) * 100);
            return (
              <div key={exam.id} className="glass rounded-xl p-5 card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{exam.name}</h3>
                    <p className="text-xs text-muted-foreground">{formatDate(exam.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${pct >= 70 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      {pct}%
                    </span>
                    <Button
                      variant="ghost" size="icon"
                      className="w-7 h-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(exam.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={pct} className="flex-1 h-2" />
                  <span className="text-xs text-muted-foreground">{exam.totalCorrect}/{exam.totalQuestions}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Simulado</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do simulado</Label>
              <Input placeholder="Ex: Simulado CEBRASPE #1" value={eName} onChange={e => setEName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={eDate} onChange={e => setEDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total de questões</Label>
                <Input type="number" placeholder="Ex: 120" value={eTotal} onChange={e => setETotal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Questões corretas</Label>
                <Input type="number" placeholder="Ex: 84" value={eCorrect} onChange={e => setECorrect(e.target.value)} />
              </div>
            </div>
            {eTotal && eCorrect && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold gradient-text">
                  {Math.round((parseInt(eCorrect) / parseInt(eTotal)) * 100)}%
                </p>
                <p className="text-xs text-muted-foreground">taxa de acertos</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!eName || !eDate || !eTotal || !eCorrect}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
