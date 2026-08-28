import { InkSection } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import type { CultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type { DungeonState } from '@shared/lib/dungeon/types';
import type { Cultivator } from '@shared/types/cultivator';
import { DungeonRunPanel } from './DungeonRunPanel';

interface DungeonLootingProps {
  state: DungeonState;
  cultivator: Pick<Cultivator, 'realm' | 'condition'> | null;
  displayResources?: CultivatorDisplaySnapshot['resources'];
  onContinue: () => Promise<void>;
  onEscape: () => Promise<void>;
  onQuit: () => Promise<boolean>;
  processing: boolean;
}

export function DungeonLooting({
  state,
  cultivator,
  displayResources,
  onContinue,
  onEscape,
  onQuit,
  processing,
}: DungeonLootingProps) {
  const isFinalRound = state.currentRound >= state.maxRounds;

  return (
    <div className="space-y-6 pb-28">
      <DungeonRunPanel
        state={state}
        cultivator={cultivator}
        displayResources={displayResources}
        onQuit={onQuit}
      />

      <InkCard className="mb-6 p-6">
        <h3 className="text-ink mb-4 text-center text-xl font-bold">
          战斗胜利
        </h3>
        <p className="text-ink-secondary mb-6 text-center leading-relaxed">
          你击退了强敌，有惊无险地度过了此轮。
          <br />
          {isFinalRound
            ? '五次事件已经完成，确认后将整理所得并结束本次探索。'
            : `目前位于副本第 ${state.currentRound} 轮。前方气息变幻，你可以选择继续深入，或就此离去。`}
        </p>
      </InkCard>

      <InkSection title={isFinalRound ? '收束此行' : '下一步抉择'}>
        <div
          className={
            isFinalRound
              ? 'mx-auto max-w-xl'
              : 'grid grid-cols-1 gap-4 md:grid-cols-2'
          }
        >
          <div className="border-ink/20 bg-paper flex flex-col gap-2 border border-dashed p-4 text-center">
            <h4 className="font-bold">
              {isFinalRound ? '完成探索' : '继续深入'}
            </h4>
            <p className="text-ink-secondary mb-4 text-xs">
              {isFinalRound
                ? '确认第五次事件的结果，进入最终结算。'
                : '向秘境更深处进发，寻找更大的机缘。'}
            </p>
            <InkButton
              variant="primary"
              pending={processing}
              pendingLabel="推演中……"
              onClick={onContinue}
              className="mt-auto"
            >
              {isFinalRound ? '完成探索' : '继续深入'}
            </InkButton>
          </div>

          {!isFinalRound ? (
            <div className="border-ink/20 bg-paper flex flex-col gap-2 border border-dashed p-4 text-center">
              <h4 className="font-bold">见好就收</h4>
              <p className="text-ink-secondary mb-4 text-xs">
                带着当前的收获直接离开秘境。
              </p>
              <InkButton
                variant="outline"
                pending={processing}
                pendingLabel="结算中……"
                onClick={onEscape}
                className="mt-auto"
              >
                离开秘境
              </InkButton>
            </div>
          ) : null}
        </div>
      </InkSection>
    </div>
  );
}
