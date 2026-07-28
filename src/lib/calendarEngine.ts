import { addDays, format, startOfDay } from "date-fns";
import type { StudyCycle, StudyPlan, StudySession, Subject, Topic, WeeklyGoal } from "@/types";
import { getDayOfWeek } from "./helpers";

// ─── Public types ──────────────────────────────────────────────

export interface CalendarSlot {
  cycleNumber: number;
  cycleId?: string;
  cycleName: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  topicId?: string;
  topicName?: string;
  minutes: number;
}

export interface CalendarDay {
  date: string;
  isStudyDay: boolean;
  availableMinutes: number;
  plannedSlots: CalendarSlot[];
  historicalMinutes: number;
  cycleStarts: number[];
  cycleEnds: number[];
  isExamDay: boolean;
  isPast: boolean;
  isToday: boolean;
}

export interface CycleSummary {
  cycleNumber: number;
  cycleName: string;
  cycleId?: string;
  startDate: string;
  endDate: string;
  totalMinutes: number;
  subjects: { id: string; name: string; color: string }[];
  topicCount: number;
}

export interface CalendarPlan {
  days: Map<string, CalendarDay>;
  cycleSummaries: CycleSummary[];
  examDate?: string;
  studyEndsDate?: string;
}

// ─── Defaults ─────────────────────────────────────────────────

const DEFAULT_WEEKLY_GOAL: WeeklyGoal = {
  monday: 3,
  tuesday: 3,
  wednesday: 3,
  thursday: 3,
  friday: 3,
  saturday: 5,
  sunday: 2,
};

function minutesOnDay(date: Date, weeklyGoal: WeeklyGoal): number {
  const dow = getDayOfWeek(date) as keyof WeeklyGoal;
  return Math.round((weeklyGoal[dow] ?? 0) * 60);
}

// ─── Engine ───────────────────────────────────────────────────

interface DistItem {
  baseCycleNumber: number;
  cycleId?: string;
  baseCycleName: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  topicId?: string;
  topicName?: string;
  plannedMinutes: number;
}

