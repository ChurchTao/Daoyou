import { CultivatorOverviewPanel, GameSceneFrame } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';

export default function CultivatorPage() {
  const { cultivator, isLoading } = useCultivator();

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">道友真形尚在凝聚……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <InkNotice>
          尚无角色资料，先去觉醒灵根，再来凝视真形。
          <InkButton href="/game/create" variant="primary" className="ml-2">
            觉醒灵根
          </InkButton>
        </InkNotice>
      </div>
    );
  }

  return (
    <GameSceneFrame
      eyebrow="HUD 深读"
      title="【道身总谱】"
      description="此页是顶部 HUD 的完整展开。所有即时状态、长期状态、根基属性与所修之物，都应先在 HUD 被感知，再在此处细读。"
      actionBar={
        <div className="flex flex-wrap gap-2">
          <InkButton href="/game">返回洞府</InkButton>
          <InkButton href="/game/inventory">查看储物袋</InkButton>
          <InkButton href="/game/retreat" variant="primary">
            返回修行
          </InkButton>
        </div>
      }
    >
      <CultivatorOverviewPanel />
    </GameSceneFrame>
  );
}
