export const DETERMINISTIC_MODERATION_ENGINE_VERSION =
  'deterministic-rules-v1';

export const MODERATION_REASON = {
  excessiveLinks: 'EXCESSIVE_LINKS',
  repetitiveWordSpam: 'REPETITIVE_WORD_SPAM',
  characterFlood: 'CHARACTER_FLOOD',
  excessiveUppercase: 'EXCESSIVE_UPPERCASE',
} as const;

export type ModerationReason =
  (typeof MODERATION_REASON)[keyof typeof MODERATION_REASON];
export type DeterministicModerationDecision =
  | 'APPROVED'
  | 'REVIEW_REQUIRED'
  | 'REJECTED';

export interface ModerationEvaluation {
  decision: DeterministicModerationDecision;
  score: number;
  reasons: ModerationReason[];
  engineVersion: string;
}

const RULES = {
  excessiveLinks: { minimum: 3, weight: 40 },
  repetitiveWords: { consecutiveMinimum: 5, weight: 40 },
  characterFlood: { consecutiveMinimum: 10, weight: 30 },
  excessiveUppercase: {
    minimumLetters: 12,
    minimumRatio: 0.8,
    weight: 20,
  },
} as const;

const REVIEW_REQUIRED_SCORE = 40;
const REJECTED_SCORE = 70;

export class DeterministicModerationEngine {
  evaluate(text: string): ModerationEvaluation {
    const reasons: ModerationReason[] = [];
    let score = 0;

    if (countLinks(text) >= RULES.excessiveLinks.minimum) {
      score += RULES.excessiveLinks.weight;
      reasons.push(MODERATION_REASON.excessiveLinks);
    }
    if (hasRepetitiveWordSpam(text)) {
      score += RULES.repetitiveWords.weight;
      reasons.push(MODERATION_REASON.repetitiveWordSpam);
    }
    if (hasCharacterFlood(text)) {
      score += RULES.characterFlood.weight;
      reasons.push(MODERATION_REASON.characterFlood);
    }
    if (hasExcessiveUppercase(text)) {
      score += RULES.excessiveUppercase.weight;
      reasons.push(MODERATION_REASON.excessiveUppercase);
    }

    score = Math.min(score, 100);

    return {
      decision: decisionForScore(score),
      score,
      reasons,
      engineVersion: DETERMINISTIC_MODERATION_ENGINE_VERSION,
    };
  }
}

function countLinks(text: string): number {
  return text.match(/https?:\/\/[^\s]+/gi)?.length ?? 0;
}

function hasRepetitiveWordSpam(text: string): boolean {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  let runLength = 1;

  for (let index = 1; index < words.length; index += 1) {
    if (words[index] === words[index - 1]) {
      runLength += 1;
      if (runLength >= RULES.repetitiveWords.consecutiveMinimum) {
        return true;
      }
    } else {
      runLength = 1;
    }
  }

  return false;
}

function hasCharacterFlood(text: string): boolean {
  let previous = '';
  let runLength = 0;

  for (const character of text) {
    if (/\s/u.test(character)) {
      previous = '';
      runLength = 0;
      continue;
    }

    if (character === previous) {
      runLength += 1;
    } else {
      previous = character;
      runLength = 1;
    }

    if (runLength >= RULES.characterFlood.consecutiveMinimum) {
      return true;
    }
  }

  return false;
}

function hasExcessiveUppercase(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < RULES.excessiveUppercase.minimumLetters) {
    return false;
  }

  const uppercaseCount = letters.filter((letter) => /\p{Lu}/u.test(letter)).length;
  return uppercaseCount / letters.length >= RULES.excessiveUppercase.minimumRatio;
}

function decisionForScore(score: number): DeterministicModerationDecision {
  if (score >= REJECTED_SCORE) {
    return 'REJECTED';
  }
  if (score >= REVIEW_REQUIRED_SCORE) {
    return 'REVIEW_REQUIRED';
  }

  return 'APPROVED';
}
