import { InkBadge } from '@app/components/ui/InkBadge';
import { ItemShowcaseModal } from '@app/components/ui/ItemShowcaseModal';
import { ScoreMark } from '@app/components/ui/ScoreMark';
import { isPillConsumable, isTalismanConsumable } from '@shared/lib/consumables';
import { calculatePillScore } from '@shared/lib/pillScore';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type { Consumable } from '@shared/types/cultivator';
import { CONSUMABLE_TYPE_DISPLAY_MAP } from '@shared/lib/gameConceptDisplay';
import {
  PillAppearanceMark,
  PillDetailGroups,
} from './pillDisplayComponents';
import type { PillDetailGroup } from './pillDisplayModel';
import { toPillDisplayModel } from './pillDisplayModel';
import { buildTalismanDetailText } from './talismanDisplay';

interface ConsumableDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  consumable: Consumable;
  viewerRealm?: RealmType;
  viewerCondition?: CultivatorCondition;
}

function QuantityInfo({ quantity }: { quantity: number }) {
  return (
    <div className="border-ink/15 flex justify-between border-b border-dashed pb-2">
      <span className="opacity-70">持有数量</span>
      <span className="font-bold">{quantity}</span>
    </div>
  );
}

function buildTalismanDescription(consumable: Consumable): string {
  if (isTalismanConsumable(consumable)) {
    return buildTalismanDetailText(consumable);
  }

  return consumable.description ?? '';
}

function buildTalismanDetailGroups(text: string): PillDetailGroup[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const separatorIndex = line.indexOf('：');
    const hasLabel = separatorIndex > 0;
    const title = hasLabel ? line.slice(0, separatorIndex) : '符箓记述';
    const content = hasLabel ? line.slice(separatorIndex + 1) : line;

    return {
      key: `talisman-${title}-${index}`,
      title,
      lines: [content],
    };
  });
}

function TalismanDetailRows({ text }: { text: string }) {
  const groups = buildTalismanDetailGroups(text);

  if (groups.length === 0) return null;

  return <PillDetailGroups groups={groups} />;
}

export function ConsumableDetailModal({
  isOpen,
  onClose,
  consumable,
  viewerRealm,
  viewerCondition,
}: ConsumableDetailModalProps) {
  const typeInfo = CONSUMABLE_TYPE_DISPLAY_MAP[consumable.type];

  if (isPillConsumable(consumable)) {
    const model = toPillDisplayModel(consumable, {
      realm: viewerRealm,
      condition: viewerCondition,
    });
    const pillScore = calculatePillScore(consumable);

    return (
      <ItemShowcaseModal
        isOpen={isOpen}
        onClose={onClose}
        icon={typeInfo.icon}
        name={consumable.name}
        cornerMeta={
          pillScore !== null ? <ScoreMark score={pillScore} /> : undefined
        }
        nameMark={
          model.appearance ? (
            <PillAppearanceMark
              appearance={model.appearance}
              className="text-xs"
            />
          ) : undefined
        }
        badges={[
          consumable.quality ? (
            <InkBadge key="type" tier={consumable.quality}>
              {typeInfo.label}
            </InkBadge>
          ) : (
            <InkBadge key="type" tone="default">
              {typeInfo.label}
            </InkBadge>
          ),
        ].filter(Boolean)}
        metaSection={<QuantityInfo quantity={consumable.quantity} />}
        extraInfo={<PillDetailGroups groups={model.detailGroups} />}
        description={model.flavorText}
        descriptionTitle="丹成评述"
      />
    );
  }

  if (isTalismanConsumable(consumable)) {
    return (
      <ItemShowcaseModal
        isOpen={isOpen}
        onClose={onClose}
        icon={typeInfo.icon}
        name={consumable.name}
        badges={[
          consumable.quality ? (
            <InkBadge key="type" tier={consumable.quality}>
              {typeInfo.label}
            </InkBadge>
          ) : (
            <InkBadge key="type" tone="default">
              {typeInfo.label}
            </InkBadge>
          ),
        ].filter(Boolean)}
        metaSection={<QuantityInfo quantity={consumable.quantity} />}
        extraInfo={
          <TalismanDetailRows text={buildTalismanDescription(consumable)} />
        }
      />
    );
  }

  return (
    <ItemShowcaseModal
      isOpen={isOpen}
      onClose={onClose}
      icon={typeInfo.icon}
      name={consumable.name}
      badges={[
        consumable.quality ? (
          <InkBadge key="type" tier={consumable.quality}>
            {typeInfo.label}
          </InkBadge>
        ) : (
          <InkBadge key="type" tone="default">
            {typeInfo.label}
          </InkBadge>
        ),
      ].filter(Boolean)}
      extraInfo={<QuantityInfo quantity={consumable.quantity} />}
      description={buildTalismanDescription(consumable)}
      descriptionTitle="物品说明"
    />
  );
}
