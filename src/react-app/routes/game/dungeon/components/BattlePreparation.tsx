import { CultivatorInspectionModal } from '@app/components/feature/cultivator-inspection';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { evaluateBattlePreparationRisk } from '@app/lib/dungeon/battlePreparationRisk';
import {
  DungeonAbandonBattleResult,
  useEnemyProbe,
} from '@app/lib/hooks/dungeon/useEnemyProbe';
import type { DungeonBattlePlan } from '@shared/lib/dungeon/battlePlan';
import type { Cultivator } from '@shared/types/cultivator';
import { useEffect, useState } from 'react';

interface BattlePreparationProps {
  battleId: string;
  player: Pick<Cultivator, 'realm' | 'attributes'>;
  onStart: (enemyName: string, battlePlan: DungeonBattlePlan) => void;
  onAbandon: (result: DungeonAbandonBattleResult) => Promise<void>;
}

const BATTLE_PLANS: ReadonlyArray<{
  id: DungeonBattlePlan;
  name: string;
  description: string;
}> = [
  {
    id: 'standard',
    name: '常规作战',
    description: '按照当前宗门战术和主动栏自动施法。',
  },
  {
    id: 'basic_attack_only',
    name: '只用普攻',
    description: '不施放主动技能，适合对付低风险敌人并保留法力。',
  },
];

export function BattlePreparation({
  battleId,
  player,
  onStart,
  onAbandon,
}: BattlePreparationProps) {
  const { openDialog } = useInkUI();
  const { enemy, isProbing, probeEnemy, abandonBattle } =
    useEnemyProbe(battleId);
  const [isEnemyDetailOpen, setIsEnemyDetailOpen] = useState(false);
  const [battlePlan, setBattlePlan] = useState<DungeonBattlePlan>('standard');

  useEffect(() => {
    if (!enemy && !isProbing) {
      probeEnemy();
    }
  }, [battleId, enemy, isProbing, probeEnemy]);

  const handleProbe = () => {
    if (enemy) {
      setIsEnemyDetailOpen(true);
    }
  };

  const handleAbandon = () => {
    openDialog({
      title: '放弃战斗',
      content:
        '确定要放弃此战吗？你将狼狈退出，但不会受伤。放弃后会直接进入副本结算。',
      confirmLabel: '确认放弃',
      cancelLabel: '取消',
      onConfirm: async () => {
        const result = await abandonBattle();
        if (result) {
          await onAbandon(result);
        }
      },
    });
  };

  const battleRisk = evaluateBattlePreparationRisk(player, enemy);

  const startBattle = () => {
    const enemyName = enemy?.title
      ? `${enemy.title}·${enemy.name}`
      : enemy?.name || '神秘敌手';

    onStart(enemyName, battlePlan);
  };

  const handleStart = () => {
    if (!battleRisk.shouldWarn) {
      startBattle();
      return;
    }

    openDialog({
      title: '强敌压境',
      content: battleRisk.message,
      confirmLabel: '仍要开战',
      cancelLabel: '先撤退',
      onConfirm: startBattle,
    });
  };

  return (
    <InkCard className="space-y-6 p-6">
      <div className="space-y-4 text-center">
        <div className="animate-bounce text-6xl">⚔️</div>
        <div>
          <h2 className="text-crimson mb-2 text-2xl font-bold">遭遇强敌</h2>
          {enemy ? (
            <p className="text-ink text-lg">
              前方发现了{' '}
              <span className="font-bold">
                {enemy.title ? `${enemy.title}·${enemy.name}` : enemy.name}
              </span>
            </p>
          ) : (
            <GameLoadingState
              message="正在感知敌人气息……"
              variant="inline"
              className="min-h-0 py-0"
            />
          )}
          <p className="text-ink-secondary mt-2 text-sm">
            此战避无可避，当速决断！
          </p>
          <p className="text-wood mt-3 text-sm leading-6">
            新手先点“神识查探”再决定。若属性差距明显，撤退不会受伤；强行战败会结束本轮探秘。
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <fieldset className="space-y-2 text-left">
          <legend className="text-ink text-sm font-semibold">作战方案</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {BATTLE_PLANS.map((plan) => {
              const selected = battlePlan === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setBattlePlan(plan.id)}
                  className={`border p-3 text-left transition-colors ${
                    selected
                      ? 'border-crimson bg-crimson/10 text-ink'
                      : 'border-ink/20 bg-paper/60 text-ink-secondary hover:border-ink/40'
                  }`}
                >
                  <span className="block font-semibold">{plan.name}</span>
                  <span className="mt-1 block text-xs leading-5">
                    {plan.description}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <InkButton
          variant="secondary"
          className="w-full py-3"
          onClick={handleProbe}
          pending={!enemy}
          pendingLabel="查探中……"
        >
          👁️ 神识查探
        </InkButton>

        <InkButton
          variant={battleRisk.shouldWarn ? 'secondary' : 'primary'}
          className="w-full py-4 text-lg"
          onClick={handleStart}
          disabled={!enemy}
        >
          {battleRisk.shouldWarn ? '⚠️ 强敌当前，建议撤退' : '⚔️ 开始战斗'}
        </InkButton>

        <InkButton
          variant="ghost"
          className="text-ink-secondary hover:text-crimson w-full py-2"
          onClick={handleAbandon}
        >
          🏃 放弃战斗（撤退）
        </InkButton>
      </div>

      <CultivatorInspectionModal
        cultivator={enemy}
        isOpen={isEnemyDetailOpen}
        onClose={() => setIsEnemyDetailOpen(false)}
        mode="enemy"
      />
    </InkCard>
  );
}
