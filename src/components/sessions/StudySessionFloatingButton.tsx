import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Calendar,
  Circle,
  Clock3,
  Loader2,
  Pause,
  Play,
  Square,
  X,
  BookOpen,
  HelpCircle,
  Video,
  RotateCcw,
  InfoIcon,
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
  getReviewCard,
  createReviewCard,
  updateReviewCard,
} from '@/lib/firestore';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { cn } from '@/lib/utils';
import type { StudyPlan, StudySession, Subject, Topic, TopicProgress } from '@/types';
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
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Checkbox } from '../ui/checkbox';

export default function StudySessionFloatingButton() {
  const { user } = useAuthContext();
  const { plans: globalPlans, selectedPlanId: globalPlanId } = usePlanContext();
  const navigate = useNavigate();
  const { elapsedSeconds, formatted, isRunning, minutes, pause, reset, start } = useStudyTimer();

  const [open, setOpen] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timerReviewMode, setTimerReviewMode] = useState(false);
  const speedDialRef = useRef<HTMLDivElement>(null);

  // Dados carregados
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  // Seleções principais
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [dateOption, setDateOption] = useState<'today' | 'yesterday' | 'other'>('today');
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Categorias ativas
  const [activeCategories, setActiveCategories] = useState({
    questoes: false,
    paginas: false,
    videoaulas: true,
    revisoes: false,
  });

  // Métricas adicionais do formulário
  const [material, setMaterial] = useState('Aula 01');
  const [theoryFinished, setTheoryFinished] = useState(true);
  const [programRevisions, setProgramRevisions] = useState(true);
  const [revisions] = useState(['1d', '7d', '30d', '60d', '120d', '245d']);
  const [disabledRevisions, setDisabledRevisions] = useState<Set<string>>(new Set());

  const [correctQuestions, setCorrectQuestions] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState(0);
  const [startPage, setStartPage] = useState(0);
  const [endPage, setEndPage] = useState(0);
  const [comments, setComments] = useState('');
  const [manualDuration, setManualDuration] = useState('01:00');
  const [videoTitle, setVideoTitle] = useState('Vídeo 01');
  const [videoStartTime, setVideoStartTime] = useState('00:00:00');
  const [videoEndTime, setVideoEndTime] = useState('00:00:00');

  const [sessionStart, setSessionStart] = useState<string | null>(null);

  const selectedSubject = subjects.find(subject => subject.id === selectedSubjectId);
  const selectedTopic = topics.find(topic => topic.id === selectedTopicId);

  // Lógicas de visibilidade
  const isExercicios = activeCategories.questoes;
  const isPaginas = activeCategories.paginas;
  const isVideo = activeCategories.videoaulas;
  const isRevisoes = activeCategories.revisoes;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (speedDialRef.current && !speedDialRef.current.contains(event.target as Node)) {
        setSpeedDialOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openModalWithCategory = (category: 'videoaulas' | 'paginas' | 'questoes' | 'revisoes') => {
    setActiveCategories({
      videoaulas: category === 'videoaulas',
      paginas: category === 'paginas',
      questoes: category === 'questoes',
      revisoes: category === 'revisoes',
    });
    setSpeedDialOpen(false);
    setOpen(true);
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

    if (!isExercicios && !isPaginas && !isVideo && !isRevisoes) {
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
    setTimerReviewMode(false);
  };

  // Converte segundos decorridos em HH:MM e abre o modal para revisão
  const handleStopTimer = () => {
    pause();
    const totalSecs = elapsedSeconds;
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    setManualDuration(`${hh}:${mm}`);
    setTimerReviewMode(true);
    setOpen(true);
  };

  const getResolvedDate = () => {
    const now = new Date();
    if (dateOption === 'yesterday') {
      now.setDate(now.getDate() - 1);
      return now.toISOString();
    }
    if (dateOption === 'other' && customDate) {
      return new Date(`${customDate}T12:00:00`).toISOString();
    }
    return now.toISOString();
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
      const resolvedDateStr = getResolvedDate();
      const now = new Date().toISOString();
      const [manualHours, manualMinutes] = manualDuration.split(':').map(Number);
      const manualDurationMinutes = (manualHours || 0) * 60 + (manualMinutes || 0);
      const durationMinutes = (sessionStart && !timerReviewMode)
        ? Math.max(1, minutes || Math.ceil(elapsedSeconds / 60))
        : Math.max(1, manualDurationMinutes);

      let sessionType: 'questions' | 'reading' | 'video' | 'revision' = 'video';
      const activeCount = Object.values(activeCategories).filter(Boolean).length;
      if (isRevisoes || activeCount > 1) sessionType = 'revision';
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
        startedAt: sessionStart ?? resolvedDateStr,
        endedAt: resolvedDateStr,
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

      const totalQuestoes = correctQuestions + wrongQuestions;
      if (isExercicios && totalQuestoes > 0) {
        const dateStr = resolvedDateStr.slice(0, 10);
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
          createdAt: now,
        });
      }

      if (theoryFinished && selectedTopic) {
        const updatedProgress = { ...selectedTopic.progress };
        for (const key of Object.keys(updatedProgress) as Array<keyof typeof updatedProgress>) {
          updatedProgress[key] = {
            ...updatedProgress[key],
            status: 'completed',
            completedAt: resolvedDateStr,
          };
        }
        await updateTopic(selectedPlanId, selectedSubjectId, selectedTopic.id, { progress: updatedProgress });
      } else if (!theoryFinished && selectedTopic) {
        // Mesmo sem finalizar a teoria, marca os itens estudados como "em andamento"
        // (apenas se ainda estiverem "não iniciados", para não rebaixar um "concluído")
        const categoryToProgressKey: Partial<Record<keyof typeof activeCategories, keyof TopicProgress>> = {
          videoaulas: 'video',
          paginas: 'pdf',
          questoes: 'questions',
          revisoes: 'revision',
        };

        const updatedProgress = { ...selectedTopic.progress };
        let needsUpdate = false;

        for (const [category, progressKey] of Object.entries(categoryToProgressKey) as Array<[keyof typeof activeCategories, keyof TopicProgress]>) {
          if (activeCategories[category] && updatedProgress[progressKey]?.status === 'not_started') {
            updatedProgress[progressKey] = {
              ...updatedProgress[progressKey],
              status: 'in_progress',
            };
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await updateTopic(selectedPlanId, selectedSubjectId, selectedTopic.id, { progress: updatedProgress });
        }
      }

      if (isRevisoes && selectedTopic && selectedTopic.progress?.revision) {
        const updatedProgress = {
          ...selectedTopic.progress,
          revision: {
            ...selectedTopic.progress.revision,
            status: 'completed' as const,
            completedAt: resolvedDateStr,
          },
        };
        await updateTopic(selectedPlanId, selectedSubjectId, selectedTopic.id, { progress: updatedProgress });
      }

      const activeRevisions = revisions.filter(r => !disabledRevisions.has(r));
      if (programRevisions && selectedTopic && selectedSubject && activeRevisions.length > 0) {
        const sessionDateStr = resolvedDateStr.slice(0, 10);
        const sessionDate = new Date(`${sessionDateStr}T12:00:00`);

        for (const rev of activeRevisions) {
          const days = parseInt(rev, 10);
          if (isNaN(days) || days < 1) continue;

          const reviewDate = new Date(sessionDate);
          reviewDate.setDate(reviewDate.getDate() + days);
          const nextReview = reviewDate.toISOString().split('T')[0];

          const existing = await getReviewCard(user.uid, selectedTopic.id);
          if (existing) {
            if (nextReview < existing.nextReview) {
              await updateReviewCard(existing.id, { nextReview, updatedAt: now });
            }
          } else {
            await createReviewCard({
              userId: user.uid,
              planId: selectedPlanId,
              subjectId: selectedSubject.id,
              subjectName: selectedSubject.name,
              subjectColor: selectedSubject.color,
              topicId: selectedTopic.id,
              topicName: selectedTopic.name,
              nextReview,
              interval: days,
              easeFactor: 2.5,
              repetitions: 0,
              lastReview: sessionDateStr,
              createdAt: now,
              updatedAt: now,
            });
            break;
          }
        }
      }
      toast.success(`Sessão registrada: ${durationMinutes}min`);
      handleCancel();
      setTimerReviewMode(false);
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível registrar a sessão');
    } finally {
      setSaving(false);
    }
  };

  const toggleRevisionDay = (day: string) => {
    setDisabledRevisions(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  return (
    <>
      {/* SPEED DIAL FAB */}
      {!sessionStart && (
        <div ref={speedDialRef} className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 lg:bottom-7 lg:right-7">
          {speedDialOpen && (
            <div className="flex flex-col items-end gap-2 mb-1 animate-fade-in">
              <button
                type="button"
                onClick={() => openModalWithCategory('revisoes')}
                className="flex items-center gap-2 rounded-sm bg-white border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 shadow-md transition-all hover:bg-gray-50 hover:scale-105"
              >
                <span>Revisão</span>
                <RotateCcw className="h-4 w-4 text-primary" />
              </button>
              <button
                type="button"
                onClick={() => openModalWithCategory('questoes')}
                className="flex items-center gap-2 rounded-sm bg-white border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 shadow-md transition-all hover:bg-gray-50 hover:scale-105"
              >
                <span>Questões</span>
                <HelpCircle className="h-4 w-4 text-primary" />
              </button>
              <button
                type="button"
                onClick={() => openModalWithCategory('paginas')}
                className="flex items-center gap-2 rounded-sm bg-white border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 shadow-md transition-all hover:bg-gray-50 hover:scale-105"
              >
                <span>PDF / Leitura</span>
                <BookOpen className="h-4 w-4 text-primary" />
              </button>
              <button
                type="button"
                onClick={() => openModalWithCategory('videoaulas')}
                className="flex items-center gap-2 rounded-sm bg-white border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 shadow-md transition-all hover:bg-gray-50 hover:scale-105"
              >
                <span>Videoaulas</span>
                <Video className="h-4 w-4 text-primary" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSpeedDialOpen(!speedDialOpen)}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-sm border shadow-xl',
              'border-primary/30 bg-primary text-white transition-all duration-200 hover:scale-105 hover:bg-secondary-foreground'
            )}
            aria-label="Menu de estudo"
          >
            {speedDialOpen ? (
              <X className="h-6 w-6 transition-transform rotate-90" />
            ) : (
              <Clock3 className="h-6 w-6" />
            )}
          </button>
        </div>
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
              className="flex h-16 w-16 items-center justify-center rounded-sm bg-white text-black transition hover:scale-105 shadow-lg"
              title={isRunning ? 'Pausar' : 'Retomar'}
            >
              {isRunning ? <Pause className="h-8 w-8 text-black" /> : <Play className="h-8 w-8 text-black ml-1" />}
            </button>

            <button
              onClick={handleStopTimer}
              className="flex h-16 w-16 items-center justify-center rounded-sm bg-primary text-white transition hover:scale-105 hover:bg-secondary-foreground shadow-lg"
              title="Parar e revisar sessão"
            >
              <Square className="h-7 w-7 fill-white" />
            </button>

            <button
              onClick={handleCancel}
              className="flex h-12 w-12 items-center justify-center rounded-sm bg-white/10 text-gray-300 transition hover:bg-white/20"
              title="Cancelar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen && timerReviewMode) {
          // Modal fechado sem salvar enquanto o cronômetro estava ativo
          // Mantém a sessão pausada — usuário pode retomar ou cancelar pelo overlay
          setOpen(false);
        } else {
          setOpen(isOpen);
        }
      }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl w-[95vw] p-5 sm:p-6 bg-white rounded-sm text-gray-800">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-800">
              {timerReviewMode ? 'Revisar Sessão' : 'Registro de Estudo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* BANNER: sessão vinda do cronômetro */}
            {timerReviewMode && (
              <div className="flex items-center gap-3 rounded-sm bg-primary/10 border border-primary/30 px-4 py-3">
                <Clock3 className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary uppercase tracking-wide">Tempo cronometrado</p>
                  <p className="text-sm font-semibold text-gray-700">{formatted} registrados — ajuste se necessário</p>
                </div>
              </div>
            )}
            {/* SELEÇÃO DE DATA COM INPUT SEMPRE VISÍVEL AO LADO DE "OUTRO" */}
            <div className="flex flex-wrap items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-500 hidden sm:block" />
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant={dateOption === 'today' ? 'default' : 'outline'}
                  onClick={() => setDateOption('today')}
                  className="h-8 px-4 text-xs font-semibold uppercase tracking-wider rounded-sm"
                >
                  Hoje
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={dateOption === 'yesterday' ? 'default' : 'outline'}
                  onClick={() => setDateOption('yesterday')}
                  className="h-8 px-4 text-xs font-semibold uppercase tracking-wider rounded-sm"
                >
                  Ontem
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={dateOption === 'other' ? 'default' : 'outline'}
                  onClick={() => setDateOption('other')}
                  className="h-8 px-4 text-xs font-semibold uppercase tracking-wider rounded-sm"
                >
                  Outro
                </Button>
                <Input
                  type="date"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  disabled={dateOption !== 'other'}
                  className={cn('w-40 h-8 text-xs', dateOption !== 'other' && 'opacity-50 cursor-not-allowed')}
                />
              </div>
            </div>

            {/* LINHA 1: DISCIPLINA E TEMPO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-400 uppercase">Disciplina</Label>
                <Select value={selectedSubjectId} onValueChange={value => value && setSelectedSubjectId(value)}>
                  <SelectTrigger className="w-full truncate">
                    <SelectValue placeholder="Selecione uma matéria" className={'truncate block lowercase first-letter:uppercase'}>
                      {subjects.find(p => p.id === selectedSubjectId)?.name ?? "Selecione uma matéria"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60 w-[280px]">
                    <SelectGroup>
                      <SelectLabel>Disciplinas</SelectLabel>
                      {subjects.map(subject => {
                        const formattedName = subject.name.charAt(0).toUpperCase() + subject.name.slice(1).toLowerCase();

                        return (
                          <SelectItem key={subject.id} value={subject.id} className="truncate">
                            {formattedName}
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-400 uppercase">Tempo de Estudo</Label>
                <Input
                  type="time"
                  step="60"
                  value={manualDuration}
                  onChange={event => setManualDuration(event.target.value)}
                  className="w-full"
                  aria-label="Tempo de estudo manual"
                />
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
                    <SelectValue placeholder="Selecione um tópico" className={'truncate block lowercase first-letter:uppercase'}>
                      {topics.find(p => p.id === selectedTopicId)?.name ?? "Selecione um tópico"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60 w-[280px]">
                    <SelectGroup>
                      <SelectLabel>Disciplinas</SelectLabel>
                      {topics.map(topic => {
                        const formattedName = topic.name.charAt(0).toUpperCase() + topic.name.slice(1).toLowerCase();

                        return (
                          <SelectItem key={topic.id} value={topic.id} className="truncate">
                            {formattedName}
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-400 uppercase">Material</Label>
                <Input
                  type="text"
                  value={material}
                  onChange={e => setMaterial(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {/* CHECKBOXES E REVISÕES */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="theory-finished"
                    checked={theoryFinished}
                    onCheckedChange={(checked) => {
                      setTheoryFinished(!!checked);
                      if (checked) {
                        setActiveCategories(prev => ({ ...prev, videoaulas: true, paginas: true }));
                      }
                    }}
                  />
                  <Label htmlFor="theory-finished" className="cursor-pointer text-xs font-bold text-gray-600 uppercase">
                    Teoria Finalizada
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="program-revisions"
                    checked={programRevisions}
                    onCheckedChange={(checked) => {
                      const isChecked = !!checked;
                      setProgramRevisions(isChecked);
                      // Marcar → todas ativas (X); Desmarcar → todas desativadas (○)
                      setDisabledRevisions(isChecked ? new Set() : new Set(revisions));
                    }}
                  />
                  <Label htmlFor="program-revisions" className="cursor-pointer text-xs font-bold text-gray-600 uppercase">
                    Programar Revisões
                  </Label>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center pt-1">
                {revisions.map(day => {
                  const isDisabled = disabledRevisions.has(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleRevisionDay(day)}
                      aria-label={isDisabled ? `Ativar revisão de ${day}` : `Desativar revisão de ${day}`}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-medium transition-all',
                        isDisabled
                          ? 'bg-muted text-muted-foreground line-through'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      )}
                    >
                      {day}
                      {isDisabled
                        ? <Circle className="h-3 w-3" />
                        : <X className="h-3 w-3" />
                      }
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CAMPOS DINÂMICOS BASEADOS NA CATEGORIA SELECIONADA */}
            <div className="space-y-3 pt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase">Métricas da Seção</p>

              {isVideo && (
                <div className="border-2 border-primary/20 rounded-sm bg-blue-50/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-gray-700">
                    <Video className="h-4 w-4 text-primary" />
                    <span>Videoaulas (Título / Minutagem)</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-center items-end gap-3">
                    <div className="w-full sm:w-1/2 space-y-1.5">
                      <Label htmlFor="video-title" className="text-xs uppercase text-muted-foreground font-semibold">Título do Vídeo</Label>
                      <Input
                        id="video-title"
                        type="text"
                        value={videoTitle}
                        onChange={event => setVideoTitle(event.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 w-full sm:w-1/2">
                      <div className="space-y-1.5">
                        <Label htmlFor="video-start" className="text-xs uppercase text-muted-foreground font-semibold">Início</Label>
                        <Input
                          id="video-start"
                          type="time"
                          step="1"
                          value={videoStartTime}
                          onChange={event => setVideoStartTime(event.target.value)}
                          className="font-mono text-center"
                        />
                      </div>
                      <span className="text-muted-foreground font-light pb-2">–</span>
                      <div className="space-y-1.5">
                        <Label htmlFor="video-end" className="text-xs uppercase text-muted-foreground font-semibold">Fim</Label>
                        <Input
                          id="video-end"
                          type="time"
                          step="1"
                          value={videoEndTime}
                          onChange={event => setVideoEndTime(event.target.value)}
                          className="font-mono text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isPaginas && (
                <div className="border-2 border-primary/20 rounded-sm bg-blue-50/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-gray-700">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span>Páginas Lidas (Início / Fim)</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="start-page" className="text-xs uppercase text-muted-foreground font-semibold">Pág. Inicial</Label>
                      <Input
                        id="start-page"
                        type="number"
                        min={0}
                        value={startPage}
                        onChange={e => setStartPage(Number(e.target.value))}
                        className="text-center font-bold text-base"
                      />
                    </div>
                    <span className="text-muted-foreground text-xl font-light pb-2">–</span>
                    <div className="space-y-1.5">
                      <Label htmlFor="end-page" className="text-xs uppercase text-muted-foreground font-semibold">Pág. Final</Label>
                      <Input
                        id="end-page"
                        type="number"
                        min={0}
                        value={endPage}
                        onChange={e => setEndPage(Number(e.target.value))}
                        className="text-center font-bold text-base"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isExercicios && (
                <div className="border-2 border-primary/20 rounded-sm bg-blue-50/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-gray-700">
                    <HelpCircle className="h-4 w-4 text-primary" />
                    <span>Questões (Acertos / Erros)</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="correct-questions" className="text-xs font-semibold uppercase text-green-600">
                        Acertos
                      </Label>
                      <Input
                        id="correct-questions"
                        type="number"
                        min={0}
                        value={correctQuestions}
                        onChange={e => setCorrectQuestions(Number(e.target.value))}
                        className="text-center font-bold text-base focus-visible:ring-green-500 border-green-400"
                      />
                    </div>
                    <span className="text-gray-400 text-xl font-light pb-2">/</span>
                    <div className="space-y-1.5">
                      <Label htmlFor="wrong-questions" className="text-xs font-semibold uppercase text-red-500">
                        Erros
                      </Label>
                      <Input
                        id="wrong-questions"
                        type="number"
                        min={0}
                        value={wrongQuestions}
                        onChange={e => setWrongQuestions(Number(e.target.value))}
                        className="text-center font-bold text-base focus-visible:ring-red-400 border-red-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isRevisoes && (
                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>Sessão de Revisão</AlertTitle>
                  <AlertDescription>
                    Esta sessão será registrada e contabilizada como estudo de Revisão.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* COMENTÁRIOS */}
            <div className="space-y-1 pt-2">
              <Label className="text-xs font-semibold text-gray-400 uppercase">Comentários</Label>
              <Textarea
                rows={2}
                value={comments}
                onChange={e => setComments(e.target.value)}
                className="w-full"
              />
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between pt-4 border-t gap-4">
              {!timerReviewMode ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleStart}
                  className="w-full sm:w-auto gap-2 text-secondary-foreground font-semibold hover:text-blue-700"
                >
                  <Play className="h-4 w-4 fill-secondary-foreground" />
                  Iniciar Cronômetro
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setOpen(false); start(); }}
                  className="w-full sm:w-auto gap-2 text-secondary-foreground font-semibold hover:text-blue-700"
                >
                  <Play className="h-4 w-4 fill-secondary-foreground" />
                  Retomar Cronômetro
                </Button>
              )}

              <div className="flex w-full sm:w-auto items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="flex-1 sm:flex-none rounded-sm border-primary text-secondary-foreground hover:bg-blue-50 px-6"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving || !selectedPlanId || !selectedSubjectId}
                  className="flex-1 sm:flex-none rounded-sm bg-primary hover:bg-secondary-foreground text-white px-8"
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