import { DungeonProgressCard } from '@/components/dungeon/DungeonProgressCard';
import { InkPageShell, InkSection } from '@/components/layout';
import { InkButton } from '@/components/ui/InkButton';
import { InkCard } from '@/components/ui/InkCard';
import { DungeonState } from '@/lib/dungeon/types';

interface DungeonLootingProps {
  state: DungeonState;
  onContinue: () => Promise<void>;
  onEscape: () => Promise<void>;
  onQuit: () => Promise<boolean>;
  processing: boolean;
}

export function DungeonLooting({
  state,
  onContinue,
  onEscape,
  onQuit,
  processing,
}: DungeonLootingProps) {
  return (
    <InkPageShell title="战后休整" backHref="/game">
      <InkCard className="mb-6 p-6">
        <h3 className="text-xl font-bold mb-4 text-center text-ink">战斗胜利</h3>
        <p className="text-ink-secondary text-center mb-6 leading-relaxed">
          你击退了强敌，有惊无险地度过了此轮。
          <br />
          目前位于副本第 {state.currentRound} 轮。前方气息变幻，你可以选择继续深入，或就此离去。
        </p>
      </InkCard>

      {/* 副本状态和进度（包含已获机缘展示） */}
      <DungeonProgressCard state={state} onQuit={onQuit} />

      <InkSection title="下一步抉择">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2 p-4 border border-ink/20 bg-paper rounded text-center">
            <h4 className="font-bold">继续深入</h4>
            <p className="text-xs text-ink-secondary mb-4">
              向秘境更深处进发，寻找更大的机缘。
            </p>
            <InkButton
              variant="primary"
              disabled={processing}
              onClick={onContinue}
              className="mt-auto"
            >
              {processing ? '推演中...' : '继续深入'}
            </InkButton>
          </div>

          <div className="flex flex-col gap-2 p-4 border border-ink/20 bg-paper rounded text-center">
            <h4 className="font-bold">见好就收</h4>
            <p className="text-xs text-ink-secondary mb-4">
              带着当前的收获直接离开秘境。
            </p>
            <InkButton
              variant="outline"
              disabled={processing}
              onClick={onEscape}
              className="mt-auto"
            >
              {processing ? '结算中...' : '离开秘境'}
            </InkButton>
          </div>
        </div>
      </InkSection>
    </InkPageShell>
  );
}
