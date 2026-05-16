import { GameSceneAsideSection, GameSceneFrame } from '@app/components/game-shell';
import { InkSection } from '@app/components/layout';
import { InkActionGroup } from '@app/components/ui/InkActionGroup';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';

export default function EnlightenmentPage() {
  const { note } = useCultivator();

  return (
    <GameSceneFrame
      variant="lite"
      title="【藏经阁】"
      description="万法归宗，神念通玄。这里不再只是门户，而是决定你此刻要推演神通、参悟功法，还是先去求卷补足底稿。"
      headerMeta={
        note ? (
          <div className="battle-note">
            <p className="text-sm leading-7">{note}</p>
          </div>
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
          <GameSceneAsideSection title="先做什么" className="text-sm leading-7">
            <p>若缺秘籍底稿，宜先去问法寻卷。</p>
            <p className="mt-2">若已有待纳入的新法门，处理取舍优先级最高。</p>
          </GameSceneAsideSection>
        </>
      }
      actionBar={
        <InkActionGroup>
          <InkButton href="/game/skills">查看神通</InkButton>
          <InkButton href="/game/techniques">查看功法</InkButton>
          <InkButton href="/game/enlightenment/manual-draw" variant="primary">
            问法寻卷
          </InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="感悟之道">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InkCard className="flex flex-col items-center p-4 text-center">
            <div className="mb-2 text-4xl">⚡</div>
            <h3 className="text-ink-primary mb-2 text-xl font-bold">
              【神通推演】
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
            <div className="mb-2 text-4xl">📖</div>
            <h3 className="text-ink-primary mb-2 text-xl font-bold">
              【功法参悟】
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
      </InkSection>

      <InkSection title="关于藏经阁">
        <div className="text-ink-secondary space-y-2 text-sm">
          <p>• 此处是修仙者感悟天地、创造法门之地。</p>
          <p>
            • <strong>神通推演</strong>
            ：基于自身灵根、悟性与法宝，创造独特的主动技能。
            <br />
            可投入草木、妖骨、辅材与神通秘籍；若缺少神通秘籍，可用能量会被削减。
          </p>
          <p>
            • <strong>功法参悟</strong>
            ：创造被动功法，提升基础属性与修炼速度。
            <br />
            可投入草木、妖骨、辅材与功法秘籍；若缺少功法秘籍，可用能量会被削减。
          </p>
        </div>
      </InkSection>
    </GameSceneFrame>
  );
}
