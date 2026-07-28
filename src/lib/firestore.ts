import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  UserProfile,
  StudyPlan,
  Subject,
  Topic,
  StudySession,
  StudyCycle,
  QuestionLog,
  ReviewCard,
  Exam,
} from '@/types';
import { createInitialSM2Card, calculateSM2, type SM2Quality } from './sm2';

type FirestorePayload = Record<string, unknown>;

export interface SubjectImportInput {
  name: string;
  weight: number;
  topics: string[];
}

export interface SubjectImportResult {
  createdSubjects: number;
  reusedSubjects: number;
  createdTopics: number;
  skippedTopics: number;
}

const isPlainObject = (value: unknown): value is FirestorePayload => {
  return Object.prototype.toString.call(value) === '[object Object]';
};

const normalizeImportName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const omitUndefined = (data: FirestorePayload): FirestorePayload => {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        Array.isArray(value)
          ? value.filter(item => item !== undefined)
          : isPlainObject(value)
            ? omitUndefined(value)
            : value,
      ])
  );
};

const undefinedToDeleteField = (data: FirestorePayload): FirestorePayload => {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value === undefined ? deleteField() : value,
    ])
  );
};

// ─── USER PROFILE ─────────────────────────────────────────────
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function setUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

// ─── STUDY PLANS ──────────────────────────────────────────────
export async function getStudyPlans(userId: string): Promise<StudyPlan[]> {
  const q = query(collection(db, 'studyPlans'), where('userId', '==', userId));
  const snap = await getDocs(q);
  const plans = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyPlan));
  return plans.sort((a, b) => {
    const order = { active: 0, paused: 1, archived: 2 };
    return (order[a.status] - order[b.status]) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function getStudyPlan(planId: string): Promise<StudyPlan | null> {
  const snap = await getDoc(doc(db, 'studyPlans', planId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as StudyPlan;
}

export async function createStudyPlan(data: Omit<StudyPlan, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'studyPlans'), omitUndefined(data as unknown as FirestorePayload));
  return ref.id;
}

export async function updateStudyPlan(id: string, data: Partial<StudyPlan>): Promise<void> {
  await updateDoc(doc(db, 'studyPlans', id), {
    ...undefinedToDeleteField(data as FirestorePayload),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteStudyPlan(planId: string): Promise<void> {
  const subjectsSnap = await getDocs(collection(db, 'studyPlans', planId, 'subjects'));
  const batch = writeBatch(db);
  for (const subjectDoc of subjectsSnap.docs) {
    const topicsSnap = await getDocs(
      collection(db, 'studyPlans', planId, 'subjects', subjectDoc.id, 'topics')
    );
    topicsSnap.docs.forEach(t => batch.delete(t.ref));
    batch.delete(subjectDoc.ref);
  }
  batch.delete(doc(db, 'studyPlans', planId));
  await batch.commit();
}

export async function ensureActiveStudyPlan(userId: string): Promise<StudyPlan> {
  const plans = await getStudyPlans(userId);
  let active = plans.find(p => p.status === 'active');
  if (!active) {
    if (plans.length > 0) {
      active = plans[0];
      await updateStudyPlan(active.id, { status: 'active' });
    } else {
      const id = await createStudyPlan({
        userId,
        name: 'Plano Principal',
        color: '#6366f1',
        status: 'active',
        dailyGoalHours: { monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2, saturday: 4, sunday: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const snap = await getDoc(doc(db, 'studyPlans', id));
      active = { id, ...snap.data() } as StudyPlan;
    }
  }
  return active;
}

// ─── SUBJECTS (subcoleção de studyPlans) ─────────────────────
export async function getSubjects(planId: string): Promise<Subject[]> {
  const snap = await getDocs(collection(db, 'studyPlans', planId, 'subjects'));
  const subjects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
  return subjects.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function createSubject(planId: string, data: Omit<Subject, 'id' | 'planId'>): Promise<string> {
  const ref = await addDoc(collection(db, 'studyPlans', planId, 'subjects'), {
    ...data,
    planId,
  });
  return ref.id;
}

export async function updateSubject(planId: string, subjectId: string, data: Partial<Subject>): Promise<void> {
  await updateDoc(
    doc(db, 'studyPlans', planId, 'subjects', subjectId),
    { ...data, updatedAt: new Date().toISOString() }
  );
}

export async function deleteSubject(planId: string, subjectId: string): Promise<void> {
  const topicsSnap = await getDocs(
    collection(db, 'studyPlans', planId, 'subjects', subjectId, 'topics')
  );
  const batch = writeBatch(db);
  topicsSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'studyPlans', planId, 'subjects', subjectId));
  await batch.commit();
}

// ─── TOPICS (subcoleção de subjects) ─────────────────────────
export async function getTopics(planId: string, subjectId: string): Promise<Topic[]> {
  const snap = await getDocs(
    collection(db, 'studyPlans', planId, 'subjects', subjectId, 'topics')
  );
  const topics = snap.docs.map(d => ({ id: d.id, ...d.data() } as Topic));
  return topics.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function createTopic(
  planId: string,
  subjectId: string,
  data: Omit<Topic, 'id' | 'subjectId' | 'planId'>
): Promise<string> {
  const ref = await addDoc(
    collection(db, 'studyPlans', planId, 'subjects', subjectId, 'topics'),
    { ...data, subjectId, planId }
  );
  return ref.id;
}

export async function updateTopic(
  planId: string,
  subjectId: string,
  topicId: string,
  data: Partial<Topic>
): Promise<void> {
  await updateDoc(
    doc(db, 'studyPlans', planId, 'subjects', subjectId, 'topics', topicId),
    { ...data, updatedAt: new Date().toISOString() }
  );
}

export async function deleteTopic(planId: string, subjectId: string, topicId: string): Promise<void> {
  await deleteDoc(doc(db, 'studyPlans', planId, 'subjects', subjectId, 'topics', topicId));
}

// ─── SESSIONS ─────────────────────────────────────────────────
export async function getSessions(userId: string, planId?: string): Promise<StudySession[]> {
  const constraints: any[] = [where('userId', '==', userId)];
  if (planId) constraints.push(where('planId', '==', planId));
  const q = query(collection(db, 'sessions'), ...constraints);
  const snap = await getDocs(q);
  const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudySession));
  return sessions.sort((a, b) =>
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export async function createSession(data: Omit<StudySession, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'sessions'), data);
  return ref.id;
}

export async function updateSession(id: string, data: Partial<Omit<StudySession, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'sessions', id), data as Record<string, unknown>);
}

export async function deleteSession(id: string): Promise<void> {
  await deleteDoc(doc(db, 'sessions', id));
}

// ─── STUDY CYCLES ─────────────────────────────────────────────
export async function getStudyCycles(userId: string, planId?: string): Promise<StudyCycle[]> {
  const constraints: any[] = [where('userId', '==', userId)];
  if (planId) constraints.push(where('planId', '==', planId));
  const snap = await getDocs(query(collection(db, 'studyCycles'), ...constraints));
  const cycles = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyCycle));
  return cycles.sort((a, b) => (a.cycleNumber ?? 0) - (b.cycleNumber ?? 0) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function createStudyCycle(data: Omit<StudyCycle, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'studyCycles'), data);
  return ref.id;
}

export async function updateStudyCycle(id: string, data: Partial<StudyCycle>): Promise<void> {
  await updateDoc(doc(db, 'studyCycles', id), { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteStudyCycle(id: string): Promise<void> {
  await deleteDoc(doc(db, 'studyCycles', id));
}

// ─── QUESTION LOGS ────────────────────────────────────────────
export async function getQuestionLogs(userId: string, planId?: string): Promise<QuestionLog[]> {
  const constraints: any[] = [where('userId', '==', userId)];
  if (planId) constraints.push(where('planId', '==', planId));
  const q = query(collection(db, 'questionLogs'), ...constraints);
  const snap = await getDocs(q);
  const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as QuestionLog));
  return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createQuestionLog(data: Omit<QuestionLog, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'questionLogs'), data);
  return ref.id;
}

export async function deleteQuestionLog(id: string): Promise<void> {
  await deleteDoc(doc(db, 'questionLogs', id));
}

// ─── REVIEW CARDS (SM-2) ──────────────────────────────────────
export async function getReviewCards(userId: string, planId?: string): Promise<ReviewCard[]> {
  const constraints: any[] = [where('userId', '==', userId)];
  if (planId) constraints.push(where('planId', '==', planId));
  const q = query(collection(db, 'reviewCards'), ...constraints);
  const snap = await getDocs(q);
  const cards = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReviewCard));
  return cards.sort((a, b) => a.nextReview.localeCompare(b.nextReview));
}

