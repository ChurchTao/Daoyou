import type { CultivatorInspectionData } from '@shared/contracts/player';
import { cn } from '@shared/lib/cn';
import {
  characterDisplayRows,
  formatCharacterAttributeValue as formatAttributeValue,
  formatCharacterAttributeModifier as formatModifier,
} from '@shared/lib/cultivatorDisplay';
import { useMemo } from 'react';

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
    const { primaryRows, secondaryAll } = characterDisplayRows(
      cultivator.attributes,
      cultivator.combatPanel,
    );
    return { primaryRows, secondaryRows: chunkPairs(secondaryAll) };
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
                <td className="text-ink-secondary py-2 pr-3 text-right font-mono">
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
                      <span className="text-ink-secondary min-w-0 text-right font-mono">
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
