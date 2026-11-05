import { consumeInventoryItem } from '@app/components/feature/items/consumeInventoryItem';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { useInventoryBag } from '@app/lib/resources/bag';
import type { ExorcismRunState } from '@daoyou/game-domain/dungeon/exorcism';
import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';
import { isDungeonRecoveryPill } from '@daoyou/game-rules/dungeon';
import { useRef, useState } from 'react';

function pillEffect(
  operations: ReadonlyArray<{
    type: string;
    resource?: string;
    mode?: string;
    value?: number;
  }>,
) {
  return operations
    .filter((operation) => operation.type === 'restore_resource')
    .map((operation) => {
      const name = operation.resource === 'hp' ? '气血' : '法力';
      const value = operation.value ?? 0;
      return operation.mode === 'percent'
        ? `${name} +${Math.round(value * 100)}%`
        : `${name} +${Math.floor(value)}`;
    })
    .join('，');
}

/** 两场之间快速服用回复丹药，作用到局内状态。满状态或没有丹药时不占位置。 */
export function ExorcismPillBar({
  run,
  processing,
  onUsed,
}: {
  run: ExorcismRunState;
  processing: boolean;
  onUsed: () => Promise<void>;
}) {
  const bag = useInventoryBag();
  const { pushToast } = useInkUI();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const player = run.resources?.player;
  if (!player || (player.hp >= player.maxHp && player.mp >= player.maxMp))
    return null;
  const pills = (bag.data?.items ?? []).flatMap((item) => {
    if (item.definitionId !== 'consumable.v1') return [];
    const facts = ConsumableFactsSchema.safeParse(item.instanceData);
    if (
      !facts.success ||
      facts.data.spec.kind !== 'pill' ||
      !isDungeonRecoveryPill(facts.data)
    )
      return [];
    return [
      {
        item,
        name: facts.data.name,
        effect: pillEffect(facts.data.spec.operations),
      },
    ];
  });
  if (!pills.length)
    return bag.data ? (
      <p className="text-ink-secondary text-xs">储物袋里没有回复丹药。</p>
    ) : null;

  const use = async (entry: (typeof pills)[number]) => {
    if (busy.current || processing) return;
    busy.current = true;
    setPending(true);
    try {
      await consumeInventoryItem(entry.item);
      pushToast({ message: `服下一枚${entry.name}`, tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '服药结果未确认',
        tone: 'warning',
      });
    } finally {
      // 成败都以服务端为准，不自动重试。
      await Promise.all([bag.reload(), onUsed()]);
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <section aria-label="快速服药" className="space-y-1.5">
      <h3 className="text-ink-secondary text-xs">快速服药</h3>
      <ul className="flex flex-wrap gap-2">
        {pills.map((entry) => (
          <li key={entry.item.id}>
            <button
              type="button"
              disabled={pending || processing}
              onClick={() => void use(entry)}
              className="border-ink/30 hover:bg-ink/5 rounded-md border bg-white/30 px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-50"
            >
              <span className="font-semibold">{entry.name}</span>
              <span className="ml-1 font-mono text-xs">
                ×{entry.item.quantity}
              </span>
              <span className="text-ink-secondary block text-xs">
                {entry.effect}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
