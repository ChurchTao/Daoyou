import { TOWER_BLESSINGS_PACK, towerBlessingRule, type TowerBlessingId } from './blessing-pack';

export interface TowerBlessingEffectPreview {
  currentLabel: string;
  nextLabel?: string;
  formulaLabel: string;
}

export interface TowerBlessingEffectPreviewArgs {
  blessingId: TowerBlessingId;
  currentStacks: number;
  nextStacks?: number;
  maxHp?: number;
  currentHp?: number;
  maxMp?: number;
  currentMp?: number;
}

function clampStacks(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatRecoveryAmount(args: {
  ratio: number;
  current: number | undefined;
  max: number | undefined;
}) {
  const current = args.current ?? NaN;
  const max = args.max ?? NaN;
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= current) {
    return null;
  }

  return Math.floor((max - current) * args.ratio);
}

function describeStackValue(
  blessingId: TowerBlessingId,
  stacks: number,
  args: TowerBlessingEffectPreviewArgs,
  pack = TOWER_BLESSINGS_PACK,
) {
  if (stacks <= 0) {
    return '尚未承接';
  }

  const { effect, label } = towerBlessingRule(blessingId, pack);
  if (effect.kind !== 'recovery') return `${label} +${stacks * (effect.perStack * 100)}%`;
  const ratio = effect.perStack * stacks;
  const recovered = formatRecoveryAmount({
    ratio,
    current: effect.resource === 'hp' ? args.currentHp : args.currentMp,
    max: effect.resource === 'hp' ? args.maxHp : args.maxMp,
  });
  const description = `战前回复 ${formatPercent(ratio)} 缺失${label}`;
  return recovered === null ? description : `${description}（约 ${recovered} 点）`;
}

function describeFormula(blessingId: TowerBlessingId, pack = TOWER_BLESSINGS_PACK) {
  const { effect, label } = towerBlessingRule(blessingId, pack);
  const percent = effect.perStack * 100;
  return effect.kind === 'recovery'
    ? `公式：每层战前回复 ${percent}% 缺失${label}。`
    : `公式：每层${label}${effect.kind === 'allAttributes' ? '同步' : ''} +${percent}%。`;
}

export function getTowerBlessingEffectPreview(
  args: TowerBlessingEffectPreviewArgs,
  pack = TOWER_BLESSINGS_PACK,
): TowerBlessingEffectPreview {
  const definition = towerBlessingRule(args.blessingId, pack);
  const currentStacks = Math.min(
    definition.maxStacks,
    clampStacks(args.currentStacks),
  );
  const nextStacks =
    args.nextStacks == null
      ? undefined
      : Math.min(definition.maxStacks, clampStacks(args.nextStacks));

  return {
    currentLabel: describeStackValue(args.blessingId, currentStacks, args, pack),
    nextLabel:
      nextStacks == null
        ? undefined
        : describeStackValue(args.blessingId, nextStacks, args, pack),
    formulaLabel: `${describeFormula(args.blessingId, pack)} 上限 ${definition.maxStacks} 层。`,
  };
}
