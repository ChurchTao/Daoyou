import type { ContestStatus } from '@daoyou/contracts/alchemy/contest';
import {
  CONTEST_HEAT,
  type ContestDose,
  type ContestHeat,
} from '@daoyou/game-domain/alchemy/contest';

export type ContestSession = NonNullable<ContestStatus['session']>;
export type ContestDraft = {
  turn: number;
  heat: ContestHeat;
  doses: ContestDose[];
};
export const heatNames = { gentle: '温火', steady: '平火', fierce: '旺火' };
export const heatNotes = {
  gentle: '稳炉降毒',
  steady: '火力均衡',
  fierce: '增产易积毒',
};
export const heatOptions = Object.keys(CONTEST_HEAT) as ContestHeat[];

export function formatStrength(key: string, value: number) {
  return key === 'restore_hp' || key === 'restore_mp'
    ? `${Number((value * 100).toFixed(2))}%`
    : String(value);
}

export function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const beijingTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
export const beijingDate = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

export function draftFor(
  session: ContestSession,
  heat: ContestHeat,
  doses: ContestDose[] = [],
): ContestDraft {
  return {
    turn: session.attempts.length,
    heat: CONTEST_HEAT[heat] <= session.qi ? heat : 'gentle',
    doses: doses.flatMap(({ materialId, dose }) => {
      const available = session.remaining[materialId] ?? 0;
      return available > 0
        ? [{ materialId, dose: Math.min(dose, available) }]
        : [];
    }),
  };
}

export function readDraft(key: string, session: ContestSession): ContestDraft {
  const initial = draftFor(session, 'steady');
  try {
    const cached = JSON.parse(
      sessionStorage.getItem(key) ?? 'null',
    ) as ContestDraft | null;
    if (
      cached?.turn !== session.attempts.length ||
      !heatOptions.includes(cached.heat) ||
      !Array.isArray(cached.doses) ||
      cached.doses.length > 4 ||
      cached.doses.some(
        ({ materialId, dose }) =>
          typeof materialId !== 'string' || (dose !== 1 && dose !== 2),
      ) ||
      new Set(cached.doses.map(({ materialId }) => materialId)).size !==
        cached.doses.length ||
      cached.doses.reduce((sum, { dose }) => sum + dose, 0) > 5
    )
      return initial;
    return draftFor(session, cached.heat, cached.doses);
  } catch {
    return initial;
  }
}

export const contestVerdicts = {
  empty: ['未成丹', '本炉精华不足。'],
  primary: ['主药效不符', '可换一味主材，或调整它的用量。'],
  secondary: ['缺少所需辅药效', '可换用能补足辅药效的材料。'],
  toxicity: ['丹毒超限', '可改用温火，或换一味能稳炉的材料。'],
  strength: ['主药效强度不足', '可调整主材的品阶或用量。'],
};

export const contestFurnacePositions: [number, number][] = [
  [23, 20],
  [77, 20],
  [77, 80],
  [23, 80],
];
