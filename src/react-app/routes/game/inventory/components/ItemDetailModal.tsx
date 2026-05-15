import {
  getProductShowcaseProps,
  toProductDisplayModel,
  type ProductRecordLike,
} from '@app/components/feature/products';
import { InkBadge } from '@app/components/ui/InkBadge';
import { ItemShowcaseModal } from '@app/components/ui/ItemShowcaseModal';
import { isPillConsumable, isTalismanConsumable } from '@shared/lib/consumables';
import { getTrackConfig } from '@shared/lib/trackConfigRegistry';
import type {
  Consumable,
  CultivationTechnique,
  Material,
  Skill,
} from '@shared/types/cultivator';
import type { ConditionOperation, PillFamily } from '@shared/types/consumable';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP,
  getMaterialTypeInfo,
} from '@shared/types/dictionaries';
import type { ItemDetailPayload } from './itemDetailPayload';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemDetailPayload | null;
}

// 持有数量信息组件
function QuantityInfo({ quantity }: { quantity: number }) {
  return (
    <div className="border-border/50 flex justify-between border-b pb-2">
      <span className="opacity-70">持有数量</span>
      <span className="font-bold">{quantity}</span>
    </div>
  );
}

function describeOperation(operation: ConditionOperation): string {
  switch (operation.type) {
    case 'restore_resource':
      return `${operation.resource === 'hp' ? '恢复气血' : '恢复真元'}：${
        operation.mode === 'percent'
          ? `${Math.round(operation.value * 100)}%`
          : `${operation.value}`
      }`;
    case 'change_gauge':
      return `丹毒变化：${operation.delta > 0 ? '+' : ''}${operation.delta}`;
    case 'remove_status':
      return `移除状态：${operation.status}`;
    case 'add_status':
      return `新增状态：${operation.status}${
        typeof operation.usesRemaining === 'number'
          ? `（可用 ${operation.usesRemaining} 次）`
          : ''
      }`;
    case 'advance_track':
      return `推进进度：${getTrackConfig(operation.track).name} +${operation.value}`;
  }
}

function getPillFamilyLabel(family: PillFamily): string {
  switch (family) {
    case 'healing':
      return '疗伤';
    case 'mana':
      return '回元';
    case 'detox':
      return '解毒';
    case 'breakthrough':
      return '破境';
    case 'tempering':
      return '炼体';
    case 'marrow_wash':
      return '洗髓';
    case 'hybrid':
      return '复合';
  }
}

function buildConsumableDescription(consumable: Consumable): string {
  if (isPillConsumable(consumable)) {
    const operationLines = consumable.spec.operations.map(describeOperation);
    const header = [
      `丹药类别：${getPillFamilyLabel(consumable.spec.family)}`,
      consumable.spec.consumeRules.countsTowardLongTermQuota
        ? '计入本境长期丹药配额'
        : '不计入长期丹药配额',
    ];
    return [...header, ...operationLines, consumable.description]
      .filter(Boolean)
      .join('\n');
  }

  if (isTalismanConsumable(consumable)) {
    return [
      `适用场景：${consumable.spec.scenario}`,
      `消耗方式：${consumable.spec.sessionMode}`,
      consumable.spec.notes,
      consumable.description,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return consumable.description || '';
}

/**
 * 物品详情弹窗
 */
export function ItemDetailModal({
  isOpen,
  onClose,
  item,
}: ItemDetailModalProps) {
  if (!item || !isOpen) return null;

  if (item.kind === 'artifact') {
    const artifactRecord = item.item as unknown as ProductRecordLike;
    const product = toProductDisplayModel({
      ...artifactRecord,
      productType: 'artifact',
    });

    return (
      <ItemShowcaseModal
        isOpen
        onClose={onClose}
        {...getProductShowcaseProps(product)}
      />
    );
  }

  if (item.kind === 'skill') {
    const skill = item.item as Skill;
    const product = toProductDisplayModel({
      ...skill,
      productType: 'skill',
    } as ProductRecordLike);

    return (
      <ItemShowcaseModal
        isOpen
        onClose={onClose}
        {...getProductShowcaseProps(product)}
      />
    );
  }

  if (item.kind === 'gongfa') {
    const technique = item.item as CultivationTechnique;
    const product = toProductDisplayModel({
      ...technique,
      productType: 'gongfa',
    } as ProductRecordLike);

    return (
      <ItemShowcaseModal
        isOpen
        onClose={onClose}
        {...getProductShowcaseProps(product)}
      />
    );
  }

  if (item.kind === 'consumable') {
    const consumable = item.item as Consumable;
    const typeInfo = CONSUMABLE_TYPE_DISPLAY_MAP[consumable.type];
    return (
      <ItemShowcaseModal
        isOpen
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
        description={buildConsumableDescription(consumable)}
        descriptionTitle="丹药详述"
      />
    );
  }

  const material = item.item as Material;
  const typeInfo = getMaterialTypeInfo(material.type);
  const badges = [
    <InkBadge key="type" tier={material.rank}>
      {typeInfo.label}
    </InkBadge>,
  ];
  if (material.element) {
    badges.push(
      <InkBadge key="e" tone="default">
        {material.element}
      </InkBadge>,
    );
  }

  return (
    <ItemShowcaseModal
      isOpen
      onClose={onClose}
      icon={typeInfo.icon}
      name={material.name}
      badges={badges}
      extraInfo={<QuantityInfo quantity={material.quantity} />}
      description={material.description}
      descriptionTitle="物品说明"
    />
  );
}
