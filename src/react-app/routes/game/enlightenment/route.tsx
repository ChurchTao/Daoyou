import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneNote,
} from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { usePlayerStateView } from '@app/lib/player-state/selectors';

export default function EnlightenmentPage() {
  const { note } = usePlayerStateView();

  return (
    <GameSceneFrame
      variant="lite"
      title="【悟道室】"
      description="万法归宗，神念通玄。这里不再只是门户，而是决定你此刻要推演神通、参悟功法，还是先去求卷补足底稿。"
      headerMeta={
        note ? (
          <GameSceneNote>
            <p className="text-sm leading-7">{note}</p>
          </GameSceneNote>
        ) : undefined
      }
      aside={
        <>
          <GameSceneAsideSection title="参悟分流">
            <div className="space-y-2 text-sm leading-7">
              <p>神通推演：更偏攻伐、辅助与施法方向。</p>
              <p>功法参悟：更偏根基、修炼速度与长期属性。</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection
            title="悟道说明"
            className="text-sm leading-7"
            help={{
              title: '悟道室参悟说明',
              content: (
                <div className="space-y-3 text-sm leading-7">
                  <div>
                    <p className="text-ink font-medium">先做什么</p>
                    <p className="text-ink-secondary">
                      若缺秘籍底稿，宜先去问法寻卷。
                    </p>
                    <p className="text-ink-secondary">
                      若已有待纳入的新法门，处理取舍优先级最高。
                    </p>
                  </div>
                  <div>
                    <p className="text-ink font-medium">悟道细则</p>
                    <p className="text-ink-secondary">
                      神通推演更偏施法方向，功法参悟更偏根基与长期成长。
                    </p>
                    <p className="text-ink-secondary">
                      缺秘籍时仍可参悟，但底稿越足，成果越稳。
                    </p>
                  </div>
                </div>
              ),
            }}
          />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InkCard className="flex flex-col items-center p-4 text-center">
          <div className="mb-2 text-3xl">⚡</div>
          <h3 className="text-ink-primary mb-2 text-lg font-semibold">
            神通推演
          </h3>
          <p className="text-ink-secondary mb-4 min-h-10 text-sm">
            感天地造化，推演攻伐妙术。
            <br />
            草木、妖骨与辅材皆可为引，神通秘籍最能定法。
          </p>
          <InkButton href="/game/enlightenment/skill" variant="primary">
            开始推演
          </InkButton>
        </InkCard>

        <InkCard className="flex flex-col items-center p-4 text-center">
          <div className="mb-2 text-3xl">📖</div>
          <h3 className="text-ink-primary mb-2 text-lg font-semibold">
            功法参悟
          </h3>
          <p className="text-ink-secondary mb-4 min-h-10 text-sm">
            参悟大道法则，创造修炼功法。
            <br />
            草木、妖骨与辅材可作底稿，功法秘籍最能稳固道基。
          </p>
          <InkButton href="/game/enlightenment/gongfa" variant="primary">
            开始参悟
          </InkButton>
        </InkCard>
      </div>
    </GameSceneFrame>
  );
}
