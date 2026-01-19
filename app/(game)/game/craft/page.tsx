'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { InkActionGroup, InkButton, InkCard } from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { usePathname } from 'next/navigation';

export default function CraftPage() {
  const { note } = useCultivator();
  const pathname = usePathname();

  return (
    <InkPageShell
      title="【造物仙炉】"
      subtitle="天地为炉，造化为工"
      backHref="/game"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup>
          <InkButton href="/game/inventory">查看储物袋</InkButton>
          <InkButton href="/game">返回主界</InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="选择造物之道">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InkCard className="p-4 flex flex-col items-center text-center">
            <div className="text-4xl mb-2">🔥</div>
            <h3 className="text-xl font-bold text-ink-primary mb-2">
              【炼器之道】
            </h3>
            <p className="text-sm text-ink-secondary mb-4 min-h-10">
              引地火之威，锻造法宝神兵。
              <br />
              需消耗金石矿材。
            </p>
            <InkButton href="/game/craft/refine" variant="primary">
              前往炼器室
            </InkButton>
          </InkCard>

          <InkCard className="p-4 flex flex-col items-center text-center">
            <div className="text-4xl mb-2">🌕</div>
            <h3 className="text-xl font-bold text-ink-primary mb-2">
              【炼丹之道】
            </h3>
            <p className="text-sm text-ink-secondary mb-4 min-h-10">
              调阴阳之气，炼制灵丹妙药。
              <br />
              需消耗灵草灵果。
            </p>
            <InkButton href="/game/craft/alchemy" variant="primary">
              前往炼丹房
            </InkButton>
          </InkCard>

          <InkCard className="p-4 flex flex-col items-center text-center">
            <div className="text-4xl mb-2">📖</div>
            <h3 className="text-xl font-bold text-ink-primary mb-2">
              【参悟之道】
            </h3>
            <p className="text-sm text-ink-secondary mb-4 min-h-10">
              研习功法典籍，参悟神通妙法。
              <br />
              需消耗功法残页或典籍。
            </p>
            <InkButton href="/game/craft/enlighten" variant="primary">
              前往悟道室
            </InkButton>
          </InkCard>
        </div>
      </InkSection>

      <InkSection title="关于造物">
        <div className="text-sm text-ink-secondary space-y-2">
          <p>
            • 造物需消耗对应的灵材，材料的<strong>品阶</strong>与
            <strong>五行属性</strong>将直接影响成品的品质。
          </p>
          <p>
            • 注入的<strong>神念（提示词）</strong>
            至关重要，它决定了成品的形态与功效。
          </p>
          <p>
            • 炼器可得神兵利器，永久提升战力；炼丹可得灵丹妙药，永久提升属性。
          </p>
        </div>
      </InkSection>
    </InkPageShell>
  );
}
