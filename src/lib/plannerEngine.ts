import { differenceInCalendarDays, addDays, format, startOfDay } from 'date-fns';
import type { Subject, StudySession, WeeklyGoal, PlannerStats, SubjectStat, StudyPlan } from '@/types';
import { getDayOfWeek, getSubjectProgressPercent } from './helpers';

const DEFAULT_WEEKLY_GOAL: WeeklyGoal = {
  monday: 3,
  tuesday: 3,
  wednesday: 3,
  thursday: 3,
  friday: 3,
  saturday: 5,
  sunday: 2,
};

/**
 * Calcula quantas horas estão disponíveis até a data da prova,
 * considerando a meta semanal e dias bloqueados.
 */
export function calculateAvailableHours(
  examDate: string,
  weeklyGoal: WeeklyGoal = DEFAULT_WEEKLY_GOAL,
  blockedDays: string[] = []
): number {
  const today = startOfDay(new Date());
  const exam = startOfDay(new Date(examDate));
  const days = differenceInCalendarDays(exam, today);

  if (days <= 0) return 0;

  let totalHours = 0;
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const iso = format(date, 'yyyy-MM-dd');
    if (blockedDays.includes(iso)) continue;

    const dow = getDayOfWeek(date) as keyof WeeklyGoal;
    totalHours += weeklyGoal[dow] ?? 0;
  }

  return totalHours;
}

/**
 * Calcula horas estudadas por matéria a partir do histórico de sessões.
 */
export function calcHoursPerSubject(sessions: StudySession[]): Record<string, number> {
  return sessions.reduce((acc, s) => {
    acc[s.subjectId] = (acc[s.subjectId] ?? 0) + (s.durationMinutes / 60);
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Calcula horas estudadas hoje.
 */
export function calcTodayHours(sessions: StudySession[]): number {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  return sessions
    .filter(s => s.startedAt.startsWith(todayStr))
    .reduce((acc, s) => acc + s.durationMinutes / 60, 0);
}

/**
 * Calcula o streak de dias consecutivos estudados.
 */
export function calcStreak(sessions: StudySession[]): number {
  if (sessions.length === 0) return 0;

  const studiedDays = new Set(
    sessions.map(s => format(new Date(s.startedAt), 'yyyy-MM-dd'))
  );

  let streak = 0;
  let current = startOfDay(new Date());

  while (true) {
    const iso = format(current, 'yyyy-MM-dd');
    if (!studiedDays.has(iso)) break;
    streak++;
    current = addDays(current, -1);
  }

  return streak;
}

/**
 * Motor principal de planejamento adaptativo.
 */
export function calculatePlannerStats(params: {
  plan: StudyPlan;
  subjects: Array<Subject & { topics: Array<{ progress: any }> }>;
  sessions: StudySession[];
}): PlannerStats {
  const { plan, subjects, sessions } = params;
  const examDate = plan.examDate;
  const weeklyGoal = plan.dailyGoalHours ?? DEFAULT_WEEKLY_GOAL;

  const daysUntilExam = examDate
    ? Math.max(0, differenceInCalendarDays(new Date(examDate), new Date()))
    : 0;
  const totalAvailableHours = examDate
    ? calculateAvailableHours(examDate, weeklyGoal)
    : 0;
  const totalHoursStudied = sessions.reduce((acc, s) => acc + s.durationMinutes / 60, 0);
  const hoursPerSubject = calcHoursPerSubject(sessions);

  const totalWeight = subjects.reduce((acc, s) => acc + s.weight, 0) || 100;
  let weightedProgress = 0;

  const subjectStats: SubjectStat[] = subjects.map(subject => {
    const progressPercent = getSubjectProgressPercent(subject.topics);
    const hoursStudied = hoursPerSubject[subject.id] ?? 0;
    const normalizedWeight = subject.weight / totalWeight;
    const recommendedHours = totalAvailableHours * normalizedWeight;
    const remainingHours = Math.max(0, recommendedHours - hoursStudied);
    const hoursPerDay = daysUntilExam > 0 ? remainingHours / daysUntilExam : 0;

    weightedProgress += progressPercent * normalizedWeight;

    return {
      subject,
      topics: subject.topics as any,
      progressPercent,
      hoursStudied,
      recommendedHours,
      remainingHours,
      hoursPerDay,
      isOnTrack: hoursStudied >= recommendedHours * (1 - daysUntilExam / (daysUntilExam + 30)),
    };
  });

  return {
    plan,
    daysUntilExam,
    totalAvailableHours,
    totalHoursStudied,
    overallProgress: Math.round(weightedProgress),
    subjectStats,
  };
}
