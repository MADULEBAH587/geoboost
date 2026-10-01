import type { Difficulty, Question } from "./questions";

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export type SessionMix = Record<Difficulty, number>;
export const standardMix: SessionMix = { easy: 7, medium: 9, kbat: 4 };

function exactDesiredCounts(target: number, mix: SessionMix): SessionMix {
  const keys: Difficulty[] = ["easy", "medium", "kbat"];
  const totalMix = keys.reduce((sum, key) => sum + mix[key], 0);
  const raw = keys.map((key) => ({
    key,
    exact: (mix[key] / totalMix) * target,
  }));

  const desired: SessionMix = { easy: 0, medium: 0, kbat: 0 };
  let allocated = 0;
  raw.forEach(({ key, exact }) => {
    desired[key] = Math.floor(exact);
    allocated += desired[key];
  });

  raw
    .sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)))
    .slice(0, target - allocated)
    .forEach(({ key }) => desired[key]++);

  return desired;
}

export function buildQuestionSession(bank: Question[], requested = 20, mix: SessionMix = standardMix) {
  const target = Math.min(requested, bank.length);
  if (target === 0) return [];

  const byDifficulty: Record<Difficulty, Question[]> = {
    easy: shuffle(bank.filter((q) => q.difficulty === "easy")),
    medium: shuffle(bank.filter((q) => q.difficulty === "medium")),
    kbat: shuffle(bank.filter((q) => q.difficulty === "kbat")),
  };

  const desired = exactDesiredCounts(target, mix);
  const selected: Question[] = [];

  (Object.keys(desired) as Difficulty[]).forEach((difficulty) => {
    selected.push(...byDifficulty[difficulty].slice(0, desired[difficulty]));
  });

  const used = new Set(selected.map((q) => q.id));
  const remaining = shuffle(bank.filter((q) => !used.has(q.id)));
  while (selected.length < target && remaining.length) selected.push(remaining.pop()!);

  return shuffle(selected)
    .slice(0, target)
    .map((question) => ({ ...question, options: shuffle(question.options) }));
}
