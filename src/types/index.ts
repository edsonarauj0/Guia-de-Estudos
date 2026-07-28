// ============================================================
// DOMAIN TYPES — Guia de Estudo v3
// ============================================================

// ─── AUTH / USER ─────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  dailyGoalQuestions: number;   // meta global de questões/dia
  createdAt: string;
  updatedAt: string;
}

// ─── STUDY PLAN ──────────────────────────────────────────────
export type PlanStatus = 'active' | 'paused' | 'archived';

export interface WeeklyGoal {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

export interface StudyPlan {
  id: string;
  userId: string;
  name: string;           // ex: "Concurso TRF" | "Inglês B2"
  examName?: string;      // ex: "TRF 5ª Região — Analista"
  examDate?: string;      // ISO datetime
  color: string;          // cor de identificação
  status: PlanStatus;
  dailyGoalHours: WeeklyGoal;
  dailyGoalQuestions?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── SUBJECT (subcoleção de studyPlans) ──────────────────────
// Path: studyPlans/{planId}/subjects/{subjectId}
export interface Subject {
  id: string;
  planId: string;
  name: string;
  color: string;
  weight: number;       // % no edital
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ─── TOPIC (subcoleção de subjects) ──────────────────────────
// Path: studyPlans/{planId}/subjects/{subjectId}/topics/{topicId}
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';
export type MediaType = 'video' | 'questions' | 'revision' | 'reading' | 'pdf';

export interface MediaProgress {
  status: ProgressStatus;
  completedAt?: string;
  notes?: string;
}

export interface TopicProgress {
  video: MediaProgress;
  pdf: MediaProgress;
  questions: MediaProgress;
  revision: MediaProgress;
}

export interface Topic {
  id: string;
  subjectId: string;
  planId: string;
  name: string;
  notes?: string;
  tags?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  order: number;
  progress: TopicProgress;
  createdAt: string;
  updatedAt: string;
}

// ─── STUDY SESSION ───────────────────────────────────────────
export type SessionType = MediaType;

export interface StudySession {
  id: string;
  userId: string;
  planId: string;
  subjectId: string;
  subjectName: string;
  topicId?: string;
  topicName?: string;
  type: SessionType;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  cycleId?: string;
  videoTitle?: string;
  videoStartedAt?: string;
  videoEndedAt?: string;
}

// ─── STUDY CYCLE ──────────────────────────────────────────────
// Um ciclo é uma sequência finita de sessões planejadas a partir dos tópicos.
export interface StudyCycleItem {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  topicId: string;
  topicName: string;
  plannedMinutes: number;
}

export interface StudyCycle {
  id: string;
  userId: string;
  planId: string;
  name: string;
  status: 'active' | 'planned' | 'completed' | 'archived';
  cycleNumber?: number;
  items: StudyCycleItem[];
  createdAt: string;
  updatedAt: string;
}

// ─── QUESTION LOG ─────────────────────────────────────────────
export type QuestionSessionType = 'practice' | 'exam' | 'review';

export interface QuestionLog {
  id: string;
  userId: string;
  planId: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  topicId?: string;
  topicName?: string;
  date: string;         // YYYY-MM-DD
  total: number;
  correct: number;
  wrong: number;
  notes?: string;
  sessionType: QuestionSessionType;
  createdAt: string;
}

// ─── REVIEW CARD (SM-2 spaced repetition) ───────────────────
// Por tópico — entra na fila quando o usuário avalia o tópico
export interface ReviewCard {
  id: string;
  userId: string;
  planId: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  topicId: string;
  topicName: string;
  nextReview: string;   // YYYY-MM-DD
  interval: number;     // dias até próxima revisão
  easeFactor: number;   // fator SM-2 (padrão 2.5)
  repetitions: number;
  lastReview?: string;
  lastQuality?: 0 | 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  updatedAt: string;
}

// ─── EXAM ────────────────────────────────────────────────────
export interface ExamResult {
  subjectId: string;
  subjectName: string;
  total: number;
  correct: number;
}

export interface Exam {
  id: string;
  userId: string;
  planId: string;
  name: string;
  date: string;
  totalQuestions: number;
  totalCorrect: number;
  results: ExamResult[];
  notes?: string;
  createdAt: string;
}

// ─── PLANNER (computed) ──────────────────────────────────────
export interface SubjectStat {
  subject: Subject;
  topics: Topic[];
  progressPercent: number;
  hoursStudied: number;
  recommendedHours: number;
  remainingHours: number;
  hoursPerDay: number;
  isOnTrack: boolean;
}

export interface PlannerStats {
  plan: StudyPlan;
  daysUntilExam: number;
  totalAvailableHours: number;
  totalHoursStudied: number;
  overallProgress: number;
  subjectStats: SubjectStat[];
}
