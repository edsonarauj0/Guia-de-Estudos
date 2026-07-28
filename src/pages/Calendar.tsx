import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths, eachDayOfInterval, endOfMonth,
  format, getDay, isSameMonth, parseISO, startOfMonth, subMonths,
  startOfWeek, endOfWeek, addWeeks, subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock,
  Flag, Info, Layers3, Trophy, AlertCircle,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { usePlanContext } from "@/contexts/PlanContext";
import {
  getStudyPlans, getSubjects, getTopics,
  getStudyCycles, getSessions,
} from "@/lib/firestore";
import { buildCalendarPlan } from "@/lib/calendarEngine";
import type { CalendarDay, CalendarSlot, CycleSummary } from "@/lib/calendarEngine";
import type { StudyPlan } from "@/types";
import { formatDuration, getTopicProgressPercent } from "@/lib/helpers"; // Import do getTopicProgressPercent
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ─── constants ────────────────────────────────────────────────

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const CYCLE_PALETTE = [
  { badge: "bg-violet-500/20 text-violet-400 border-violet-500/30", ring: "#8b5cf6" },
  { badge: "bg-sky-500/20 text-sky-400 border-sky-500/30", ring: "#0ea5e9" },
  { badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", ring: "#22c55e" },
  { badge: "bg-amber-500/20 text-amber-400 border-amber-500/30", ring: "#f59e0b" },
  { badge: "bg-rose-500/20 text-rose-400 border-rose-500/30", ring: "#f43f5e" },
  { badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", ring: "#06b6d4" },
  { badge: "bg-orange-500/20 text-orange-400 border-orange-500/30", ring: "#f97316" },
  { badge: "bg-pink-500/20 text-pink-400 border-pink-500/30", ring: "#ec4899" },
];

function cyclePalette(n: number) {
  return CYCLE_PALETTE[(n - 1) % CYCLE_PALETTE.length];
}

// ─── merge slots by subject ───────────────────────────────────

interface MergedSlot {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  minutes: number;
  topics: string[];
  cycleNumber: number;
}

function mergeBySubject(slots: CalendarSlot[]): MergedSlot[] {
  const map = new Map<string, MergedSlot>();
  for (const s of slots) {
    const key = `${s.cycleNumber}-${s.subjectId}`;
    const ex = map.get(key);
    if (ex) {
      ex.minutes += s.minutes;
      if (s.topicName && !ex.topics.includes(s.topicName)) ex.topics.push(s.topicName);
    } else {
      map.set(key, {
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        subjectColor: s.subjectColor,
        minutes: s.minutes,
        topics: s.topicName ? [s.topicName] : [],
        cycleNumber: s.cycleNumber,
      });
    }
  }
  return Array.from(map.values());
}

// ─── DayCell ─────────────────────────────────────────────────

function DayCell({ 
  day, 
  inMonth, 
  onClick,
  completedTopics 
}: {
  day: CalendarDay;
  inMonth: boolean;
  onClick: () => void;
  completedTopics: Set<string>;
}) {
  const merged = useMemo(() => mergeBySubject(day.plannedSlots), [day.plannedSlots]);
  const shown = merged.slice(0, 2);
  const extra = merged.length - shown.length;
  const dateNum = parseInt(day.date.slice(8), 10);
  const cycleNum = day.cycleStarts[0] ?? day.plannedSlots[0]?.cycleNumber;
  const pal = cycleNum ? cyclePalette(cycleNum) : null;

  return (
    <button
      onClick={inMonth ? onClick : undefined}
      className={[
        "relative flex min-h-[96px] w-full flex-col rounded-sm border p-1.5 text-left",
        "transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary",
        inMonth
          ? "hover:border-primary/50 hover:shadow-sm"
          : "pointer-events-none opacity-25",
        day.isToday && "border-primary bg-primary/5",
        day.isExamDay && "border-red-500 bg-red-500/10",
        day.isPast && !day.isToday && !day.isExamDay && "bg-muted/20",
        !day.isStudyDay && !day.isExamDay && !day.isPast && "bg-muted/10",
        !day.isToday && !day.isExamDay && "border-border",
      ].filter(Boolean).join(" ")}
    >
      <div className="mb-1 flex items-center gap-1">
        <span className={[
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[11px] font-bold",
          day.isToday && "bg-primary text-primary-foreground",
          day.isExamDay && "bg-red-500 text-white",
          !day.isToday && !day.isExamDay && "text-foreground",
        ].filter(Boolean).join(" ")}>
          {dateNum}
        </span>
        {day.isExamDay && <Trophy className="h-3 w-3 text-red-400" />}
        {day.cycleStarts.map(n => (
          <span
            key={n}
            className={`rounded-sm border px-1 py-px text-[8px] font-bold leading-none ${cyclePalette(n).badge}`}
          >
            C{n}
          </span>
        ))}
        {day.cycleEnds.length > 0 && !day.cycleStarts.length && (
          <Flag className="h-2.5 w-2.5 text-muted-foreground" />
        )}
      </div>

      {/* Mini barra de histórico real do dia */}
      {day.isPast && day.isStudyDay && (
        <div className="mb-1 flex items-center gap-1">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, day.availableMinutes > 0 ? (day.historicalMinutes / day.availableMinutes) * 100 : 0)}%` }}
            />
          </div>
          {day.historicalMinutes > 0 && (
            <span className="text-[9px] text-muted-foreground">{day.historicalMinutes}m</span>
          )}
        </div>
      )}

      {/* Blocos planejados (Matérias/Tópicos) */}
      {shown.length > 0 && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {shown.map((s, i) => {
            const hasTopics = s.topics.length > 0;
            // Um bloco é considerado cinza se TODOS os tópicos listados nele já foram estudados 100%
            const allTopicsStudied = hasTopics && s.topics.every(t => completedTopics.has(`${s.subjectId}-${t}`));
            // Caso não tenha tópico atrelado, deixamos cinza apenas se for um dia passado.
            const isBlockGray = allTopicsStudied || (!hasTopics && day.isPast);

            return (
              <div
                key={i}
                className={`rounded-sm px-1 py-0.5 transition-colors ${isBlockGray ? "bg-muted/50" : ""}`}
                style={!isBlockGray ? {
                  background: s.subjectColor + "18",
                  borderLeft: `2px solid ${s.subjectColor}`,
                } : {
                  borderLeft: `2px solid hsl(var(--muted-foreground) / 0.3)`
                }}
              >
                <div className="flex items-baseline justify-between gap-0.5">
                  <span className={`truncate text-[9px] font-semibold leading-tight ${isBlockGray ? "text-muted-foreground line-through opacity-80" : "text-foreground"}`}>
                    {s.subjectName}
                  </span>
                  <span className="shrink-0 text-[8px] text-muted-foreground">{s.minutes}m</span>
                </div>
                {hasTopics && (
                  <p className="truncate text-[8px] leading-tight text-muted-foreground">
                    <span className={completedTopics.has(`${s.subjectId}-${s.topics[0]}`) ? "line-through opacity-60" : ""}>
                      {s.topics[0]}
                    </span>
                    {s.topics.length > 1 ? ` +${s.topics.length - 1}` : ""}
                  </p>
                )}
              </div>
            )
          })}
          {extra > 0 && (
            <span className="text-[8px] text-muted-foreground">+{extra} mat.</span>
          )}
        </div>
      )}

      {pal && !day.isPast && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 top-0 w-0.5 rounded-l-sm"
          style={{ backgroundColor: pal.ring }}
        />
      )}
    </button>
  );
}

// ─── DayDetail ───────────────────────────────────────────────

function DayDetailDialog({ day, open, onClose, completedTopics }: {
  day: CalendarDay | null; 
  open: boolean; 
  onClose: () => void;
  completedTopics: Set<string>;
}) {
  if (!day) return null;
  const label = format(parseISO(day.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const totalPlanned = day.plannedSlots.reduce((a, s) => a + s.minutes, 0);
  const merged = mergeBySubject(day.plannedSlots);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">{label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="flex flex-wrap gap-2">
            {day.isToday && <Badge variant="default">Hoje</Badge>}
            {day.isExamDay && <Badge variant="destructive" className="gap-1"><Trophy className="h-3 w-3" />Dia da Prova</Badge>}
            {!day.isStudyDay && !day.isExamDay && <Badge variant="secondary">Sem estudo programado</Badge>}
            {day.cycleStarts.map(n => (
              <Badge key={n} variant="outline" className={cyclePalette(n).badge}>
                Início do Ciclo {n}
              </Badge>
            ))}
            {day.cycleEnds.map(n => (
              <Badge key={n} variant="outline" className={cyclePalette(n).badge}>
                Fim do Ciclo {n}
              </Badge>
            ))}
          </div>

          {day.isPast && (
            <div className="rounded-sm border border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico real</p>
              <p className="mt-1 text-xl font-bold text-foreground">
                {day.historicalMinutes > 0 ? formatDuration(day.historicalMinutes) : "Não estudado"}
              </p>
              {day.isStudyDay && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Meta do dia: {formatDuration(day.availableMinutes)}
                </p>
              )}
            </div>
          )}

          {merged.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Planejado
                </p>
                <span className="text-xs font-bold text-foreground">{formatDuration(totalPlanned)}</span>
              </div>
              {merged.map((s, i) => {
                const hasTopics = s.topics.length > 0;
                const allTopicsStudied = hasTopics && s.topics.every(t => completedTopics.has(`${s.subjectId}-${t}`));
                const isBlockGray = allTopicsStudied || (!hasTopics && day.isPast);

                return (
                  <div
                    key={i}
                    className={`rounded-sm border p-3 ${isBlockGray ? "bg-muted/30 opacity-70" : ""}`}
                    style={!isBlockGray 
                      ? { borderLeftColor: s.subjectColor, borderLeftWidth: 3 } 
                      : { borderLeftColor: "hsl(var(--muted-foreground) / 0.4)", borderLeftWidth: 3 }
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${isBlockGray ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {s.subjectName}
                        </p>
                        {s.topics.map((t, ti) => {
                          const isTopicStudied = completedTopics.has(`${s.subjectId}-${t}`);
                          return (
                            <p key={ti} className={`mt-0.5 text-xs text-muted-foreground ${isTopicStudied ? "line-through opacity-80" : ""}`}>
                              • {t} {isTopicStudied && "(Concluído)"}
                            </p>
                          )
                        })}
                      </div>
                      <span className={`shrink-0 text-sm font-bold ${isBlockGray ? "text-muted-foreground" : "text-foreground"}`}>
                        {formatDuration(s.minutes)}
                      </span>
                    </div>
                    {s.cycleNumber && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        Ciclo {s.cycleNumber}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {merged.length === 0 && !day.isExamDay && (
            <p className="text-sm text-muted-foreground">
              {day.isStudyDay
                ? "Nenhum tópico alocado para este dia."
                : "Dia sem estudo configurado no plano."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cycle timeline ───────────────────────────────────────────

function CycleTimeline({ summaries, examDate }: { summaries: CycleSummary[]; examDate?: string }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  if (summaries.length === 0) return null;

  const totalPages = Math.ceil(summaries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const shown = summaries.slice(startIndex, startIndex + itemsPerPage);

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="glass rounded-sm p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Previsão de ciclos — {summaries.length} ciclos até {examDate ? format(parseISO(examDate), "dd/MM/yyyy") : "o fim"}
          </p>
        </div>
      </div>

      <div className="rounded-md border bg-background/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Ciclo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead className="text-center">Tópicos</TableHead>
              <TableHead>Matérias</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((cs) => {
              const pal = cyclePalette(cs.cycleNumber);
              return (
                <TableRow key={cs.cycleNumber}>
                  <TableCell>
                    <span className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-xs font-bold ${pal.badge}`}>
                      C{cs.cycleNumber}
                    </span>
                  </TableCell>
                  
                  <TableCell className="font-medium text-sm text-foreground">
                    {cs.cycleName}
                  </TableCell>
                  
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {cs.startDate ? format(parseISO(cs.startDate), "dd/MM/yy") : "—"}
                    {" → "}
                    {cs.endDate ? format(parseISO(cs.endDate), "dd/MM/yy") : "—"}
                  </TableCell>
                  
                  <TableCell className="text-xs font-semibold text-foreground">
                    {formatDuration(cs.totalMinutes)}
                  </TableCell>
                  
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {cs.topicCount}
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {cs.subjects.slice(0, 3).map((s) => (
                        <span key={s.id} className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px]">
                          {s.name}
                        </span>
                      ))}
                      {cs.subjects.length > 3 && (
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px]">
                          +{cs.subjects.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between px-2">
          <p className="text-xs text-muted-foreground">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentPage === 1}
              className="h-8"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="h-8"
            >
              Próximo
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────

export default function CalendarPage() {
  const { user } = useAuthContext();
  const { selectedPlanId: globalPlanId, plans: globalPlans, selectPlan } = usePlanContext();

  const [activePlanId, setActivePlanId] = useState(globalPlanId ?? "");
  const [allPlans, setAllPlans] = useState<StudyPlan[]>(globalPlans ?? []);
  
  // Lista de chaves (subjectId-topicName) dos tópicos estudados (100% progresso)
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());
  
  const [viewMode, setViewMode] = useState<"month" | "week">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kofre_calendar_view");
      if (saved === "month" || saved === "week") return saved;
    }
    return "month";
  });

  useEffect(() => {
    localStorage.setItem("kofre_calendar_view", viewMode);
  }, [viewMode]);

  const [baseDate, setBaseDate] = useState(new Date());
  
  const [calendarPlan, setCalendarPlan] = useState<ReturnType<typeof buildCalendarPlan> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadData = useCallback(async (planId: string) => {
    if (!user || !planId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [availPlans, rawSubjects, planCycles, planSessions] = await Promise.all([
        getStudyPlans(user.uid),
        getSubjects(planId),
        getStudyCycles(user.uid, planId),
        getSessions(user.uid, planId),
      ]);
      setAllPlans(availPlans);

      const subjectsWithTopics = await Promise.all(
        rawSubjects.map(async s => ({ ...s, topics: await getTopics(planId, s.id) }))
      );

      // --- LOGICA DE PROGRESSO: Salvar num Set quais tópicos estão 100% ---
      const newCompleted = new Set<string>();
      subjectsWithTopics.forEach(subject => {
        subject.topics.forEach(topic => {
          // Usa 100% de conclusão para considerar o tópico totalmente estudado
          if (getTopicProgressPercent(topic.progress) === 100) {
            newCompleted.add(`${subject.id}-${topic.name}`);
          }
        });
      });
      setCompletedTopics(newCompleted);
      // -------------------------------------------------------------------

      const plan = availPlans.find(p => p.id === planId);
      if (!plan) { setLoading(false); return; }

      const result = buildCalendarPlan({ plan, cycles: planCycles, subjectsWithTopics, sessions: planSessions });
      setCalendarPlan(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const id = globalPlanId ?? activePlanId;
    if (id) { setActivePlanId(id); loadData(id); }
  }, [globalPlanId, loadData]);

  const handlePlanChange = (id: string) => {
    if (!id) return;
    setActivePlanId(id);
    selectPlan(id);
    loadData(id);
  };

  const handlePrevDate = () => {
    if (viewMode === "month") setBaseDate(d => subMonths(d, 1));
    else setBaseDate(d => subWeeks(d, 1));
  };
  
  const handleNextDate = () => {
    if (viewMode === "month") setBaseDate(d => addMonths(d, 1));
    else setBaseDate(d => addWeeks(d, 1));
  };

  const { weekRows, dateLabel } = useMemo(() => {
    if (viewMode === "month") {
      const start = startOfMonth(baseDate);
      const end = endOfMonth(baseDate);
      const firstDow = getDay(start);
      const allDays = eachDayOfInterval({ start, end });
      const padded: (Date | null)[] = [...Array(firstDow).fill(null), ...allDays];
      const rem = padded.length % 7;
      if (rem > 0) for (let i = 0; i < 7 - rem; i++) padded.push(null);
      const rows: (Date | null)[][] = [];
      for (let i = 0; i < padded.length; i += 7) rows.push(padded.slice(i, i + 7));
      
      return { 
        weekRows: rows, 
        dateLabel: format(baseDate, "MMMM 'de' yyyy", { locale: ptBR }) 
      };
    } else {
      const start = startOfWeek(baseDate, { weekStartsOn: 0 }); 
      const end = endOfWeek(baseDate, { weekStartsOn: 0 });
      const allDays = eachDayOfInterval({ start, end });
      const rows = [allDays]; 

      const startMonth = format(start, "MMM", { locale: ptBR });
      const endMonth = format(end, "MMM", { locale: ptBR });
      
      let label = "";
      if (startMonth === endMonth) {
         label = `${format(start, "d")} a ${format(end, "d 'de' MMMM", { locale: ptBR })}`;
      } else {
         label = `${format(start, "d 'de' MMM", { locale: ptBR })} a ${format(end, "d 'de' MMM", { locale: ptBR })}`;
      }

      return { weekRows: rows, dateLabel: label };
    }
  }, [baseDate, viewMode]);

  const selectedPlan = allPlans.find(p => p.id === activePlanId);

  const handleDayClick = (date: Date) => {
    if (!calendarPlan) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const day = calendarPlan.days.get(dateStr);
    if (!day) return;
    setSelectedDay(day);
    setDetailOpen(true);
  };

  const daysUntilExam = useMemo(() => {
    if (!selectedPlan?.examDate) return null;
    const diff = Math.ceil((new Date(selectedPlan.examDate).getTime() - Date.now()) / 86400000);
    return Math.max(0, diff);
  }, [selectedPlan]);

  const totalPlannedHours = useMemo(() => {
    if (!calendarPlan) return 0;
    return Array.from(calendarPlan.days.values())
      .reduce((acc, d) => acc + d.plannedSlots.reduce((a, s) => a + s.minutes, 0), 0) / 60;
  }, [calendarPlan]);

  const futureStudyDays = useMemo(() => {
    if (!calendarPlan) return 0;
    return Array.from(calendarPlan.days.values())
      .filter(d => !d.isPast && d.isStudyDay && !d.isExamDay).length;
  }, [calendarPlan]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-sm bg-muted" />
        ))}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-sm bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
            <CalendarDays className="h-4 w-4" />
            Previsão completa de estudos
          </div>
          <h1 className="text-2xl font-bold text-foreground">Calendário</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedPlan?.name ?? "Selecione um planejamento"}
            {calendarPlan?.studyEndsDate
              ? ` · Estudos acabam em ${format(parseISO(calendarPlan.studyEndsDate), "dd/MM/yyyy")}`
              : ""}
          </p>
        </div>
      </div>

      {!selectedPlan?.examDate && (
        <div className="flex items-center gap-3 rounded-sm border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-foreground">
            Configure a <strong>data da prova</strong> nas Configurações para ver a previsão completa até o fim dos estudos.
          </p>
        </div>
      )}

      {calendarPlan && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="glass rounded-sm p-4">
            <Clock className="mb-2 h-4 w-4 text-primary" />
            <p className="text-xl font-bold">{Math.round(totalPlannedHours)}h</p>
            <p className="text-xs text-muted-foreground">horas planejadas</p>
          </div>
          <div className="glass rounded-sm p-4">
            <CalendarDays className="mb-2 h-4 w-4 text-sky-400" />
            <p className="text-xl font-bold">{futureStudyDays}</p>
            <p className="text-xs text-muted-foreground">dias de estudo</p>
          </div>
          <div className="glass rounded-sm p-4">
            <Layers3 className="mb-2 h-4 w-4 text-emerald-400" />
            <p className="text-xl font-bold">{calendarPlan.cycleSummaries.length}</p>
            <p className="text-xs text-muted-foreground">ciclos projetados</p>
          </div>
          <div className="glass rounded-sm p-4">
            <Trophy className="mb-2 h-4 w-4 text-amber-400" />
            <p className="text-xl font-bold">{daysUntilExam ?? "—"}</p>
            <p className="text-xs text-muted-foreground">dias até a prova</p>
          </div>
        </div>
      )}

      {calendarPlan && (
        <CycleTimeline summaries={calendarPlan.cycleSummaries} examDate={calendarPlan.examDate} />
      )}

      <div className="glass rounded-sm p-3 sm:p-5">
        
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <Button variant="ghost" size="icon" onClick={handlePrevDate}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-[160px] text-center text-base font-semibold capitalize">
              {dateLabel}
            </h2>
            <Button variant="ghost" size="icon" onClick={handleNextDate}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex bg-muted p-1 rounded-md max-w-fit self-end sm:self-auto">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${
                viewMode === 'week' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${
                viewMode === 'month' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mês
            </button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map(d => (
            <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div className="space-y-1">
          {weekRows.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((date, di) => {
                if (!date) return <div key={di} className="min-h-[96px]" />;
                const dateStr = format(date, "yyyy-MM-dd");
                const day = calendarPlan?.days.get(dateStr);
                
                const inMonth = viewMode === "month" ? isSameMonth(date, baseDate) : true;
                
                if (!day) {
                  return (
                    <div
                      key={di}
                      className={`min-h-[96px] rounded-sm border border-border p-1.5 ${!inMonth ? "opacity-25" : ""}`}
                    >
                      <span className="text-[11px] text-muted-foreground">{format(date, "d")}</span>
                    </div>
                  );
                }
                return (
                  <DayCell 
                    key={di} 
                    day={day} 
                    inMonth={inMonth} 
                    onClick={() => handleDayClick(date)} 
                    completedTopics={completedTopics} // <- Aqui passamos o que está concluído
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-primary" /> Hoje
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-red-500" /> Prova
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-border bg-muted/20" /> Passado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-l-2 border-violet-500 bg-background" /> Ciclo N
          </span>
          <span className="flex items-center gap-1.5">
            <Flag className="h-3 w-3" /> Fim do ciclo
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Info className="h-3 w-3" /> Clique em um dia para ver detalhes
          </span>
        </div>
      </div>

      <DayDetailDialog 
        day={selectedDay} 
        open={detailOpen} 
        onClose={() => setDetailOpen(false)} 
        completedTopics={completedTopics} 
      />
    </div>
  );
}