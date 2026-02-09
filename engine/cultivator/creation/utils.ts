import { ELEMENT_VALUES, type ElementType } from '@/types/constants';
import type { Attributes, SpiritualRoot } from '@/types/cultivator';

export function generateAttributes(score: number): Attributes {
  // 基础值 10，随机浮动 0-10，加分项 (score/10)
  // 炼气初期属性通常在 10-30 之间
  const base = 10;
  const bonus = Math.floor(score / 10);

  const rand = () => Math.floor(Math.random() * 6); // 0-5

  return {
    vitality: base + rand() + Math.floor(bonus * (0.5 + Math.random())),
    spirit: base + rand() + Math.floor(bonus * (0.5 + Math.random())),
    wisdom: base + rand() + Math.floor(bonus * (0.5 + Math.random())),
    speed: base + rand() + Math.floor(bonus * (0.5 + Math.random())),
    willpower: base + rand() + Math.floor(bonus * (0.5 + Math.random())),
  };
}

export function generateSpiritualRoots(
  score: number,
  preferences: readonly string[],
): SpiritualRoot[] {
  const normalizedPreferences = normalizeElementPreferences(preferences, score);
  const rootCount = normalizedPreferences.length;

  const roots: SpiritualRoot[] = normalizedPreferences.map((el) => ({
    element: el,
    strength: 0, // to be calculated
  }));

  roots.forEach((root) => {
    root.grade = resolveSpiritualRootGrade(rootCount, root.element);
    root.strength = calculateSpiritualRootStrength(score, rootCount, root.grade);
  });

  return roots;
}

function calculateSpiritualRootStrength(
  score: number,
  rootCount: number,
  grade: SpiritualRoot['grade'],
): number {
  const normalizedScore = Math.max(0, Math.min(100, score));
  const baseCap = getBaseStrengthCap(rootCount);
  const cap = grade === '变异灵根' ? Math.min(100, baseCap + 10) : baseCap;

  // 分数越高，目标值越接近上限；仍保留随机波动
  const scoreRatio = normalizedScore / 100;
  const target = Math.floor(cap * (0.45 + 0.5 * scoreRatio));

  // 波动区间跟随上限变化，确保低分也有一定随机性
  const amplitude = Math.max(5, Math.floor(cap * 0.15));
  const delta = Math.floor((Math.random() * 2 - 1) * amplitude);
  const minStrength = Math.max(10, Math.floor(cap * 0.25));

  return Math.max(minStrength, Math.min(cap, target + delta));
}

function getBaseStrengthCap(rootCount: number): number {
  if (rootCount <= 1) return 95;
  if (rootCount === 2) return 80;
  if (rootCount === 3) return 65;
  return 55;
}

function normalizeElementPreferences(
  preferences: readonly string[],
  score: number,
): ElementType[] {
  const uniqueValid = Array.from(
    new Set(
      preferences.filter((el): el is ElementType =>
        (ELEMENT_VALUES as readonly string[]).includes(el),
      ),
    ),
  );

  if (uniqueValid.length > 0) {
    return uniqueValid;
  }

  const fallbackCount = score >= 90 ? 1 : score >= 75 ? 2 : score >= 50 ? 3 : 4;
  return pickRandomElements(fallbackCount);
}

function pickRandomElements(count: number): ElementType[] {
  const pool = [...ELEMENT_VALUES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(1, Math.min(count, ELEMENT_VALUES.length)));
}

function resolveSpiritualRootGrade(
  rootCount: number,
  element: ElementType,
): SpiritualRoot['grade'] {
  if (element === '风' || element === '雷' || element === '冰') {
    return '变异灵根';
  }

  if (rootCount === 1) {
    return '天灵根';
  }

  if (rootCount <= 3) {
    return '真灵根';
  }

  return '伪灵根';
}
