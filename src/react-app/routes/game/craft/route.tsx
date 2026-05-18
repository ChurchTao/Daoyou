import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneNote,
} from '@app/components/game-shell';
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
          <GameSceneNote>
            <p className="text-sm leading-7">{note}</p>
          </GameSceneNote>
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
          <GameSceneAsideSection title="造物细则" className="text-sm leading-7">
            <p>造物需消耗对应灵材，材料品阶与五行属性都会影响成品品质。</p>
            <p className="mt-2">炼器铸骨立形，炼丹调和药性；决定路线后再入炉更清楚。</p>
          </GameSceneAsideSection>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InkCard className="flex flex-col items-center p-4 text-center">
          <div className="mb-2 text-3xl">🔥</div>
          <h3 className="text-ink-primary mb-2 text-lg font-semibold">
            炼器
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
          <div className="mb-2 text-3xl">🌕</div>
          <h3 className="text-ink-primary mb-2 text-lg font-semibold">
            炼丹
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
    </GameSceneFrame>
  );
}
