import { InkBadge } from '@app/components/ui/InkBadge';
import { ItemCard } from '@app/components/ui/ItemCard';
import { ScoreMark } from '@app/components/ui/ScoreMark';
import { isPillConsumable, isTalismanConsumable } from '@shared/lib/consumables';
import { calculatePillScore } from '@shared/lib/pillScore';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type { Consumable } from '@shared/types/cultivator';
import { CONSUMABLE_TYPE_DISPLAY_MAP } from '@shared/lib/gameConceptDisplay';
import type { ReactNode } from 'react';
import {
  PillAppearanceMark,
  PillKeywordLine,
} from './pillDisplayComponents';
import { toPillDisplayModel } from './pillDisplayModel';
import { getConsumableListSummary } from './consumableListSummary';
import { getTalismanUsageHint } from './talismanDisplay';

export interface ConsumableListCardProps {
  consumable: Consumable;
  realm?: RealmType;
  condition?: CultivatorCondition;
  actions?: ReactNode;
  contextMeta?: ReactNode;
  contextMetaPlacement?: 'before' | 'after';
  showQuantity?: boolean;
  showUsageHint?: boolean;
}

function ConsumableMeta({
  consumable,
  realm,
  condition,
  contextMeta,
  contextMetaPlacement = 'after',
  showUsageHint = true,
}: Pick<
  ConsumableListCardProps,
  | 'consumable'
  | 'realm'
  | 'condition'
  | 'contextMeta'
  | 'contextMetaPlacement'
  | 'showUsageHint'
>) {
  const pillDisplay = isPillConsumable(consumable)
    ? toPillDisplayModel(consumable, { realm, condition })
    : null;
  const usageHint =
    showUsageHint && isTalismanConsumable(consumable)
      ? getTalismanUsageHint(consumable)
      : null;
  const coreMeta = pillDisplay ? (
    <PillKeywordLine labels={pillDisplay.keywordLabels} />
  ) : usageHint ? (
    <div className="text-ink-primary text-xs">{usageHint}</div>
  ) : null;

  if (!contextMeta && !coreMeta) return null;

  return (
    <div className="space-y-1">
      {contextMetaPlacement === 'before' ? contextMeta : coreMeta}
      {contextMetaPlacement === 'before' ? coreMeta : contextMeta}
    </div>
  );
}

export function ConsumableListCard({
  consumable,
  realm,
  condition,
  actions,
  contextMeta,
  contextMetaPlacement,
  showQuantity = true,
  showUsageHint = true,
}: ConsumableListCardProps) {
  const typeInfo = CONSUMABLE_TYPE_DISPLAY_MAP[consumable.type];
  const pillDisplay = isPillConsumable(consumable)
    ? toPillDisplayModel(consumable, { realm, condition })
    : null;
  const pillScore = isPillConsumable(consumable)
    ? calculatePillScore(consumable)
    : null;

  return (
    <ItemCard
      layout="col"
      icon={typeInfo.icon}
      name={consumable.name}
      nameMark={
        pillDisplay?.appearance ? (
          <PillAppearanceMark
            appearance={pillDisplay.appearance}
            className="text-[0.68rem]"
          />
        ) : undefined
      }
      quality={consumable.quality}
      cornerMeta={
        pillScore !== null ? <ScoreMark score={pillScore} /> : undefined
      }
      badgeExtra={
        <>
          <InkBadge tone="default">{typeInfo.label}</InkBadge>
          {showQuantity ? (
            <span className="text-ink-secondary text-sm">
              x{consumable.quantity}
            </span>
          ) : null}
        </>
      }
      meta={
        <ConsumableMeta
          consumable={consumable}
          realm={realm}
          condition={condition}
          contextMeta={contextMeta}
          contextMetaPlacement={contextMetaPlacement}
          showUsageHint={showUsageHint}
        />
      }
      description={getConsumableListSummary(consumable, { realm, condition })}
      actions={actions}
    />
  );
}
