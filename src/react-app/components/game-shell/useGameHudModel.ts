import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { getPillToxicityStage, isConditionStatusActive } from '@shared/lib/condition';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';

export interface GameHudMetric {
  key: 'hp' | 'mp' | 'cultivation' | 'insight';
  label: string;
  display: string;
  percent: number;
  tone: 'hp' | 'mp' | 'progress' | 'insight';
}

export interface GameHudStatusTag {
  key: string;
  label: string;
  icon: string;
}

export interface GameHudSnapshot {
  name: string;
  realm: string;
  realmStage: string;
  title: string | null;
  spiritStones: number;
  unreadMailCount: number;
  statusText: string;
  metrics: GameHudMetric[];
  activeStatuses: GameHudStatusTag[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function buildGameHudSnapshot(input: {
  cultivator: ReturnType<typeof useCultivator>['cultivator'];
  finalAttributes: ReturnType<typeof useCultivator>['finalAttributes'];
  unreadMailCount: number;
  now?: Date;
}): GameHudSnapshot | null {
  const { cultivator, finalAttributes, unreadMailCount, now = new Date() } =
    input;
  if (!cultivator) return null;

  const maxHp = Math.max(1, Math.floor(finalAttributes?.maxHp ?? 1));
  const maxMp = Math.max(1, Math.floor(finalAttributes?.maxMp ?? 1));
  const currentHp = Math.max(
    0,
    Math.floor(cultivator.condition?.resources.hp.current ?? maxHp),
  );
  const currentMp = Math.max(
    0,
    Math.floor(cultivator.condition?.resources.mp.current ?? maxMp),
  );

  const cultivationExp = cultivator.cultivation_progress?.cultivation_exp ?? 0;
  const cultivationCap = Math.max(
    1,
    cultivator.cultivation_progress?.exp_cap ?? 100,
  );
  const cultivationPercent = Math.round(
    clamp((cultivationExp / cultivationCap) * 100, 0, 100),
  );
  const insight = Math.round(
    clamp(
      cultivator.cultivation_progress?.comprehension_insight ?? 0,
      0,
      100,
    ),
  );

  const activeStatuses = (cultivator.condition?.statuses ?? [])
    .filter((status) => isConditionStatusActive(status, now))
    .map((status) => {
      const template = getConditionStatusTemplate(status.key);
      return {
        key: status.key,
        label: template?.name ?? status.key,
        icon: template?.display.icon ?? '💫',
      };
    });

  const pillToxicityStage = getPillToxicityStage(cultivator.condition);
  const statusLabels = activeStatuses.map((status) => status.label);
  if (pillToxicityStage.key !== 'none') {
    statusLabels.push(pillToxicityStage.label);
  }

  return {
    name: cultivator.name,
    realm: cultivator.realm,
    realmStage: cultivator.realm_stage,
    title: cultivator.title ?? null,
    spiritStones: cultivator.spirit_stones,
    unreadMailCount,
    statusText: statusLabels.join(' ｜ ') || '安稳无恙',
    activeStatuses,
    metrics: [
      {
        key: 'hp',
        label: 'HP',
        display: `${currentHp}/${maxHp}`,
        percent: Math.round(clamp((currentHp / maxHp) * 100, 0, 100)),
        tone: 'hp',
      },
      {
        key: 'mp',
        label: 'MP',
        display: `${currentMp}/${maxMp}`,
        percent: Math.round(clamp((currentMp / maxMp) * 100, 0, 100)),
        tone: 'mp',
      },
      {
        key: 'cultivation',
        label: '修为',
        display: `${cultivationPercent}%`,
        percent: cultivationPercent,
        tone: 'progress',
      },
      {
        key: 'insight',
        label: '感悟',
        display: `${insight}/100`,
        percent: insight,
        tone: 'insight',
      },
    ],
  };
}

export function useGameHudModel() {
  const { cultivator, finalAttributes, unreadMailCount } = useCultivator();

  return buildGameHudSnapshot({
    cultivator,
    finalAttributes,
    unreadMailCount,
  });
}
