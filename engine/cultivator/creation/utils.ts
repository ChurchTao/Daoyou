import type { ElementType } from '@/types/constants';
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
  preferences: ElementType[],
): SpiritualRoot[] {
  const roots: SpiritualRoot[] = preferences.map((el) => ({
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
    if (roots.length === 1) val += 30;
    if (roots.length === 2) val += 15;

    // 封顶 95
    if (val > 95) val = 95;
    if (val < 10) val = 10;

    root.strength = val;
  });

  return roots;
}
