import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePlanContext } from '@/contexts/PlanContext';
import {
  getStudyPlans,
  createStudyPlan,
  getSubjects, getTopics, createSubject, updateSubject,
  deleteSubject, createTopic, deleteTopic, batchCreateSubjectsAndTopics,
  addTopicToReviewQueue, getReviewCards
} from '@/lib/firestore';
import type { StudyPlan, Subject, Topic, TopicProgress } from '@/types';
import { SUBJECT_COLORS, getSubjectProgressPercent } from '@/lib/helpers';
import TopicItem from '@/components/subjects/TopicItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, BookOpen, ChevronDown, ChevronUp, Trash2, Pencil,
  Upload, FileText, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { extractTextFromPDF, parseEditalText, type ExtractedSubject } from '@/lib/pdfExtractor';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SubjectWithTopics extends Subject {
  topics: Topic[];
  expanded: boolean;
}

const DEFAULT_PROGRESS: TopicProgress = {
  video: { status: 'not_started' },
  pdf: { status: 'not_started' },
  questions: { status: 'not_started' },
  revision: { status: 'not_started' },
};

export default function SubjectsPage() {
  const { user } = useAuthContext();
  const { selectedPlanId: globalPlanId, selectPlan, refreshPlans } = usePlanContext();
  const [subjects, setSubjects] = useState<SubjectWithTopics[]>([]);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [reviewCardTopicIds, setReviewCardTopicIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [subjectDialog, setSubjectDialog] = useState(false);
  const [topicDialog, setTopicDialog] = useState(false);
  const [planDialog, setPlanDialog] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ExtractedSubject[] | null>(null);

  // Subject form
  const [sName, setSName] = useState('');
  const [sWeight, setSWeight] = useState('');
  const [sColor, setSColor] = useState(SUBJECT_COLORS[0]);

  // Topic form
  const [tName, setTName] = useState('');
  const [tNotes, setTNotes] = useState('');
  const [tDifficulty, setTDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [tTags, setTTags] = useState('');
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');

  const loadSubjects = useCallback(async (planIdOverride?: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const availablePlans = await getStudyPlans(user.uid);
      setPlans(availablePlans);

      let targetPlanId = planIdOverride || globalPlanId;
      if (targetPlanId && !availablePlans.some(plan => plan.id === targetPlanId)) {
        targetPlanId = null;
      }

      if (!targetPlanId && availablePlans.length > 0) {
        targetPlanId = availablePlans[0].id;
        selectPlan(targetPlanId);
      }

      if (!targetPlanId) {
        setLoading(false);
        return;
      }

      setActivePlanId(targetPlanId);

      const [subs, reviewCards] = await Promise.all([
        getSubjects(targetPlanId),
        getReviewCards(user.uid, targetPlanId)
      ]);
      setPlans(availablePlans);
      setReviewCardTopicIds(new Set(reviewCards.map(rc => rc.topicId)));
      const withTopics = await Promise.all(
        subs.map(async s => ({
          ...s,
          topics: await getTopics(targetPlanId, s.id),
          expanded: false,
        }))
      );
      setSubjects(withTopics);
    } finally {
      setLoading(false);
    }
  }, [user, globalPlanId, selectPlan]);

  useEffect(() => {
    if (!user) return;
    loadSubjects();
  }, [user, globalPlanId, loadSubjects]);

  const activePlan = plans.find(plan => plan.id === activePlanId) ?? null;

  const handlePlanChange = async (planId: string) => {
    if (!planId || planId === activePlanId) return;
    setActivePlanId(planId);
    selectPlan(planId);
    await loadSubjects(planId);
  };

  const handleCreatePlan = async () => {
    if (!user || !planName.trim()) return;
    const now = new Date().toISOString();
    const id = await createStudyPlan({
      userId: user.uid,
      name: planName.trim(),
      status: 'active',
      color: '#6366f1',
      dailyGoalHours: { monday: 3, tuesday: 3, wednesday: 3, thursday: 3, friday: 3, saturday: 5, sunday: 2 },
      createdAt: now,
      updatedAt: now,
    });
    setPlanDialog(false);
    setPlanName('');
    setPlanDescription('');
    selectPlan(id);
    await refreshPlans();
    await loadSubjects(id);
  };

  const handleSaveSubject = async () => {
    if (!user || !activePlanId || !sName.trim()) return;
    const now = new Date().toISOString();

    if (editingSubject) {
      await updateSubject(activePlanId, editingSubject.id, { name: sName, weight: parseFloat(sWeight) || 0, color: sColor });
      setSubjects(prev => prev.map(s => s.id === editingSubject.id ? { ...s, name: sName, weight: parseFloat(sWeight) || 0, color: sColor } : s));
    } else {
      const id = await createSubject(activePlanId, {
        name: sName,
        color: sColor,
        weight: parseFloat(sWeight) || 0,
        order: subjects.length,
        createdAt: now,
        updatedAt: now,
      });
      setSubjects(prev => [...prev, { id, userId: user.uid, planId: activePlanId, name: sName, color: sColor, weight: parseFloat(sWeight) || 0, order: subjects.length, createdAt: now, updatedAt: now, topics: [], expanded: true }]);
    }
    closeSubjectDialog();
  };

  const handleSaveTopic = async () => {
    if (!activePlanId || !activeSubjectId || !tName.trim()) return;
    const now = new Date().toISOString();
    const subj = subjects.find(s => s.id === activeSubjectId)!;

    const topicData = {
      name: tName,
      notes: tNotes,
      tags: tTags.split(',').map(t => t.trim()).filter(Boolean),
      difficulty: tDifficulty,
      order: subj.topics.length,
      progress: DEFAULT_PROGRESS,
      createdAt: now,
      updatedAt: now,
    };

    if (editingTopic) {
      await deleteTopic(activePlanId, activeSubjectId, editingTopic.id);
      const id = await createTopic(activePlanId, activeSubjectId, topicData);
      const newTopic: Topic = { id, planId: activePlanId, subjectId: activeSubjectId, ...topicData };
      setSubjects(prev => prev.map(s => s.id === activeSubjectId
        ? { ...s, topics: [...s.topics.filter(t => t.id !== editingTopic.id), newTopic] }
        : s
      ));
    } else {
      const id = await createTopic(activePlanId, activeSubjectId, topicData);
      const newTopic: Topic = { id, planId: activePlanId, subjectId: activeSubjectId, ...topicData };
      setSubjects(prev => prev.map(s => s.id === activeSubjectId
        ? { ...s, topics: [...s.topics, newTopic] }
        : s
      ));
    }
    closeTopicDialog();
  };

  const handleDeleteSubject = async (id: string) => {
    if (!activePlanId) return;
    if (!confirm('Excluir esta matéria e todos os seus tópicos?')) return;
    await deleteSubject(activePlanId, id);
    setSubjects(prev => prev.filter(s => s.id !== id));
  };

  const handleDeleteTopic = async (subjectId: string, topicId: string) => {
    if (!activePlanId) return;
    if (!confirm('Excluir este tópico?')) return;
    await deleteTopic(activePlanId, subjectId, topicId);
    setSubjects(prev => prev.map(s => s.id === subjectId
      ? { ...s, topics: s.topics.filter(t => t.id !== topicId) }
      : s
    ));
  };

  const handleTopicUpdate = (subjectId: string, updated: Topic) => {
    setSubjects(prev => prev.map(s => s.id === subjectId
      ? { ...s, topics: s.topics.map(t => t.id === updated.id ? updated : t) }
      : s
    ));
  };

  const handleAddToReviewQueue = async (subject: Subject, topic: Topic) => {
    if (!user || !activePlanId) return;
    try {
      await addTopicToReviewQueue(
        user.uid,
        activePlanId,
        { id: topic.id, name: topic.name },
        { id: subject.id, name: subject.name, color: subject.color }
      );
      setReviewCardTopicIds(prev => {
        const newSet = new Set(prev);
        newSet.add(topic.id);
        return newSet;
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar tópico à revisão.');
    }
  };

  const parseSubjectsJson = (data: unknown): ExtractedSubject[] => {
    if (Array.isArray(data)) {
      return data
        .map(item => {
          if (!item || typeof item !== 'object') return null;
          const subject = item as { name?: unknown; weight?: unknown; topics?: unknown };
          if (typeof subject.name !== 'string' || !Array.isArray(subject.topics)) return null;
          return {
            name: subject.name.trim(),
            weight: Number(subject.weight) || 0,
            topics: subject.topics.map(topic => String(topic).trim()).filter(Boolean),
          };
        })
        .filter((subject): subject is ExtractedSubject => Boolean(subject?.name && subject.topics.length));
    }

    if (data && typeof data === 'object') {
      return Object.entries(data)
        .map(([name, topics]) => ({
          name: name.trim(),
          weight: 0,
          topics: Array.isArray(topics)
            ? topics.map(topic => String(topic).trim()).filter(Boolean)
            : [],
        }))
        .filter(subject => subject.name && subject.topics.length);
    }

    return [];
  };

  // PDF/JSON Import
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!activePlanId) {
      toast.error('Selecione um planejamento antes de importar');
      return;
    }

    setImportLoading(true);
    try {
      const isJson = file.name.toLowerCase().endsWith('.json') || file.type.includes('json');
      const parsed = isJson
        ? parseSubjectsJson(JSON.parse(await file.text()))
        : parseEditalText(await extractTextFromPDF(file));

      if (parsed.length === 0) {
        toast.error('Nenhuma matéria com tópicos foi encontrada no arquivo');
        return;
      }

      setImportPreview(parsed);
      toast.success(`${parsed.length} matérias prontas para importar`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao ler o arquivo. Verifique se ele está no formato esperado.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!user || !activePlanId || !importPreview) return;
    setImportLoading(true);
    try {
      const result = await batchCreateSubjectsAndTopics(activePlanId, user.uid, importPreview);
      await loadSubjects(activePlanId);
      setImportPreview(null);
      toast.success(
        `Importação concluída: ${result.createdSubjects} matérias e ${result.createdTopics} tópicos criados.`
      );
      if (result.skippedTopics > 0) {
        toast.info(`${result.skippedTopics} tópicos já existiam e foram ignorados.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao importar matérias e tópicos');
    } finally {
      setImportLoading(false);
    }
  };

  const openSubjectDialog = (subject?: Subject) => {
    setEditingSubject(subject ?? null);
    setSName(subject?.name ?? '');
    setSWeight(subject?.weight?.toString() ?? '');
    setSColor(subject?.color ?? SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length]);
    setSubjectDialog(true);
  };

  const closeSubjectDialog = () => {
    setSubjectDialog(false);
    setEditingSubject(null);
    setSName(''); setSWeight(''); setSColor(SUBJECT_COLORS[0]);
  };

  const openTopicDialog = (subjectId: string, topic?: Topic) => {
    setActiveSubjectId(subjectId);
    setEditingTopic(topic ?? null);
    setTName(topic?.name ?? '');
    setTNotes(topic?.notes ?? '');
    setTDifficulty(topic?.difficulty ?? 'medium');
    setTTags(topic?.tags?.join(', ') ?? '');
    setTopicDialog(true);
  };

  const closeTopicDialog = () => {
    setTopicDialog(false);
    setEditingTopic(null);
    setActiveSubjectId(null);
    setTName(''); setTNotes(''); setTDifficulty('medium'); setTTags('');
  };

  const toggleExpand = (id: string) => {
    setSubjects(prev => prev.map(s => s.id === id ? { ...s, expanded: !s.expanded } : s));
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-sm" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Matérias</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activePlan?.name ?? 'Planejamento'} · {subjects.length} matérias · {subjects.reduce((a, s) => a + s.topics.length, 0)} tópicos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPlanDialog(true)}>
            <Plus className="w-4 h-4" />
            Novo Planejamento
          </Button>

          {/* Import PDF/JSON */}
          <label className="cursor-pointer">
            <input type="file" accept=".pdf,.json,application/pdf,application/json" className="hidden" onChange={handleImportFile} />
            <span className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-sm border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
              {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importar PDF/JSON
            </span>
          </label>

          <Button size="sm" onClick={() => openSubjectDialog()}>
            <Plus className="w-4 h-4" />
            Nova Matéria
          </Button>
        </div>
      </div>

      {/* Import Preview */}
      {importPreview && (
        <div className="glass rounded-sm p-6 border border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Pré-visualização da importação</h3>
              <p className="text-sm text-muted-foreground">{importPreview.length} matérias encontradas</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportPreview(null)}>Cancelar</Button>
              <Button size="sm" onClick={handleConfirmImport} disabled={importLoading}>
                {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirmar importação
              </Button>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {importPreview.map((sub, i) => (
              <div key={i} className="bg-background/60 rounded-sm px-4 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{sub.name}</span>
                  <span className="text-xs text-muted-foreground">{sub.weight}% · {sub.topics.length} tópicos</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {subjects.length === 0 && !importPreview && (
        <div className="glass rounded-sm p-12 text-center border border-dashed">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">Nenhuma matéria cadastrada</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Adicione suas matérias manualmente ou importe do edital em PDF/JSON.
          </p>
          <div className="flex justify-center gap-3">
            <label className="cursor-pointer">
              <input type="file" accept=".pdf,.json,application/pdf,application/json" className="hidden" onChange={handleImportFile} />
              <span className="inline-flex items-center gap-1.5 h-10 px-4 py-2 text-sm font-medium rounded-sm border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                <FileText className="w-4 h-4" /> Importar edital
              </span>
            </label>
            <Button onClick={() => openSubjectDialog()}>
              <Plus className="w-4 h-4" /> Adicionar matéria
            </Button>
          </div>
        </div>
      )}

      {/* Subjects list */}
      <div className="space-y-4">
        {subjects.map(subject => {
          const progress = getSubjectProgressPercent(subject.topics);
          return (
            <div key={subject.id} className="glass rounded-sm overflow-hidden card-hover">
              {/* Subject header */}
              <div
                className="flex items-center gap-4 p-5 cursor-pointer"
                onClick={() => toggleExpand(subject.id)}
              >
                <div className="w-4 h-full rounded-sm flex-shrink-0" style={{ backgroundColor: subject.color }} />
                <div className="w-1 h-12 rounded-sm flex-shrink-0" style={{ backgroundColor: subject.color }} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-foreground">{subject.name}</h2>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
                      {subject.weight}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress
                      value={progress}
                      className="flex-1 h-2 max-w-xs"
                    />
                    <span className="text-sm text-muted-foreground">
                      {progress}% · {subject.topics.length} tópicos
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-foreground"
                    onClick={e => { e.stopPropagation(); openSubjectDialog(subject); }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-destructive"
                    onClick={e => { e.stopPropagation(); handleDeleteSubject(subject.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  {subject.expanded
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  }
                </div>
              </div>

              {/* Topics */}
              {subject.expanded && (
                <div className="px-5 pb-5 space-y-2 border-t border-border/50">
                  <div className="flex items-center justify-between py-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Tópicos ({subject.topics.length})
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTopicDialog(subject.id)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar Tópico
                    </Button>
                  </div>

                  {subject.topics.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-sm">
                      Nenhum tópico. Clique em "Adicionar Tópico" para começar.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {subject.topics.map(topic => (
                        <TopicItem
                          key={topic.id}
                          topic={topic}
                          inReviewQueue={reviewCardTopicIds.has(topic.id)}
                          onAddToReviewQueue={() => handleAddToReviewQueue(subject, topic)}
                          onEdit={t => openTopicDialog(subject.id, t)}
                          onDelete={id => handleDeleteTopic(subject.id, id)}
                          onUpdate={t => handleTopicUpdate(subject.id, t)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Subject Dialog */}
      <Dialog open={subjectDialog} onOpenChange={setSubjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubject ? 'Editar Matéria' : 'Nova Matéria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da matéria</Label>
              <Input
                placeholder="Ex: Direito Constitucional"
                value={sName}
                onChange={e => setSName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Peso no edital (%)</Label>
              <Input
                type="number"
                placeholder="Ex: 20"
                min="0"
                max="100"
                value={sWeight}
                onChange={e => setSWeight(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cor de identificação</Label>
              <div className="flex gap-2 flex-wrap">
                {SUBJECT_COLORS.map((color: string) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-sm transition-all duration-150 ${sColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeSubjectDialog}>Cancelar</Button>
              <Button onClick={handleSaveSubject} disabled={!sName.trim()}>
                {editingSubject ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Planejamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do planejamento</Label>
              <Input
                placeholder="Ex: TRF 6 2026"
                value={planName}
                onChange={e => setPlanName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Opcional: fase, banca, observações..."
                value={planDescription}
                onChange={e => setPlanDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPlanDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreatePlan} disabled={!planName.trim()}>
                Criar planejamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Topic Dialog */}
      <Dialog open={topicDialog} onOpenChange={setTopicDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTopic ? 'Editar Tópico' : 'Novo Tópico'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do tópico</Label>
              <Input
                placeholder="Ex: Direitos e Garantias Fundamentais"
                value={tName}
                onChange={e => setTName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Dificuldade</Label>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setTDifficulty(d)}
                    className={`flex-1 py-2 rounded-sm text-sm font-medium border transition-all duration-150 ${tDifficulty === d
                      ? d === 'easy' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : d === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-red-500/20 text-red-400 border-red-500/40'
                      : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {d === 'easy' ? 'Fácil' : d === 'medium' ? 'Médio' : 'Difícil'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input
                placeholder="Ex: cai muito, importante, revisão"
                value={tTags}
                onChange={e => setTTags(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Anotações</Label>
              <Textarea
                placeholder="Observações sobre o tópico..."
                value={tNotes}
                onChange={e => setTNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeTopicDialog}>Cancelar</Button>
              <Button onClick={handleSaveTopic} disabled={!tName.trim()}>
                {editingTopic ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
