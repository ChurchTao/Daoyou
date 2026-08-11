import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type { PlanningAbilityViewV1 } from '@shared/engine/battle-v5/round/types';
import {
  abilityTargetLabel,
  unavailableAbilityLabel,
} from './battleAbilityLabels';

interface BattleAbilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  round?: number;
  unitName: string;
  abilities: readonly PlanningAbilityViewV1[];
  quickbarAbilityIds: readonly string[];
  enabled: boolean;
  onChoose: (ability: PlanningAbilityViewV1) => void;
  onToggleQuickbar: (abilityId: string) => void;
}

export function BattleAbilityDrawer({
  isOpen,
  onClose,
  round,
  unitName,
  abilities,
  quickbarAbilityIds,
  enabled,
  onChoose,
  onToggleQuickbar,
}: BattleAbilityDrawerProps) {
  return (
    <InkDetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={`为 ${unitName} 选择术法`}
      className="md:w-[min(25rem,92vw)]"
    >
      <p className="border-ink/15 text-ink/55 mb-4 border-b border-dashed pb-3 text-[0.68rem]">
        第 {round ?? '—'} 回合 · 单体术法选择目标后锁定；自身、范围与随机术法点选后立即锁定。
      </p>

      <div className="space-y-2">
        {abilities.map((ability) => {
          const pinned = quickbarAbilityIds.includes(ability.abilityId);
          return (
            <article
              key={ability.abilityId}
              className="border-ink/15 bg-white/25 border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  disabled={!enabled || !ability.ready}
                  onClick={() => onChoose(ability)}
                  className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <strong className="block text-sm">{ability.name}</strong>
                  <span className="text-ink/55 mt-1 block text-[0.68rem]">
                    {ability.description || `${abilityTargetLabel(ability)} · ${ability.targetScope}`}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={pinned ? '移出快捷栏' : '加入快捷栏'}
                  onClick={() => onToggleQuickbar(ability.abilityId)}
                  className={`text-lg ${pinned ? 'text-[#8f2433]' : 'text-ink/35'}`}
                >
                  {pinned ? '★' : '☆'}
                </button>
              </div>
              <div className="text-ink/55 mt-3 flex items-center justify-between text-[0.65rem]">
                <span>
                  {ability.costs
                    ?.map((cost) => `${cost.resource === 'mp' ? '真元' : '气血'} ${cost.amount}`)
                    .join(' · ') || '无消耗'}
                </span>
                <span>
                  {ability.cooldown
                    ? `冷却 ${ability.cooldown.current}/${ability.cooldown.max}`
                    : abilityTargetLabel(ability)}
                </span>
              </div>
              {!ability.ready && (
                <p className="mt-2 text-[0.65rem] text-[#8f2433]">
                  {unavailableAbilityLabel(ability)}
                </p>
              )}
            </article>
          );
        })}
        {abilities.length === 0 && (
          <p className="text-ink/50 py-10 text-center text-sm">
            当前单位没有可选术法。
          </p>
        )}
      </div>
    </InkDetailDrawer>
  );
}
