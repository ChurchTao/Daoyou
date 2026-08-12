import { InkButton, InkDetailDrawer } from '@app/components/ui';
import {
  getCultivatorDisplayAttributes,
  type CultivatorDisplayInput,
} from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { attrLabel } from '@shared/engine/battle-v5/effects/affixText/attributes';
import { cn } from '@shared/lib/cn';
import { useState, type ReactNode } from 'react';

type PrimaryAttributeType =
  | AttributeType.VITALITY
  | AttributeType.STRENGTH
  | AttributeType.SPIRIT
  | AttributeType.ENDURANCE
  | AttributeType.SPEED
  | AttributeType.WILLPOWER;

const PRIMARY_ATTR_ORDER: PrimaryAttributeType[] = [
  AttributeType.VITALITY,
  AttributeType.STRENGTH,
  AttributeType.SPIRIT,
  AttributeType.ENDURANCE,
  AttributeType.SPEED,
  AttributeType.WILLPOWER,
];

const SECONDARY_ATTR_ORDER: AttributeType[] = [
  AttributeType.ATK,
  AttributeType.DEF,
  AttributeType.MAGIC_ATK,
  AttributeType.MAGIC_DEF,
  AttributeType.ACTION_SPEED,
  AttributeType.CRIT_RATE,
  AttributeType.CRIT_DAMAGE_MULT,
  AttributeType.EVASION_RATE,
  AttributeType.CONTROL_HIT,
  AttributeType.CONTROL_RESISTANCE,
  AttributeType.ARMOR_PENETRATION,
  AttributeType.MAGIC_PENETRATION,
  AttributeType.CRIT_RESIST,
  AttributeType.CRIT_DAMAGE_REDUCTION,
  AttributeType.ACCURACY,
  AttributeType.HEAL_AMPLIFY,
];

const PERCENT_ATTRS = new Set<AttributeType>([
  AttributeType.CRIT_RATE,
  AttributeType.EVASION_RATE,
  AttributeType.CONTROL_HIT,
  AttributeType.CONTROL_RESISTANCE,
  AttributeType.ARMOR_PENETRATION,
  AttributeType.MAGIC_PENETRATION,
  AttributeType.CRIT_RESIST,
  AttributeType.CRIT_DAMAGE_REDUCTION,
  AttributeType.ACCURACY,
  AttributeType.HEAL_AMPLIFY,
]);

const MULTIPLIER_ATTRS = new Set<AttributeType>([
  AttributeType.CRIT_DAMAGE_MULT,
]);

function formatAttributeValue(attrType: AttributeType, value: number): string {
  if (PERCENT_ATTRS.has(attrType)) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (MULTIPLIER_ATTRS.has(attrType)) {
    return `${value.toFixed(2)}x`;
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function formatModifier(attrType: AttributeType, value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  if (PERCENT_ATTRS.has(attrType)) {
    return `${sign}${(abs * 100).toFixed(1)}%`;
  }
  if (MULTIPLIER_ATTRS.has(attrType)) {
    return `${sign}${abs.toFixed(2)}x`;
  }
  const rendered = Number.isInteger(abs) ? `${abs}` : abs.toFixed(2);
  return `${sign}${rendered}`;
}

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

export function CultivatorAttributeOverview({
  cultivator,
  defaultExpanded = false,
  expandable = true,
  footerActions,
}: {
  cultivator: CultivatorDisplayInput;
  defaultExpanded?: boolean;
  expandable?: boolean;
  footerActions?: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(defaultExpanded && expandable);
  const { unit } = getCultivatorDisplayAttributes(cultivator);
  const orderedAttributes = [...PRIMARY_ATTR_ORDER, ...SECONDARY_ATTR_ORDER];
  const displayAttributes = orderedAttributes.map((attrType) => {
    const baseValue = unit.attributes.getBaseValue(attrType);
    const finalValue = unit.attributes.getValue(attrType);
    const modifier = finalValue - baseValue;
    return {
      type: attrType,
      label: attrLabel(attrType),
      baseValue,
      modifier,
    };
  });
  const primaryRows = displayAttributes.slice(0, PRIMARY_ATTR_ORDER.length);
  const secondaryAll = displayAttributes.slice(PRIMARY_ATTR_ORDER.length);
  const secondaryVisible = expandable ? secondaryAll.slice(0, 4) : secondaryAll;
  const secondaryRows = chunkPairs(secondaryVisible);
  const canExpand = expandable && secondaryAll.length > 4;

  return (
    <>
      <div className="border-ink/15 overflow-x-auto border border-dashed">
        <table className="border-ink/10 w-full border-collapse text-sm">
          <tbody>
            {primaryRows.map((item) => (
              <tr
                key={item.type}
                className="border-ink/10 border-b border-dashed last:border-b-0"
              >
                <td className="text-crimson w-[40%] py-2 pr-2 pl-3 font-semibold">
                  {item.label}
                </td>
                <td className="text-ink-secondary py-2 pr-3 text-right">
                  {formatAttributeValue(item.type, item.baseValue)}
                  {item.modifier !== 0 ? (
                    <>
                      {' '}
                      <span
                        className={cn(
                          'font-semibold',
                          item.modifier > 0
                            ? 'text-emerald-700'
                            : 'text-violet-700',
                        )}
                      >
                        {formatModifier(item.type, item.modifier)}
                      </span>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {secondaryRows.map((pair, rowIdx) => (
              <tr
                key={`sec-${rowIdx}`}
                className="border-ink/10 border-b border-dashed last:border-b-0"
              >
                {pair.map((item, colIdx) => (
                  <td
                    key={item.type}
                    colSpan={pair.length === 1 ? 2 : 1}
                    className={cn(
                      'w-1/2 min-w-0 py-2 pr-2 pl-3 align-top',
                      colIdx === 0 &&
                        pair.length === 2 &&
                        'border-ink/10 border-r border-dashed',
                    )}
                  >
                    <div className="flex min-w-0 items-baseline justify-between gap-2">
                      <span className="text-ink shrink-0">{item.label}</span>
                      <span className="text-ink-secondary min-w-0 text-right">
                        {formatAttributeValue(item.type, item.baseValue)}
                        {item.modifier !== 0 ? (
                          <>
                            {' '}
                            <span
                              className={cn(
                                'font-semibold',
                                item.modifier > 0
                                  ? 'text-emerald-700'
                                  : 'text-violet-700',
                              )}
                            >
                              {formatModifier(item.type, item.modifier)}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canExpand || footerActions ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            {canExpand ? (
              <InkButton
                onClick={() => setDrawerOpen(true)}
                className="text-sm"
              >
                查看全部属性
              </InkButton>
            ) : null}
          </div>
          {footerActions ? (
            <div className="flex items-center gap-2">{footerActions}</div>
          ) : null}
        </div>
      ) : null}

      <InkDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="全部战斗属性"
        description="查看由基础根骨、装备、功法与状态共同形成的完整属性。"
        size="md"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {secondaryAll.map((item) => (
            <div
              key={item.type}
              className="border-ink/15 flex items-baseline justify-between gap-3 border-b border-dashed py-2 text-sm"
            >
              <span className="text-ink">{item.label}</span>
              <span className="text-ink-secondary text-right">
                {formatAttributeValue(item.type, item.baseValue)}
                {item.modifier !== 0 ? (
                  <span
                    className={cn(
                      'ml-1 font-semibold',
                      item.modifier > 0
                        ? 'text-emerald-700'
                        : 'text-violet-700',
                    )}
                  >
                    {formatModifier(item.type, item.modifier)}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </InkDetailDrawer>
    </>
  );
}
