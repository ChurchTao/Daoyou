import type { CultivatorInspectionData } from '@shared/contracts/player';
import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { attrLabel } from '@shared/engine/battle-v5/effects/affixText/attributes';
import { cn } from '@shared/lib/cn';
import { useMemo } from 'react';

const PRIMARY_ATTR_ORDER: AttributeType[] = [
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
  AttributeType.ACCURACY,
  AttributeType.CONTROL_HIT,
  AttributeType.CONTROL_RESISTANCE,
  AttributeType.ARMOR_PENETRATION,
  AttributeType.MAGIC_PENETRATION,
  AttributeType.CRIT_RESIST,
  AttributeType.CRIT_DAMAGE_REDUCTION,
  AttributeType.HEAL_AMPLIFY,
  AttributeType.MAX_HP,
  AttributeType.MAX_MP,
];

const PERCENT_ATTRS = new Set<AttributeType>([
  AttributeType.CRIT_RATE,
  AttributeType.EVASION_RATE,
  AttributeType.ACCURACY,
  AttributeType.CONTROL_HIT,
  AttributeType.CONTROL_RESISTANCE,
  AttributeType.ARMOR_PENETRATION,
  AttributeType.MAGIC_PENETRATION,
  AttributeType.CRIT_RESIST,
  AttributeType.CRIT_DAMAGE_REDUCTION,
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
  return `${sign}${formatAttributeValue(attrType, abs)}`;
}

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2));
  }
  return rows;
}

export function CultivatorAttributeTable({
  cultivator,
}: {
  cultivator: CultivatorInspectionData;
}) {
  const { primaryRows, secondaryRows } = useMemo(() => {
    const { unit } = getCultivatorDisplayAttributes(cultivator);
    const buildRows = (attrOrder: AttributeType[]) =>
      attrOrder.map((attrType) => {
        const baseValue = unit.attributes.getBaseValue(attrType);
        const finalValue = unit.attributes.getValue(attrType);
        return {
          attrType,
          label: attrLabel(attrType),
          baseValue,
          finalValue,
          modifier: finalValue - baseValue,
        };
      });

    const secondaryAll = buildRows(SECONDARY_ATTR_ORDER);
    return {
      primaryRows: buildRows(PRIMARY_ATTR_ORDER),
      secondaryRows: chunkPairs(secondaryAll),
    };
  }, [cultivator]);

  return (
    <section className="space-y-3">
      <h5 className="text-ink font-semibold">全属性</h5>
      <div className="border-ink/15 overflow-x-auto border border-dashed">
        <table className="border-ink/10 w-full border-collapse text-sm">
          <tbody>
            {primaryRows.map((row) => (
              <tr
                key={row.attrType}
                className="border-ink/10 border-b border-dashed last:border-b-0"
              >
                <td className="text-crimson w-[40%] py-2 pr-2 pl-3 font-semibold">
                  {row.label}
                </td>
                <td className="text-ink-secondary py-2 pr-3 text-right">
                  {formatAttributeValue(row.attrType, row.baseValue)}
                  {Math.abs(row.modifier) > 0.001 ? (
                    <>
                      {' '}
                      <span
                        className={cn(
                          'font-semibold',
                          row.modifier > 0
                            ? 'text-emerald-700'
                            : 'text-violet-700',
                        )}
                      >
                        {formatModifier(row.attrType, row.modifier)}
                      </span>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {secondaryRows.map((pair, rowIndex) => (
              <tr
                key={`secondary-${rowIndex}`}
                className="border-ink/10 border-b border-dashed last:border-b-0"
              >
                {pair.map((row, columnIndex) => (
                  <td
                    key={row.attrType}
                    colSpan={pair.length === 1 ? 2 : 1}
                    className={cn(
                      'w-1/2 min-w-0 py-2 pr-2 pl-3 align-top',
                      columnIndex === 0 &&
                        pair.length === 2 &&
                        'border-ink/10 border-r border-dashed',
                    )}
                  >
                    <div className="flex min-w-0 items-baseline justify-between gap-2">
                      <span className="text-ink shrink-0">{row.label}</span>
                      <span className="text-ink-secondary min-w-0 text-right">
                        {formatAttributeValue(row.attrType, row.baseValue)}
                        {Math.abs(row.modifier) > 0.001 ? (
                          <>
                            {' '}
                            <span
                              className={cn(
                                'font-semibold',
                                row.modifier > 0
                                  ? 'text-emerald-700'
                                  : 'text-violet-700',
                              )}
                            >
                              {formatModifier(row.attrType, row.modifier)}
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
    </section>
  );
}
