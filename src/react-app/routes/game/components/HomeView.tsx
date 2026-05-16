import { GameSceneFrame } from '@app/components/game-shell';
import { CultivatorStatusCard } from '@app/components/feature/cultivator/CultivatorStatusCard';
import { LifespanStatusCard } from '@app/components/feature/cultivator/LifespanStatusCard';
import { YieldCard } from '@app/components/feature/cultivator/YieldCard';
import { DivineFortune } from '@app/components/feature/home/DivineFortune';
import { RecentBattles } from '@app/components/feature/ranking/RecentBattles';
import { WorldChatPreview } from '@app/components/feature/world-chat/WorldChatPreview';
import { InkSection } from '@app/components/layout';
import { InkButton, InkNotice } from '@app/components/ui';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { PersistentStatusesCard } from './PersistentStatusesCard';

function CaveAside() {
  return (
    <>
      <section className="border-battle-rule-strong border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4">
        <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
          今日卜辞
        </div>
        <DivineFortune />
      </section>

      <section className="border-battle-rule-strong border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4">
        <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
          世界传音
        </div>
        <WorldChatPreview />
      </section>

      <section className="border-battle-rule-strong border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4">
        <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
          近期战绩
        </div>
        <RecentBattles />
      </section>
    </>
  );
}

export function HomeView() {
  const { cultivator, isLoading, note, refresh } = useCultivator();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">正在推演天机……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <InkNotice>
          尚未觉醒灵根，无法入驻洞府。
          <InkButton href="/game/create" variant="primary" className="ml-2">
            前往觉醒
          </InkButton>
        </InkNotice>
      </div>
    );
  }

  return (
    <GameSceneFrame
      eyebrow="主场景"
      title="【洞府】"
      description="纸窗半启，炉火未熄。昨夜云游归来后，气机、伤势与所得都在这里汇总，今日行止先从整顿自身开始。"
      headerMeta={
        note ? (
          <div className="battle-note">
            <p className="text-sm leading-7">{note}</p>
          </div>
        ) : undefined
      }
      aside={<CaveAside />}
      actionBar={
        <div className="flex flex-wrap gap-2">
          <InkButton href="/game/retreat" variant="primary">
            闭关修炼
          </InkButton>
          <InkButton href="/game/craft/alchemy">前往丹房</InkButton>
          <InkButton href="/game/inventory">整理储物袋</InkButton>
          <InkButton href="/game/map?intent=market">前往坊市</InkButton>
          <InkButton href="/game/mail">查看玉简</InkButton>
        </div>
      }
    >
      <InkSection title="【当前道身】">
        <PersistentStatusesCard />
        {cultivator.id ? (
          <div className="mt-3">
            <LifespanStatusCard cultivatorId={cultivator.id} />
          </div>
        ) : null}
        {cultivator.cultivation_progress ? (
          <div className="mt-3">
            <CultivatorStatusCard cultivator={cultivator} showTitle={false} />
          </div>
        ) : null}
      </InkSection>

      <InkSection title="【历练回写】">
        <YieldCard cultivator={cultivator} onOk={() => void refresh()} />
      </InkSection>
    </GameSceneFrame>
  );
}
