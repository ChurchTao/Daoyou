import {
  BLACK_MARKET_INSPECTION_KINDS,
  type BlackMarketInspectionKind,
} from '@shared/types/blackMarket';

const LEGACY_INSPECTION_PREFIX = '查验：';

const INSPECTION_PLAYER_COPY: Record<BlackMarketInspectionKind, string> = {
  appearance: '仔细观察货物外观',
  aura: '凝神感知货物灵气',
  damage: '检查货物破损痕迹',
  origin: '询问货物来历',
  sale_reason: '询问为何出售',
};

export function blackMarketInspectionPlayerBody(
  kind: BlackMarketInspectionKind,
): string {
  return INSPECTION_PLAYER_COPY[kind];
}

export function normalizeBlackMarketPlayerBody(body: string): string {
  if (!body.startsWith(LEGACY_INSPECTION_PREFIX)) return body;
  const legacyKind = body.slice(LEGACY_INSPECTION_PREFIX.length);
  const kind = BLACK_MARKET_INSPECTION_KINDS.find(
    (candidate) => candidate === legacyKind,
  );
  return kind ? blackMarketInspectionPlayerBody(kind) : body;
}