export function buildCalendarPlan(params: {
  plan: StudyPlan;
  cycles: StudyCycle[];
  subjectsWithTopics: Array<Subject & { topics: Topic[] }>;
  sessions: StudySession[];
  horizonDays?: number;
}): CalendarPlan {
  const { plan, cycles, subjectsWithTopics, sessions, horizonDays = 548 } = params;

  const todayStr = format(startOfDay(new Date()), "yyyy-MM-dd");
  const examDateStr = plan.examDate ? plan.examDate.slice(0, 10) : null;
  const weeklyGoal: WeeklyGoal = {
    monday:    plan.dailyGoalHours?.monday    ?? DEFAULT_WEEKLY_GOAL.monday,
    tuesday:   plan.dailyGoalHours?.tuesday   ?? DEFAULT_WEEKLY_GOAL.tuesday,
    wednesday: plan.dailyGoalHours?.wednesday ?? DEFAULT_WEEKLY_GOAL.wednesday,
    thursday:  plan.dailyGoalHours?.thursday  ?? DEFAULT_WEEKLY_GOAL.thursday,
    friday:    plan.dailyGoalHours?.friday    ?? DEFAULT_WEEKLY_GOAL.friday,
    saturday:  plan.dailyGoalHours?.saturday  ?? DEFAULT_WEEKLY_GOAL.saturday,
    sunday:    plan.dailyGoalHours?.sunday    ?? DEFAULT_WEEKLY_GOAL.sunday,
  };

  // Historical minutes per date
  const historicalMap = new Map<string, number>();
  for (const s of sessions) {
    const d = s.startedAt.slice(0, 10);
    historicalMap.set(d, (historicalMap.get(d) ?? 0) + s.durationMinutes);
  }

  // Day map: 60 days back to examDate or horizon
  const mapStart = addDays(startOfDay(new Date()), -60);
  const rawEnd = examDateStr
    ? startOfDay(new Date(examDateStr + "T12:00:00"))
    : addDays(startOfDay(new Date()), horizonDays);

  const days = new Map<string, CalendarDay>();
  let cur = mapStart;
  while (cur <= rawEnd) {
    const d = format(cur, "yyyy-MM-dd");
    const avail = minutesOnDay(cur, weeklyGoal);
    days.set(d, {
      date: d,
      isStudyDay: avail > 0,
      availableMinutes: avail,
      plannedSlots: [],
      historicalMinutes: historicalMap.get(d) ?? 0,
      cycleStarts: [],
      cycleEnds: [],
      isExamDay: d === examDateStr,
      isPast: d < todayStr,
      isToday: d === todayStr,
    });
    cur = addDays(cur, 1);
  }

  // Future study days (not exam day, not past)
  const futureDays = Array.from(days.entries())
    .filter(([d, day]) => d >= todayStr && day.isStudyDay && d !== examDateStr)
    .sort(([a], [b]) => a.localeCompare(b));

  const remaining = new Map<string, number>(
    futureDays.map(([d, day]) => [d, day.availableMinutes])
  );

  // Build base template items (one full round of all cycles)
  const sortedCycles = [...cycles]
    .filter(c => c.status !== "archived")
    .sort((a, b) => (a.cycleNumber ?? 0) - (b.cycleNumber ?? 0));

  const baseItems: DistItem[] = [];
  const maxBaseCycleNum_ref = { val: 0 };

  if (sortedCycles.length > 0) {
    for (const cycle of sortedCycles) {
      const cn = cycle.cycleNumber ?? 1;
      if (cn > maxBaseCycleNum_ref.val) maxBaseCycleNum_ref.val = cn;
      for (const item of cycle.items) {
        baseItems.push({
          baseCycleNumber: cn,
          cycleId: cycle.id,
          baseCycleName: cycle.name,
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          subjectColor: item.subjectColor,
          topicId: item.topicId,
          topicName: item.topicName,
          plannedMinutes: item.plannedMinutes,
        });
      }
    }
  } else {
    // Auto-generate from subjects + weight
    const totalWeight = subjectsWithTopics.reduce((a, s) => a + s.weight, 0) || 100;
    const totalFutureMin = futureDays.reduce((a, [, d]) => a + d.availableMinutes, 0);
    const sortedSubs = [...subjectsWithTopics].sort((a, b) => b.weight - a.weight);
    maxBaseCycleNum_ref.val = 1;
    for (const sub of sortedSubs) {
      const subMin = Math.round((sub.weight / totalWeight) * totalFutureMin);
      const topicList = sub.topics.length > 0 ? sub.topics : [null];
      const minPerTopic = Math.max(30, Math.round(subMin / topicList.length));
      for (const topic of topicList) {
        baseItems.push({
          baseCycleNumber: 1,
          baseCycleName: "Ciclo 1 (auto)",
          subjectId: sub.id,
          subjectName: sub.name,
          subjectColor: sub.color,
          topicId: topic?.id,
          topicName: topic?.name,
          plannedMinutes: minPerTopic,
        });
      }
    }
  }

  if (baseItems.length === 0) {
    return { days, cycleSummaries: [], examDate: examDateStr ?? undefined };
  }

  const maxBaseCycleNum = maxBaseCycleNum_ref.val;
  const cycleSummaries: CycleSummary[] = [];
  const MAX_ROUNDS = 60;

  let dayIdx = 0;
  let cycleOffset = 0;
  let round = 0;

  const getOrCreateSummary = (cycleNumber: number, baseName: string, cycleId?: string, roundIdx = 0): CycleSummary => {
    let cs = cycleSummaries.find(c => c.cycleNumber === cycleNumber);
    if (!cs) {
      const label = roundIdx === 0 ? baseName : `${baseName} (${roundIdx + 1}ª vez)`;
      cs = {
        cycleNumber,
        cycleName: label,
        cycleId: roundIdx === 0 ? cycleId : undefined,
        startDate: "",
        endDate: "",
        totalMinutes: 0,
        subjects: [],
        topicCount: 0,
      };
      cycleSummaries.push(cs);
    }
    return cs;
  };

  outerLoop: while (dayIdx < futureDays.length && round < MAX_ROUNDS) {
    let anyDistributed = false;
    let lastCycleNum = -1;

    for (const base of baseItems) {
      if (dayIdx >= futureDays.length) break outerLoop;

      const actualCycleNum = base.baseCycleNumber + cycleOffset;

      // New cycle starts
      if (actualCycleNum !== lastCycleNum) {
        lastCycleNum = actualCycleNum;
        if (dayIdx < futureDays.length) {
          const firstDate = futureDays[dayIdx][0];
          const cs = getOrCreateSummary(actualCycleNum, base.baseCycleName, base.cycleId, round);
          if (!cs.startDate) {
            cs.startDate = firstDate;
            cs.endDate = firstDate;
            days.get(firstDate)!.cycleStarts.push(actualCycleNum);
          }
        }
      }

      let left = base.plannedMinutes;
      while (left > 0 && dayIdx < futureDays.length) {
        const [dateStr] = futureDays[dayIdx];
        const avail = remaining.get(dateStr) ?? 0;
        if (avail <= 0) { dayIdx++; continue; }

        const alloc = Math.min(left, avail);
        left -= alloc;
        remaining.set(dateStr, avail - alloc);

        days.get(dateStr)!.plannedSlots.push({
          cycleNumber: actualCycleNum,
          cycleId: base.cycleId,
          cycleName: getOrCreateSummary(actualCycleNum, base.baseCycleName, base.cycleId, round).cycleName,
          subjectId: base.subjectId,
          subjectName: base.subjectName,
          subjectColor: base.subjectColor,
          topicId: base.topicId,
          topicName: base.topicName,
          minutes: alloc,
        });

        const cs = getOrCreateSummary(actualCycleNum, base.baseCycleName, base.cycleId, round);
        cs.totalMinutes += alloc;
        cs.endDate = dateStr;
        if (!cs.subjects.some(s => s.id === base.subjectId))
          cs.subjects.push({ id: base.subjectId, name: base.subjectName, color: base.subjectColor });
        if (base.topicId) cs.topicCount += 1;

        anyDistributed = true;
        if ((remaining.get(dateStr) ?? 0) === 0) dayIdx++;
      }
    }

    if (!anyDistributed) break;

    cycleOffset += maxBaseCycleNum;
    round++;
  }

  // Mark cycle ends
  for (const cs of cycleSummaries) {
    if (cs.endDate) days.get(cs.endDate)?.cycleEnds.push(cs.cycleNumber);
  }

  // Study ends = last day with a planned slot
  let studyEndsDate: string | undefined;
  const allSlottedDays = Array.from(days.entries())
    .filter(([, d]) => d.plannedSlots.length > 0)
    .map(([d]) => d)
    .sort();
  if (allSlottedDays.length > 0) studyEndsDate = allSlottedDays[allSlottedDays.length - 1];

  return { days, cycleSummaries, examDate: examDateStr ?? undefined, studyEndsDate };
}