export async function getReviewCard(userId: string, topicId: string): Promise<ReviewCard | null> {
  const q = query(
    collection(db, 'reviewCards'),
    where('userId', '==', userId),
    where('topicId', '==', topicId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as ReviewCard;
}

export async function createReviewCard(data: Omit<ReviewCard, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'reviewCards'), data);
  return ref.id;
}

export async function updateReviewCard(id: string, data: Partial<ReviewCard>): Promise<void> {
  await updateDoc(doc(db, 'reviewCards', id), { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteReviewCard(id: string): Promise<void> {
  await deleteDoc(doc(db, 'reviewCards', id));
}

export async function addTopicToReviewQueue(
  userId: string,
  planId: string,
  topic: { id: string; name: string },
  subject: { id: string; name: string; color: string }
): Promise<void> {
  const existing = await getReviewCard(userId, topic.id);
  const now = new Date().toISOString();
  const initial = createInitialSM2Card();

  if (existing) {
    await updateReviewCard(existing.id, {
      nextReview: initial.nextReview,
      updatedAt: now,
    });
  } else {
    await createReviewCard({
      userId,
      planId,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectColor: subject.color,
      topicId: topic.id,
      topicName: topic.name,
      ...initial,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function submitReview(cardId: string, card: ReviewCard, quality: SM2Quality): Promise<void> {
  const result = calculateSM2(card, quality);
  await updateReviewCard(cardId, {
    ...result,
    updatedAt: new Date().toISOString(),
  });
}

// ─── EXAMS ────────────────────────────────────────────────────
export async function getExams(userId: string, planId?: string): Promise<Exam[]> {
  const constraints: any[] = [where('userId', '==', userId)];
  if (planId) constraints.push(where('planId', '==', planId));
  const q = query(collection(db, 'exams'), ...constraints);
  const snap = await getDocs(q);
  const exams = snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam));
  return exams.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function createExam(data: Omit<Exam, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'exams'), data);
  return ref.id;
}

export async function deleteExam(id: string): Promise<void> {
  await deleteDoc(doc(db, 'exams', id));
}

// ─── BATCH IMPORT (PDF extraction) ───────────────────────────
export async function batchCreateSubjectsAndTopics(
  planId: string,
  userId: string,
  subjects: SubjectImportInput[]
): Promise<SubjectImportResult> {
  let batch = writeBatch(db);
  let batchOperations = 0;
  const now = new Date().toISOString();
  const subjectsRef = collection(db, 'studyPlans', planId, 'subjects');
  const existingSubjectsSnap = await getDocs(subjectsRef);
  const existingSubjects = new Map(
    existingSubjectsSnap.docs.map(subjectDoc => [
      normalizeImportName(subjectDoc.data().name ?? ''),
      { id: subjectDoc.id, order: subjectDoc.data().order ?? 0 },
    ])
  );

  const result: SubjectImportResult = {
    createdSubjects: 0,
    reusedSubjects: 0,
    createdTopics: 0,
    skippedTopics: 0,
  };

  const commitIfNeeded = async (force = false) => {
    if (batchOperations === 0 || (!force && batchOperations < 450)) return;
    await batch.commit();
    batch = writeBatch(db);
    batchOperations = 0;
  };

  for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
    const s = subjects[sIdx];
    const subjectKey = normalizeImportName(s.name);
    const existingSubject = existingSubjects.get(subjectKey);
    let subjectId = existingSubject?.id;

    if (subjectId) {
      result.reusedSubjects += 1;
    } else {
      const subjectRef = doc(subjectsRef);
      subjectId = subjectRef.id;
      const order = existingSubjects.size;

      batch.set(subjectRef, {
        planId,
        userId,
        name: s.name,
        color: COLORS[order % COLORS.length],
        weight: s.weight,
        order,
        createdAt: now,
        updatedAt: now,
      });
      batchOperations += 1;
      result.createdSubjects += 1;
      existingSubjects.set(subjectKey, { id: subjectId, order });
    }

    const topicsRef = collection(db, 'studyPlans', planId, 'subjects', subjectId, 'topics');
    const existingTopicsSnap = existingSubject ? await getDocs(topicsRef) : null;
    const existingTopicKeys = new Set(
      existingTopicsSnap?.docs.map(topicDoc => normalizeImportName(topicDoc.data().name ?? '')) ?? []
    );
    let nextTopicOrder = existingTopicsSnap?.size ?? 0;

    for (let tIdx = 0; tIdx < s.topics.length; tIdx++) {
      const topicName = s.topics[tIdx].trim();
      const topicKey = normalizeImportName(topicName);

      if (!topicName || existingTopicKeys.has(topicKey)) {
        result.skippedTopics += 1;
        continue;
      }

      const topicRef = doc(topicsRef);
      batch.set(topicRef, {
        subjectId,
        planId,
        name: topicName,
        notes: '',
        tags: [],
        difficulty: 'medium',
        order: nextTopicOrder,
        progress: {
          video: { status: 'not_started' },
          pdf: { status: 'not_started' },
          questions: { status: 'not_started' },
          revision: { status: 'not_started' },
        },
        createdAt: now,
        updatedAt: now,
      });
      batchOperations += 1;
      result.createdTopics += 1;
      existingTopicKeys.add(topicKey);
      nextTopicOrder += 1;

      await commitIfNeeded();
    }

    await commitIfNeeded();
  }

  await commitIfNeeded(true);
  return result;
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6',
];
