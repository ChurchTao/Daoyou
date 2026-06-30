import {
  usePlayerStateView,
  type PlayerStateView,
} from '@app/lib/player-state/selectors';
import {
  getPillToxicityStage,
  isConditionStatusActive,
} from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import {
  getPillToxicityEffectDetails,
  getStatusEffectDetails,
} from '@app/components/feature/cultivator/persistentStatusDetails';
import {
  getGameConceptLabel,
  getResourceLabel,
  getResourceText,
} from '@shared/lib/gameConceptDisplay';
import {
  getBodyCultivationSummary,
  type BodyCultivationSummary,
} from '@shared/lib/bodyCultivation/summary';
import type { ConditionStatusKey } from '@shared/types/condition';
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
  category: 'pill' | 'injury' | 'breakthrough' | 'other';
  shortDesc: string;
  details: string[];
  durationText: string | null;
  usesRemaining: number | null;
}

export interface GameHudPillToxicityDetail {
  key: string;
  label: string;
  value: number;
  active: boolean;
  details: string[];
}

export interface GameHudCultivationProgress {
  current: number;
  cap: number;
  remaining: number;
  percent: number;
  insight: number;
  bottleneckState: boolean;
  innerDemon: boolean;
  deviationRisk: number;
  breakthroughFailures: number;
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
  hasUnallocatedAttributePoints: boolean;
  statusText: string;
  cultivationProgress: GameHudCultivationProgress;
  metrics: GameHudMetric[];
  activeStatuses: GameHudStatusTag[];
  pillToxicity: GameHudPillToxicityDetail;
  bodyCultivation: BodyCultivationSummary;
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

function getStatusCategory(
  key: ConditionStatusKey,
): GameHudStatusTag['category'] {
  if (key === 'cultivation_boost') return 'pill';
  if (
    key === 'breakthrough_focus' ||
    key === 'protect_meridians' ||
    key === 'clear_mind'
  ) {
    return 'breakthrough';
  }
  if (
    key === 'weakness' ||
    key === 'minor_wound' ||
    key === 'major_wound' ||
    key === 'near_death'
  ) {
    return 'injury';
  }
  return 'other';
}

function formatStatusDurationText(
  duration: { kind: 'until_removed' } | { kind: 'time'; expiresAt: string },
  now: Date,
): string | null {
  if (duration.kind === 'until_removed') return null;

  const expiresAt = Date.parse(duration.expiresAt);
  if (!Number.isFinite(expiresAt)) return null;

  const remainingMs = expiresAt - now.getTime();
  if (remainingMs <= 0) return '已过期';

  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return hours > 0 ? `${days}日${hours}时` : `${days}日`;
  if (hours > 0) return minutes > 0 ? `${hours}时${minutes}分` : `${hours}时`;
  return `${minutes}分`;
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
        category: getStatusCategory(status.key),
        shortDesc:
          template?.display.shortDesc ??
          template?.description ??
          '长期状态影响',
        details: getStatusEffectDetails(status),
        durationText: formatStatusDurationText(status.duration, now),
        usesRemaining:
          typeof status.usesRemaining === 'number'
            ? status.usesRemaining
            : null,
      };
    });

  const pillToxicityStage = getPillToxicityStage(cultivator.condition);
  const pillToxicityValue = Math.max(
    0,
    Math.floor(cultivator.condition?.gauges?.pillToxicity ?? 0),
  );
  const statusLabels = activeStatuses.map((status) => status.label);
  if (pillToxicityStage.key !== 'none') {
    statusLabels.push(pillToxicityStage.label);
  }
  const bodyCultivation = getBodyCultivationSummary(cultivator.condition, {
    cultivatorRealm: cultivator.realm,
  });

  return {
    cultivatorId: cultivator.id ?? '',
    name: cultivator.name,
    realm: cultivator.realm,
    realmStage: cultivator.realm_stage,
    title: cultivator.title ?? null,
    spiritStones: cultivator.spirit_stones,
    reputation: cultivator.reputation ?? 0,
    unreadMailCount,
    hasUnallocatedAttributePoints:
      (cultivator.unallocated_attribute_points ?? 0) > 0,
    statusText: statusLabels.join(' ｜ ') || '安稳',
    activeStatuses,
    pillToxicity: {
      key: pillToxicityStage.key,
      label: pillToxicityStage.label,
      value: pillToxicityValue,
      active: pillToxicityStage.key !== 'none',
      details: getPillToxicityEffectDetails(
        cultivator.condition,
        cultivator.pre_heaven_fates ?? [],
      ),
    },
    bodyCultivation,
    cultivationProgress: {
      current: cultivationExp,
      cap: cultivationCap,
      remaining: Math.max(0, cultivationCap - cultivationExp),
      percent: cultivationPercent,
      insight,
      bottleneckState:
        cultivator.cultivation_progress?.bottleneck_state ?? false,
      innerDemon: cultivator.cultivation_progress?.inner_demon ?? false,
      deviationRisk: Math.round(
        clamp(cultivator.cultivation_progress?.deviation_risk ?? 0, 0, 100),
      ),
      breakthroughFailures:
        cultivator.cultivation_progress?.breakthrough_failures ?? 0,
    },
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
