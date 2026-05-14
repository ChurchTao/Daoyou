import type { ItemShowcaseModalProps } from '@app/components/ui/ItemShowcaseModal';
import { InkBadge } from '@app/components/ui/InkBadge';
import type { EquipmentSlot } from '@shared/types/constants';
import { getEquipmentSlotInfo } from '@shared/types/dictionaries';
import { AffixChip } from './AffixChip';
import {
  formatTargetPolicyValue,
  type ProductDisplayModel,
} from './abilityDisplay';

function getProductIcon(product: ProductDisplayModel): string {
  if (product.productType === 'artifact') {
    return getEquipmentSlotInfo((product.slot as EquipmentSlot) ?? 'weapon').icon;
  }

  if (product.productType === 'gongfa') {
    return '📘';
  }

  return '📜';
}

function getProductLabel(product: ProductDisplayModel): string {
  if (product.productType === 'artifact') return '法宝';
  if (product.productType === 'gongfa') return '功法';
  return '神通';
}

function getDescriptionTitle(product: ProductDisplayModel): string {
  if (product.productType === 'artifact') return '法宝说明';
  if (product.productType === 'gongfa') return '功法详述';
  return '神通详述';
}

function buildInfoRows(product: ProductDisplayModel) {
  const rows: Array<{ key: string; label: string; value: string }> = [];

  if (
    product.projection?.projectionKind === 'active_skill' &&
    product.projection.targetPolicy
  ) {
    rows.push({
      key: 'target-policy',
      label: '目标策略',
      value: formatTargetPolicyValue(product.projection.targetPolicy),
    });
  }

  if (
    product.projection?.projectionKind === 'active_skill' &&
    product.projection.mpCost !== undefined
  ) {
    rows.push({
      key: 'mp-cost',
      label: '法力消耗',
      value: `${product.projection.mpCost}`,
    });
  }

  if (
    product.projection?.projectionKind === 'active_skill' &&
    product.projection.cooldown !== undefined
  ) {
    rows.push({
      key: 'cooldown',
      label: '冷却回合',
      value: `${product.projection.cooldown}`,
    });
  }

  if (!product.rawModel || product.rawModel.productType !== 'artifact') {
    return rows;
  }

  const metadata = product.rawModel.metadata;
  if (metadata?.anchorRealm) {
    rows.push({
      key: 'anchor-realm',
      label: '境界要求（境界若低，效果将减弱）',
      value: metadata.anchorRealm,
    });
  }
  if (metadata?.creatorName) {
    rows.push({
      key: 'creator-name',
      label: '打造者',
      value: metadata.creatorName,
    });
  }

  return rows;
}

function getExtraInfo(product: ProductDisplayModel) {
  const rows = buildInfoRows(product);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.key}
          className="border-border/50 flex items-start justify-between gap-4 border-b pb-2"
        >
          <span className="text-ink-secondary">{row.label}</span>
          <span className="text-ink text-right font-medium">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function getFooter(product: ProductDisplayModel) {
  if (product.affixes.length === 0) return null;

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <div className="text-ink text-sm font-semibold tracking-[0.12em]">
          词缀
        </div>
        <ul className="space-y-1.5">
          {product.affixes.map((affix) => (
            <AffixChip key={affix.id} affix={affix} />
          ))}
        </ul>
      </div>
    </div>
  );
}

export function getProductShowcaseProps(
  product: ProductDisplayModel,
): Omit<ItemShowcaseModalProps, 'isOpen' | 'onClose'> {
  const kindLabel = getProductLabel(product);
  const slotInfo =
    product.productType === 'artifact'
      ? getEquipmentSlotInfo((product.slot as EquipmentSlot) ?? 'weapon')
      : null;

  return {
    icon: getProductIcon(product),
    name: product.name,
    badges: [
      product.quality ? (
        <InkBadge key="quality" tier={product.quality}>
          {kindLabel}
        </InkBadge>
      ) : (
        <InkBadge key="quality-fallback" tone="default">
          {kindLabel}
        </InkBadge>
      ),
      product.element ? (
        <InkBadge key="element" tone="default">
          {product.element}
        </InkBadge>
      ) : null,
      slotInfo ? (
        <InkBadge key="slot" tone="default">
          {slotInfo.label}
        </InkBadge>
      ) : null,
    ].filter(Boolean),
    extraInfo: getExtraInfo(product),
    description: product.description,
    descriptionTitle: getDescriptionTitle(product),
    footer: getFooter(product),
  };
}
