import { InkButton, InkDetailDrawer } from '@app/components/ui';
import { cn } from '@shared/lib/cn';
import {
  characterDisplayRows,
  formatCharacterAttributeValue as formatAttributeValue,
  type CombatV6ResourceAuthority,
  type CultivatorDisplayInput,
} from '@shared/lib/cultivatorDisplay';
import { useState, type ReactNode } from 'react';

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
  cultivator: CultivatorDisplayInput & {
    condition: NonNullable<CultivatorDisplayInput['condition']> & {
      combatV6: CombatV6ResourceAuthority;
    };
  };
  defaultExpanded?: boolean;
  expandable?: boolean;
  footerActions?: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(defaultExpanded && expandable);
  const panel = cultivator.condition.combatV6.attrs;
  const { primaryRows, secondaryAll } = characterDisplayRows(
    cultivator.attributes,
    panel,
  );
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
                <td className="text-ink-secondary py-2 pr-3 text-right font-mono">
                  {formatAttributeValue(item.type, item.baseValue)}
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
                      <span className="text-ink-secondary min-w-0 text-right font-mono">
                        {formatAttributeValue(item.type, item.baseValue)}
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
        description="查看由基础根骨、道装、功法、宗门与修炼形成的战斗属性。"
        size="md"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {secondaryAll.map((item) => (
            <div
              key={item.type}
              className="border-ink/15 flex items-baseline justify-between gap-3 border-b border-dashed py-2 text-sm"
            >
              <span className="text-ink">{item.label}</span>
              <span className="text-ink-secondary text-right font-mono">
                {formatAttributeValue(item.type, item.baseValue)}
              </span>
            </div>
          ))}
        </div>
      </InkDetailDrawer>
    </>
  );
}
