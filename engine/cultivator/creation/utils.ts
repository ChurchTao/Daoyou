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

  // 基础强度
  const baseStrength = 20;

  roots.forEach((root) => {
    // 随机波动
    let val = baseStrength + Math.floor(Math.random() * 20);
    // 分数加成
    val += Math.floor(score / 2);

    // 灵根越少，单项强度越高（天道补偿）
    if (rootCount === 1) val += 30;
    if (rootCount === 2) val += 15;

    // 封顶 95
    if (val > 95) val = 95;
    if (val < 10) val = 10;

    root.strength = val;
    root.grade = resolveSpiritualRootGrade(rootCount, root.element);
  });

  return roots;
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
  if (rootCount === 1) {
    if (element === '风' || element === '雷' || element === '冰') {
      return '变异灵根';
    }
    return '天灵根';
  }

  if (rootCount <= 3) {
    return '真灵根';
  }

  return '伪灵根';
}
