import { GameSceneAsideSection, GameSceneFrame } from '@app/components/game-shell';
import { WorldChatPanel } from '@app/components/feature/world-chat/WorldChatPanel';
import { InkSection } from '@app/components/layout';
import { InkButton } from '@app/components/ui';

export default function WorldChatPage() {
  return (
    <GameSceneFrame
      title="世界传音"
      description="万界传音，八方同闻。这里是主流程里的公共频道场景，旁栏只保留最关键的社交去向与使用提醒。"
      aside={
        <GameSceneAsideSection title="传音规矩" className="text-sm leading-7">
          <p>重要情报先在此分发，私人物资和系统奖励仍以玉简为准。</p>
          <p className="mt-2">若想加入更稳定的外部交流，可转去玩家交流群。</p>
        </GameSceneAsideSection>
      }
      actionBar={
        <div className="flex flex-wrap gap-2">
          <InkButton href="/game/mail" variant="primary">
            查看传音玉简
          </InkButton>
          <InkButton href="/game/community">加入交流群</InkButton>
        </div>
      }
    >
      <InkSection title="【传音列表】">
        <WorldChatPanel />
      </InkSection>
    </GameSceneFrame>
  );
}
