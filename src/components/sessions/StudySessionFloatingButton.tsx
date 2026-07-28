import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Calendar,
  Clock3,
  Loader2,
  Pause,
  Play,
  Square,
  X,
  BookOpen,
  HelpCircle,
  Video,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePlanContext } from '@/contexts/PlanContext';
import {
  createSession,
  createQuestionLog,
  getStudyPlans,
  getSubjects,
  getTopics,
  getStudyCycles,
  updateTopic,
} from '@/lib/firestore';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { cn } from '@/lib/utils';
import type { StudyPlan, StudySession, Subject, Topic } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function StudySessionFloatingButton() {
  const { user } = useAuthContext();
  const { plans: globalPlans, selectedPlanId: globalPlanId, selectPlan } = usePlanContext();
  const navigate = useNavigate();
  const { elapsedSeconds, formatted, isRunning, minutes, pause, reset, start } = useStudyTimer();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dados carregados
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  // Seleções principais
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [dateOption, setDateOption] = useState<'today' | 'yesterday' | 'other'>('today');

  // Categorias ativas (selecionadas via checkbox nos accordions)
  const [activeCategories, setActiveCategories] = useState({
    questoes: false,
    paginas: false,
    videoaulas: true, // Inicia com videoaulas marcado por padrão
  });

  // Métricas adicionais do formulário
  const [material, setMaterial] = useState('Aula 01');
  const [theoryFinished, setTheoryFinished] = useState(true);
  const [programRevisions, setProgramRevisions] = useState(true);
  const [revisions, setRevisions] = useState(['1d', '7d', '30d', '60d', '120d', '245d']);

  const [correctQuestions, setCorrectQuestions] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState(0);
  const [startPage, setStartPage] = useState(0);
  const [endPage, setEndPage] = useState(0);
  const [comments, setComments] = useState('');
  const [manualDuration, setManualDuration] = useState('01:00');
  const [videoTitle, setVideoTitle] = useState('Vídeo 01');
  const [videoStartTime, setVideoStartTime] = useState('00:00:00');
  const [videoEndTime, setVideoEndTime] = useState('00:00:00');

  // Controle dos accordions abertos
  const [openAccordions, setOpenAccordions] = useState<string[]>(['videoaulas']);

  const [sessionStart, setSessionStart] = useState<string | null>(null);

  const selectedPlan = plans.find(plan => plan.id === selectedPlanId);
  const selectedSubject = subjects.find(subject => subject.id === selectedSubjectId);
  const selectedTopic = topics.find(topic => topic.id === selectedTopicId);

  // Lógicas de visibilidade
  const isExercicios = activeCategories.questoes;
  const isPaginas = activeCategories.paginas;
  const isVideo = activeCategories.videoaulas;

  const toggleCategory = (key: keyof typeof activeCategories) => {
    setActiveCategories(prev => {
      const newState = { ...prev, [key]: !prev[key] };
      // Se estiver ativando, expande o accordion automaticamente
      if (newState[key]) {
        setOpenAccordions(open => Array.from(new Set([...open, key])));
      }
      return newState;
    });
  };

  const loadPlans = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const fetchedPlans = await getStudyPlans(user.uid);
      const storedPlanId = localStorage.getItem('selectedPlanId') ?? '';
      const targetPlan = fetchedPlans.find(plan => plan.id === storedPlanId)
        ?? fetchedPlans.find(plan => plan.status === 'active')
        ?? fetchedPlans[0];

      setPlans(fetchedPlans);
      if (targetPlan) {
        setSelectedPlanId(targetPlan.id);
        localStorage.setItem('selectedPlanId', targetPlan.id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível carregar os planejamentos');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!open || plans.length > 0) return;
    loadPlans();
  }, [loadPlans, open, plans.length]);

  useEffect(() => {
    if (!globalPlanId) return;
    setPlans(globalPlans);
    setSelectedPlanId(globalPlanId);
    setSelectedSubjectId('');
    setSelectedTopicId('');
  }, [globalPlanId, globalPlans]);

  useEffect(() => {
    if (!selectedPlanId) {
      setSubjects([]);
      return;
    }

    let alive = true;
    setLoading(true);
    getSubjects(selectedPlanId)
      .then(fetchedSubjects => {
        if (!alive) return;
        setSubjects(fetchedSubjects);
        setSelectedSubjectId(current =>
          fetchedSubjects.some(subject => subject.id === current) ? current : ''
        );
        setSelectedTopicId('');
      })
      .catch(err => {
        console.error(err);
        toast.error('Não foi possível carregar as matérias');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedPlanId]);

  useEffect(() => {
    if (!selectedPlanId || !selectedSubjectId) {
      setTopics([]);
      setSelectedTopicId('');
      return;
    }

    let alive = true;
    getTopics(selectedPlanId, selectedSubjectId)
      .then(fetchedTopics => {
        if (!alive) return;
        setTopics(fetchedTopics);
        setSelectedTopicId(current =>
          fetchedTopics.some(topic => topic.id === current) ? current : ''
        );
      })
      .catch(err => {
        console.error(err);
        toast.error('Não foi possível carregar os tópicos');
      });

    return () => {
      alive = false;
    };
  }, [selectedPlanId, selectedSubjectId]);

  const handleStart = () => {
    if (!selectedPlanId || !selectedSubjectId) {
      toast.error('Selecione um planejamento e uma matéria');
      return;
    }

    if (!isExercicios && !isPaginas && !isVideo) {
      toast.error('Selecione pelo menos uma categoria nos blocos abaixo');
      return;
    }

    setSessionStart(new Date().toISOString());
    start();
    setOpen(false);
  };

  const handleCancel = () => {
    reset();
    setSessionStart(null);
  };

  const handleFinish = async () => {
    if (!user || !selectedPlanId || !selectedSubjectId) return;

    if (sessionStart && elapsedSeconds < 10) {
      toast.info('Sessão muito curta para registrar');
      handleCancel();
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const [manualHours, manualMinutes] = manualDuration.split(':').map(Number);
      const manualDurationMinutes = (manualHours || 0) * 60 + (manualMinutes || 0);
      const durationMinutes = sessionStart
        ? Math.max(1, minutes || Math.ceil(elapsedSeconds / 60))
        : Math.max(1, manualDurationMinutes);

      // Define o tipo da sessão baseado no que foi selecionado
      let sessionType: 'questions' | 'reading' | 'video' | 'revision' = 'video';
      const activeCount = Object.values(activeCategories).filter(Boolean).length;
      if (activeCount > 1) sessionType = 'revision';
      else if (isExercicios) sessionType = 'questions';
      else if (isPaginas) sessionType = 'reading';
      else if (isVideo) sessionType = 'video';

      const sessionData: Omit<StudySession, 'id'> = {
        userId: user.uid,
        planId: selectedPlanId,
        subjectId: selectedSubjectId,
        subjectName: selectedSubject?.name ?? 'Matéria não encontrada',
        topicId: selectedTopic?.id,
        topicName: selectedTopic?.name,
        startedAt: sessionStart ?? now,
        endedAt: now,
        durationMinutes,
        type: sessionType,
      };

      if (isVideo) {
        if (videoTitle.trim()) sessionData.videoTitle = videoTitle.trim();
        if (videoStartTime) sessionData.videoStartedAt = videoStartTime;
        if (videoEndTime) sessionData.videoEndedAt = videoEndTime;
      }

      const cycles = await getStudyCycles(user.uid, selectedPlanId);
      const activeCycleId = cycles.find(cycle => cycle.status === 'active')?.id;
      if (activeCycleId) sessionData.cycleId = activeCycleId;

      await createSession(sessionData);

      // ── Auto-create QuestionLog se o usuário preencheu questões e selecionou a categoria ──
      const totalQuestoes = correctQuestions + wrongQuestions;
      if (isExercicios && totalQuestoes > 0) {
        const dateStr = (sessionStart ?? new Date().toISOString()).slice(0, 10);
        await createQuestionLog({
          userId: user.uid,
          planId: selectedPlanId,
          subjectId: selectedSubjectId,
          subjectName: selectedSubject?.name ?? '',
          subjectColor: selectedSubject?.color ?? '#6366f1',
          ...(selectedTopic?.id ? { topicId: selectedTopic.id } : {}),
          ...(selectedTopic?.name ? { topicName: selectedTopic.name } : {}),
          date: dateStr,
          total: totalQuestoes,
          correct: correctQuestions,
          wrong: wrongQuestions,
          ...(comments.trim() ? { notes: comments.trim() } : {}),
          sessionType: 'practice',
          createdAt: new Date().toISOString(),
        });
      }

      // Atualiza progresso da Teoria se necessário
      if ((isVideo || isPaginas) && theoryFinished && selectedTopic) {
        const progress = {
          ...selectedTopic.progress,
          ...(isVideo && { video: { ...selectedTopic.progress.video, status: 'completed' as const, completedAt: now } }),
          ...(isPaginas && { pdf: { ...selectedTopic.progress.pdf, status: 'completed' as const, completedAt: now } }),
        };
        await updateTopic(selectedPlanId, selectedSubjectId, selectedTopic.id, { progress });
      }
      toast.success(`Sessão registrada: ${durationMinutes}min`);
      handleCancel();
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível registrar a sessão');
    } finally {
      setSaving(false);
    }
  };

  const removeRevisionDay = (day: string) => {
    setRevisions(prev => prev.filter(item => item !== day));
  };

  return (
    <>
      {!sessionStart && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'fixed bottom-5 right-5 z-40 flex h-14 min-w-14 items-center justify-center gap-3 rounded-full border shadow-xl',
            'border-primary/30 bg-primary px-5 text-white transition-all duration-200 hover:scale-105 hover:bg-secondary-foreground',
            'lg:bottom-7 lg:right-7'
          )}
          aria-label="Abrir sessão de estudo"
        >
          <Clock3 className="h-5 w-5" />
          <span className="hidden font-semibold sm:inline">Estudar</span>
        </button>
      )}

      {sessionStart && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md select-none text-white p-6">
          <div className="text-center space-y-3 mb-8">
            <h2 className="text-primary font-semibold tracking-wider text-xl">Guia de Estudos</h2>
            <p className="text-gray-300 text-lg">Você está estudando:</p>
            <h1 className="text-3xl font-bold border-b-2 border-white/20 pb-2 max-w-md mx-auto truncate">
              {selectedSubject?.name ?? 'Estudo em Andamento'}
            </h1>
            <p className="text-gray-400 text-sm">{selectedTopic?.name}</p>
          </div>

          <div className="font-mono text-7xl sm:text-9xl font-bold tracking-tight text-white mb-10 drop-shadow-md">
            {formatted}
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={isRunning ? pause : start}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 shadow-lg"
              title={isRunning ? 'Pausar' : 'Retomar'}
            >
              {isRunning ? <Pause className="h-8 w-8 text-black" /> : <Play className="h-8 w-8 text-black ml-1" />}
            </button>

            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white transition hover:scale-105 hover:bg-secondary-foreground shadow-lg"
              title="Finalizar e Salvar"
            >
              {saving ? <Loader2 className="h-8 w-8 animate-spin" /> : <Square className="h-7 w-7 fill-white" />}
            </button>

            <button
              onClick={handleCancel}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-gray-300 transition hover:bg-white/20"
              title="Cancelar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl w-[95vw] p-5 sm:p-6 bg-white rounded-2xl text-gray-800">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-800">
              Registro de Estudo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* SELEÇÃO DE DATA */}
            <div className="flex flex-wrap items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-500 hidden sm:block" />
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setDateOption('today')}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all',
                    dateOption === 'today'
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setDateOption('yesterday')}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all',
                    dateOption === 'yesterday'
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  Ontem
                </button>
                <button
                  type="button"
                  onClick={() => setDateOption('other')}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all',
                    dateOption === 'other'
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  Outro
                </button>
              </div>
            </div>

            {/* LINHA 1: DISCIPLINA E TEMPO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-400 uppercase">Disciplina</Label>
                <Select value={selectedSubjectId} onValueChange={value => value && setSelectedSubjectId(value)}>
                  <SelectTrigger className="w-full truncate">
                    <SelectValue placeholder="Selecione uma matéria" className={'truncate'}>
                      {subjects.find(p => p.id === selectedSubjectId)?.name ?? "Selecione uma matéria"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60 w-[280px]">
                    <SelectGroup>
                      <SelectLabel>Disciplinas</SelectLabel>
                      {subjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-400 uppercase">Tempo de Estudo</Label>
                {sessionStart ? (
                  <div className="border-b-2 border-primary py-2 font-mono text-gray-700 font-semibold">{formatted}</div>
                ) : (
                  <input
                    type="time"
                    step="60"
                    value={manualDuration}
                    onChange={event => setManualDuration(event.target.value)}
                    className="w-full border-0 border-b-2 border-primary px-0 py-1.5 font-mono text-sm font-semibold outline-none"
                    aria-label="Tempo de estudo manual"
                  />
                )}
              </div>
            </div>

            {/* LINHA 2: TÓPICO, MATERIAL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-400 uppercase">Tópico</Label>
                <Select value={selectedTopicId} onValueChange={value => value && setSelectedTopicId(value)}
                  disabled={!selectedSubjectId || topics.length === 0}
                >
                  <SelectTrigger className="w-full truncate">
                    <SelectValue placeholder="Selecione um tópico" className={'truncate'}>
                      {topics.find(p => p.id === selectedTopicId)?.name ?? "Selecione um tópico"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60 w-[280px]">
                    <SelectGroup>
                      <SelectLabel>Disciplinas</SelectLabel>
                      {topics.map(topic => (
                        <SelectItem key={topic.id} value={topic.id}>
                          {topic.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-400 uppercase">Material</Label>
                <input
                  type="text"
                  value={material}
                  onChange={e => setMaterial(e.target.value)}
                  className="w-full border-0 border-b-2 border-primary px-0 py-1.5 text-sm outline-none focus:ring-0"
                />
              </div>
            </div>

            {/* CHECKBOXES E REVISÕES */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-600 uppercase">
                  <input
                    type="checkbox"
                    checked={theoryFinished}
                    onChange={e => setTheoryFinished(e.target.checked)}
                    className="rounded border-primary text-primary focus:ring-primary h-4 w-4"
                  />
                  Teoria Finalizada
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-600 uppercase">
                  <input
                    type="checkbox"
                    checked={programRevisions}
                    onChange={e => setProgramRevisions(e.target.checked)}
                    className="rounded border-primary text-primary focus:ring-primary h-4 w-4"
                  />
                  Programar Revisões
                </label>
              </div>

              {programRevisions && (
                <div className="flex flex-wrap gap-2 items-center pt-1">
                  {revisions.map(day => (
                    <span
                      key={day}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium"
                    >
                      {day}
                      <button
                        type="button"
                        onClick={() => removeRevisionDay(day)}
                        className="hover:text-blue-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

           <Accordion
              value={openAccordions}
              onValueChange={(val: string[]) => setOpenAccordions(val)}
              className="w-full space-y-3 pt-2"
            >
              {/* ACCORDION: VIDEOAULAS */}
              <AccordionItem value="videoaulas" className="border-2 border-secondary-foreground/20 rounded-xl bg-blue-50/10 overflow-hidden">
                <div className="flex items-center pl-4 w-full">
                  <label className="flex items-center cursor-pointer z-10 py-3 shrink-0" title="Ativar métricas de Videoaulas">
                    <input
                      type="checkbox"
                      checked={activeCategories.videoaulas}
                      onChange={() => toggleCategory('videoaulas')}
                      className="h-4 w-4 rounded border-primary text-primary focus:ring-primary cursor-pointer"
                    />
                  </label>
                  {/* Div wrapper com flex-1 para forçar o h3 interno do Shadcn a expandir */}
                  <div className="flex-1 min-w-0">
                    <AccordionTrigger className="w-full hover:no-underline py-3 pl-3 pr-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase">
                        <Video className={cn("h-4 w-4", activeCategories.videoaulas ? "text-primary" : "text-gray-400")} />
                        <span className={cn(activeCategories.videoaulas ? "text-gray-700" : "text-gray-400")}>
                          Videoaulas (Título / Minutagem)
                        </span>
                      </div>
                    </AccordionTrigger>
                  </div>
                </div>
                <AccordionContent className={cn("pb-4 px-4 transition-all", !activeCategories.videoaulas && "opacity-40 pointer-events-none grayscale")}>
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
                    <div className="w-full sm:w-1/2 space-y-1">
                      <Label className="text-[10px] uppercase text-gray-500 font-semibold">Título do Vídeo</Label>
                      <input
                        type="text"
                        value={videoTitle}
                        onChange={event => setVideoTitle(event.target.value)}
                        className="w-full border-b-2 border-primary bg-transparent text-sm font-bold outline-none py-1"
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-1/2 justify-center pt-2 sm:pt-0">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] uppercase text-gray-500 font-semibold">Início</span>
                        <input
                          type="time"
                          step="1"
                          value={videoStartTime}
                          onChange={event => setVideoStartTime(event.target.value)}
                          className="w-24 border-b-2 border-primary bg-transparent text-center font-mono text-xs font-bold outline-none py-1"
                        />
                      </div>
                      <span className="text-gray-400 font-light pt-3">–</span>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] uppercase text-gray-500 font-semibold">Fim</span>
                        <input
                          type="time"
                          step="1"
                          value={videoEndTime}
                          onChange={event => setVideoEndTime(event.target.value)}
                          className="w-24 border-b-2 border-primary bg-transparent text-center font-mono text-xs font-bold outline-none py-1"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ACCORDION: PÁGINAS */}
              <AccordionItem value="paginas" className="border-2 border-secondary-foreground/20 rounded-xl bg-blue-50/10 overflow-hidden">
                <div className="flex items-center pl-4 w-full">
                  <label className="flex items-center cursor-pointer z-10 py-3 shrink-0" title="Ativar métricas de Leitura">
                    <input
                      type="checkbox"
                      checked={activeCategories.paginas}
                      onChange={() => toggleCategory('paginas')}
                      className="h-4 w-4 rounded border-primary text-primary focus:ring-primary cursor-pointer"
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <AccordionTrigger className="w-full hover:no-underline py-3 pl-3 pr-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase">
                        <BookOpen className={cn("h-4 w-4", activeCategories.paginas ? "text-primary" : "text-gray-400")} />
                        <span className={cn(activeCategories.paginas ? "text-gray-700" : "text-gray-400")}>
                          Páginas Lidas (Início / Fim)
                        </span>
                      </div>
                    </AccordionTrigger>
                  </div>
                </div>
                <AccordionContent className={cn("pb-4 px-4 transition-all", !activeCategories.paginas && "opacity-40 pointer-events-none grayscale")}>
                  <div className="flex justify-center items-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] uppercase text-gray-500 font-semibold">Pág. Inicial</span>
                      <input
                        type="number"
                        min={0}
                        value={startPage}
                        onChange={e => setStartPage(Number(e.target.value))}
                        className="w-20 text-center border-b-2 border-primary bg-transparent text-base font-bold outline-none"
                      />
                    </div>
                    <span className="text-gray-400 text-xl font-light pt-3">–</span>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] uppercase text-gray-500 font-semibold">Pág. Final</span>
                      <input
                        type="number"
                        min={0}
                        value={endPage}
                        onChange={e => setEndPage(Number(e.target.value))}
                        className="w-20 text-center border-b-2 border-primary bg-transparent text-base font-bold outline-none"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ACCORDION: QUESTÕES */}
              <AccordionItem value="questoes" className="border-2 border-secondary-foreground/20 rounded-xl bg-blue-50/10 overflow-hidden">
                <div className="flex items-center pl-4 w-full">
                  <label className="flex items-center cursor-pointer z-10 py-3 shrink-0" title="Ativar métricas de Questões">
                    <input
                      type="checkbox"
                      checked={activeCategories.questoes}
                      onChange={() => toggleCategory('questoes')}
                      className="h-4 w-4 rounded border-primary text-primary focus:ring-primary cursor-pointer"
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <AccordionTrigger className="w-full hover:no-underline py-3 pl-3 pr-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase">
                        <HelpCircle className={cn("h-4 w-4", activeCategories.questoes ? "text-primary" : "text-gray-400")} />
                        <span className={cn(activeCategories.questoes ? "text-gray-700" : "text-gray-400")}>
                          Questões (Acertos / Erros)
                        </span>
                      </div>
                    </AccordionTrigger>
                  </div>
                </div>
                <AccordionContent className={cn("pb-4 px-4 transition-all", !activeCategories.questoes && "opacity-40 pointer-events-none grayscale")}>
                  <div className="flex justify-center items-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] uppercase text-green-600 font-semibold">Acertos</span>
                      <input
                        type="number"
                        min={0}
                        value={correctQuestions}
                        onChange={e => setCorrectQuestions(Number(e.target.value))}
                        className="w-20 text-center border-b-2 border-green-500 bg-transparent text-base font-bold outline-none"
                      />
                    </div>
                    <span className="text-gray-400 text-xl font-light pt-3">/</span>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] uppercase text-red-500 font-semibold">Erros</span>
                      <input
                        type="number"
                        min={0}
                        value={wrongQuestions}
                        onChange={e => setWrongQuestions(Number(e.target.value))}
                        className="w-20 text-center border-b-2 border-red-400 bg-transparent text-base font-bold outline-none"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* COMENTÁRIOS */}
            <div className="space-y-1 pt-2">
              <Label className="text-xs font-semibold text-gray-400 uppercase">Comentários</Label>
              <textarea
                rows={2}
                value={comments}
                onChange={e => setComments(e.target.value)}
                className="w-full border-0 border-b-2 border-primary px-0 py-1 text-sm outline-none resize-none focus:ring-0"
              />
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between pt-4 border-t gap-4">
              <button
                type="button"
                onClick={handleStart}
                className="flex w-full sm:w-auto items-center justify-center gap-2 text-secondary-foreground font-semibold hover:text-blue-700 text-sm py-2 sm:py-0"
              >
                <Play className="h-4 w-4 fill-secondary-foreground" />
                Iniciar Cronômetro
              </button>

              <div className="flex w-full sm:w-auto items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="flex-1 sm:flex-none rounded-xl border-primary text-secondary-foreground hover:bg-blue-50 px-6"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving || !selectedPlanId || !selectedSubjectId}
                  className="flex-1 sm:flex-none rounded-xl bg-primary hover:bg-secondary-foreground text-white px-8"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}