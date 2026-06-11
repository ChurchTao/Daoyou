import { usePlayerStateView, type PlayerStateView } from '@app/lib/player-state/selectors';
import {
  getPillToxicityStage,
  isConditionStatusActive,
} from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { getGameConceptLabel } from '@shared/lib/gameConceptDisplay';
import { getResourceLabel, getResourceText } from '@shared/lib/gameConceptDisplay';
import { RealmType } from '@shared/types/constants';

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
  cultivatorId: string;
  name: string;
  realm: RealmType;
  realmStage: string;
  title: string | null;
  spiritStones: number;
  reputation: number;
  unreadMailCount: number;
  statusText: string;
  metrics: GameHudMetric[];
  activeStatuses: GameHudStatusTag[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatHudResourceValue(value: number): string {
  if (value > 9999) {
    return `${(value / 10000).toFixed(2).replace(/\.?0+$/, '')}万`;
  }

  return String(value);
}

function formatHudResourcePair(current: number, max: number): string {
  return `${formatHudResourceValue(current)}/${formatHudResourceValue(max)}`;
}

export function buildGameHudSnapshot(input: {
  cultivator: PlayerStateView['cultivator'];
  display: PlayerStateView['display'];
  unreadMailCount: number;
  now?: Date;
}): GameHudSnapshot | null {
  const { cultivator, display, unreadMailCount, now = new Date() } = input;
  if (!cultivator) return null;

  const hp = display?.resources.hp;
  const mp = display?.resources.mp;
  const maxHp = Math.max(1, Math.floor(hp?.max ?? 1));
  const maxMp = Math.max(1, Math.floor(mp?.max ?? 1));
  const currentHp = Math.max(0, Math.floor(hp?.current ?? maxHp));
  const currentMp = Math.max(0, Math.floor(mp?.current ?? maxMp));

  const cultivationExp = cultivator.cultivation_progress?.cultivation_exp ?? 0;
  const cultivationCap = Math.max(
    1,
    cultivator.cultivation_progress?.exp_cap ?? 100,
  );
  const cultivationPercent = Math.round(
    clamp((cultivationExp / cultivationCap) * 100, 0, 100),
  );
  const insight = Math.round(
    clamp(cultivator.cultivation_progress?.comprehension_insight ?? 0, 0, 100),
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
    cultivatorId: cultivator.id ?? '',
    name: cultivator.name,
    realm: cultivator.realm,
    realmStage: cultivator.realm_stage,
    title: cultivator.title ?? null,
    spiritStones: cultivator.spirit_stones,
    reputation: cultivator.reputation ?? 0,
    unreadMailCount,
    statusText: statusLabels.join(' ｜ ') || '安稳',
    activeStatuses,
    metrics: [
      {
        key: 'hp',
        label: getResourceLabel('hp'),
        display: formatHudResourcePair(currentHp, maxHp),
        percent: Math.round(clamp(hp?.percent ?? 100, 0, 100)),
        tone: 'hp',
      },
      {
        key: 'mp',
        label: getResourceLabel('mp'),
        display: formatHudResourcePair(currentMp, maxMp),
        percent: Math.round(clamp(mp?.percent ?? 100, 0, 100)),
        tone: 'mp',
      },
      {
        key: 'cultivation',
        label: getResourceText('cultivation_exp'),
        display: `${cultivationPercent}%`,
        percent: cultivationPercent,
        tone: 'progress',
      },
      {
        key: 'insight',
        label: getGameConceptLabel('comprehension_insight'),
        display: `${insight}/100`,
        percent: insight,
        tone: 'insight',
      },
    ],
  };
}

export function useGameHudModel() {
  const { cultivator, display, unreadMailCount } = usePlayerStateView();

  return buildGameHudSnapshot({
    cultivator,
    display,
    unreadMailCount,
  });
}
