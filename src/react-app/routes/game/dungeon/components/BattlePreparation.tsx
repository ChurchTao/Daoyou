import { LingGenMini } from '@app/components/func';
import { InkPageShell } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge } from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { useEnemyProbe } from '@app/lib/hooks/dungeon/useEnemyProbe';
import { useEffect, useState } from 'react';

interface BattlePreparationProps {
  battleId: string;
  onStart: (enemyName: string) => void;
  onAbandon: () => Promise<void>;
}

/**
 * 战前准备组件
 * 自动获取敌人信息，提供查探、放弃和开始战斗的选项
 */
export function BattlePreparation({
  battleId,
  onStart,
  onAbandon,
}: BattlePreparationProps) {
  const { openDialog } = useInkUI();
  const { enemy, isProbing, probeEnemy, abandonBattle } =
    useEnemyProbe(battleId);
  const [showDetails, setShowDetails] = useState(false);

  // 组件加载时自动获取敌人信息
  useEffect(() => {
    if (!enemy && !isProbing) {
      probeEnemy();
    }
  }, [battleId, enemy, isProbing, probeEnemy]);

  const handleProbe = () => {
    setShowDetails(!showDetails);
  };

  const handleAbandon = () => {
    openDialog({
      title: '放弃战斗',
      content:
        '确定要放弃此战吗？你将狼狈退出，但不会受伤。放弃后会直接进入副本结算。',
      confirmLabel: '确认放弃',
      cancelLabel: '取消',
      onConfirm: async () => {
        await abandonBattle();
        await onAbandon();
      },
    });
  };

  const handleStart = () => {
    const enemyName = enemy?.title
      ? `${enemy.title}·${enemy.name}`
      : enemy?.name || '神秘敌手';

    onStart(enemyName);
  };

  return (
    <InkPageShell title="遭遇战" backHref="#">
      <InkCard className="space-y-6 p-6">
        {/* 顶部：敌人信息 */}
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
              <p className="text-ink animate-pulse text-lg">
                正在感知敌人气息...
              </p>
            )}
            <p className="text-ink-secondary mt-2 text-sm">
              此战避无可避，当速决断！
            </p>
          </div>
        </div>

        {/* 中部：敌人详情（查探后显示） */}
        {showDetails && enemy && (
          <InkCard className="bg-paper-dark space-y-3 p-4">
            <div className="border-ink/10 flex items-center justify-between border-b pb-2">
              <h3 className="text-crimson font-bold">
                {enemy.name}
                {enemy.title && (
                  <span className="text-ink-secondary ml-2 text-sm">
                    ({enemy.title})
                  </span>
                )}
              </h3>
              <InkBadge tier={enemy.realm}>{enemy.realm_stage}</InkBadge>
            </div>

            {/* 五维属性 */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>体魄: {enemy.attributes.vitality}</div>
              <div>灵力: {enemy.attributes.spirit}</div>
              <div>悟性: {enemy.attributes.wisdom}</div>
              <div>速度: {enemy.attributes.speed}</div>
              <div className="col-span-2">
                神识: {enemy.attributes.willpower}
              </div>
            </div>

            {/* 灵根 */}
            <LingGenMini spiritualRoots={enemy.spiritual_roots} />

            {/* 技能 */}
            {enemy.skills && enemy.skills.length > 0 && (
              <div className="text-sm">
                <div className="text-ink-secondary mb-1">技能:</div>
                <div className="space-y-1">
                  {enemy.skills.map((skill, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span>
                        {skill.name} ({skill.element})
                      </span>
                      <span className="text-ink-secondary">
                        {skill.description ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 描述 */}
            {enemy.background && (
              <p className="text-ink-secondary text-xs leading-relaxed italic">
                {enemy.background}
              </p>
            )}
          </InkCard>
        )}

        {/* 底部：操作按钮 */}
        <div className="space-y-3">
          {/* 神识查探按钮 */}
          {!showDetails && (
            <InkButton
              variant="secondary"
              className="w-full py-3"
              onClick={handleProbe}
              disabled={!enemy}
            >
              {enemy ? '👁️ 神识查探' : '查探中...'}
            </InkButton>
          )}

          {/* 开始战斗按钮 */}
          <InkButton
            variant="primary"
            className="w-full py-4 text-lg"
            onClick={handleStart}
          >
            ⚔️ 开始战斗
          </InkButton>

          {/* 放弃战斗按钮 */}
          <InkButton
            variant="ghost"
            className="text-ink-secondary hover:text-crimson w-full py-2"
            onClick={handleAbandon}
          >
            🏃 放弃战斗（撤退）
          </InkButton>
        </div>
      </InkCard>
    </InkPageShell>
  );
}
