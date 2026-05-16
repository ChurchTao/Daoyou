import { GameSceneAsideSection, GameSceneFrame } from '@app/components/game-shell';
import { InkSection } from '@app/components/layout';
import { InkActionGroup } from '@app/components/ui/InkActionGroup';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';

export default function CraftPage() {
  const { note } = useCultivator();

  return (
    <GameSceneFrame
      variant="lite"
      title="【造物仙炉】"
      description="天地为炉，造化为工。先分清此刻是要炼器成兵，还是炼丹调息，再携合适灵材入室。"
      headerMeta={
        note ? (
          <div className="battle-note">
            <p className="text-sm leading-7">{note}</p>
          </div>
        ) : undefined
      }
      aside={
        <>
          <GameSceneAsideSection title="炉房分途">
            <div className="space-y-2 text-sm leading-7">
              <p>炼器室：矿材、妖骨、辅材入炉，锻出法宝形体。</p>
              <p>炼丹房：草木灵药调性，求疗伤、破境与炼体诸丹。</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection title="造物要诀" className="text-sm leading-7">
            <p>品阶越高、五行越契合，成品越稳。</p>
            <p className="mt-2">神念描述会直接影响成品的方向与气质。</p>
          </GameSceneAsideSection>
        </>
      }
      actionBar={
        <InkActionGroup>
          <InkButton href="/game/inventory">查看储物袋</InkButton>
          <InkButton href="/game/craft/refine" variant="primary">
            前往炼器室
          </InkButton>
          <InkButton href="/game/craft/alchemy">前往炼丹房</InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="选择造物之道">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InkCard className="flex flex-col items-center p-4 text-center">
            <div className="mb-2 text-4xl">🔥</div>
            <h3 className="text-ink-primary mb-2 text-xl font-bold">
              【炼器之道】
            </h3>
            <p className="text-ink-secondary mb-4 min-h-10 text-sm">
              引地火之威，锻造法宝神兵。
              <br />
              可投入矿材、妖骨与辅材，灵药与秘籍不可入炉。
            </p>
            <InkButton href="/game/craft/refine" variant="primary">
              前往炼器室
            </InkButton>
          </InkCard>

          <InkCard className="flex flex-col items-center p-4 text-center">
            <div className="mb-2 text-4xl">🌕</div>
            <h3 className="text-ink-primary mb-2 text-xl font-bold">
              【炼丹之道】
            </h3>
            <p className="text-ink-secondary mb-4 min-h-10 text-sm">
              调阴阳之气，炼制灵丹妙药。
              <br />
              需消耗灵草灵果。
            </p>
            <InkButton href="/game/craft/alchemy" variant="primary">
              前往炼丹房
            </InkButton>
          </InkCard>
        </div>
      </InkSection>

      <InkSection title="关于造物">
        <div className="text-ink-secondary space-y-2 text-sm">
          <p>
            • 造物需消耗对应的灵材，材料的<strong>品阶</strong>与
            <strong>五行属性</strong>将直接影响成品的品质。
          </p>
          <p>
            • 注入的<strong>神念（提示词）</strong>
            至关重要，它决定了成品的形态与功效。
          </p>
          <p>
            • 炼器以矿材、妖骨与辅材铸骨立形；炼丹仍以草木灵药调和药性。
          </p>
        </div>
      </InkSection>
    </GameSceneFrame>
  );
}
