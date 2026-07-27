/**
 * SM-2 Spaced Repetition Algorithm
 * Based on SuperMemo SM-2: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method
 *
 * Quality scale:
 *  0 – Complete blackout
 *  1 – Incorrect response, but upon seeing the answer, remembered
 *  2 – Incorrect response, but the answer seemed easy to recall
 *  3 – Correct response with serious difficulty
 *  4 – Correct response after hesitation
 *  5 – Perfect response
 */

export type SM2Quality = 0 | 1 | 2 | 3 | 4 | 5;

export interface SM2Card {
  repetitions: number;
  interval: number;
  easeFactor: number;
  nextReview: string;   // YYYY-MM-DD
  lastReview?: string;
  lastQuality?: SM2Quality;
}

export interface SM2Result {
  repetitions: number;
  interval: number;
  easeFactor: number;
  nextReview: string;
  lastReview: string;
  lastQuality: SM2Quality;
}

/**
 * Calculate next review date and updated SM-2 parameters.
 */
export function calculateSM2(card: SM2Card, quality: SM2Quality): SM2Result {
  const today = new Date();
  const todayStr = formatDateYMD(today);

  let { repetitions, interval, easeFactor } = card;

  if (quality < 3) {
    // Incorrect response — reset repetitions, review again soon
    repetitions = 0;
    interval = 1;
  } else {
    // Correct response — advance schedule
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  // Update ease factor based on quality
  const newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(1.3, newEF);

  const nextReviewDate = new Date(today);
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return {
    repetitions,
    interval,
    easeFactor,
    nextReview: formatDateYMD(nextReviewDate),
    lastReview: todayStr,
    lastQuality: quality,
  };
}

/**
 * Create initial SM-2 card state for a new topic.
 */
export function createInitialSM2Card(): SM2Card {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReview: formatDateYMD(tomorrow),
  };
}

/**
 * Get the label and color for a quality rating.
 */
export function getQualityLabel(quality: SM2Quality): {
  label: string;
  color: string;
  nextInterval: string;
} {
  const labels: Record<SM2Quality, { label: string; color: string }> = {
    0: { label: 'Não lembrei', color: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' },
    1: { label: 'Quase nada', color: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' },
    2: { label: 'Com muita dificuldade', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30' },
    3: { label: 'Com dificuldade', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30' },
    4: { label: 'Lembrei bem', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' },
    5: { label: 'Perfeito!', color: 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' },
  };
  return { ...labels[quality], nextInterval: '' };
}

/**
 * Check if a card is due for review today or overdue.
 */
export function isDueToday(card: { nextReview: string }): boolean {
  return card.nextReview <= formatDateYMD(new Date());
}

/**
 * Format a Date object as YYYY-MM-DD string.
 */
export function formatDateYMD(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get a human-readable description of the next review interval.
 */
export function describeInterval(days: number): string {
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  if (days < 7) return `Em ${days} dias`;
  if (days < 30) return `Em ${Math.round(days / 7)} semana(s)`;
  if (days < 365) return `Em ${Math.round(days / 30)} mês(es)`;
  return `Em ${Math.round(days / 365)} ano(s)`;
}
