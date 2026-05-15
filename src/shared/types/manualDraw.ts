import type { MaterialType } from './constants';
import type { Material } from './cultivator';

export const MANUAL_DRAW_KIND_VALUES = ['gongfa', 'skill'] as const;

export type ManualDrawKind = (typeof MANUAL_DRAW_KIND_VALUES)[number];
export type ManualDrawCount = 1 | 5;

interface ManualDrawKindConfig {
  icon: string;
  tabLabel: string;
  title: string;
  talismanName: string;
  talismanScenario: string;
  materialType: MaterialType;
  intro: string;
  usageHint: string;
  actionLabel: string;
}

export const MANUAL_DRAW_ROUTE = '/game/enlightenment/manual-draw';

export const MANUAL_DRAW_CONFIG: Record<ManualDrawKind, ManualDrawKindConfig> =
  {
    gongfa: {
      icon: '📖',
      tabLabel: '功法秘籍',
      title: '功法秘籍',
      talismanName: '悟道演法符',
      talismanScenario: 'draw_gongfa',
      materialType: 'gongfa_manual',
      intro: '消耗悟道演法符，抽取灵品及以上的功法秘籍。',
      usageHint: '5 连抽至少 1 本真品，可直接用于参悟功法。',
      actionLabel: '抽功法秘籍',
    },
    skill: {
      icon: '📜',
      tabLabel: '神通秘籍',
      title: '神通秘籍',
      talismanName: '神通衍化符',
      talismanScenario: 'draw_skill',
      materialType: 'skill_manual',
      intro: '消耗神通衍化符，抽取灵品及以上的神通秘籍。',
      usageHint: '5 连抽至少 1 本真品，可直接用于推演神通。',
      actionLabel: '抽神通秘籍',
    },
  };

export interface ManualDrawTalismanCounts {
  gongfa: number;
  skill: number;
}

export interface ManualDrawStatusDTO {
  talismanCounts: ManualDrawTalismanCounts;
}

export interface ManualDrawResultDTO {
  kind: ManualDrawKind;
  drawCount: ManualDrawCount;
  rewards: Material[];
  talismanCounts: ManualDrawTalismanCounts;
}

export function isManualDrawKind(value: string): value is ManualDrawKind {
  return MANUAL_DRAW_KIND_VALUES.includes(value as ManualDrawKind);
}

export function normalizeManualDrawKind(
  value: string | null | undefined,
): ManualDrawKind {
  return value && isManualDrawKind(value) ? value : 'gongfa';
}

export function buildManualDrawHref(kind: ManualDrawKind): string {
  return `${MANUAL_DRAW_ROUTE}?tab=${kind}`;
}
