'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { InkActionGroup } from '@/components/ui/InkActionGroup';
import { InkButton } from '@/components/ui/InkButton';
import { InkCard } from '@/components/ui/InkCard';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { usePathname } from 'next/navigation';

export default function EnlightenmentPage() {
  const { note } = useCultivator();
  const pathname = usePathname();

  return (
    <InkPageShell
      title="【藏经阁】"
      subtitle="万法归宗，神念通玄"
      backHref="/game"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup>
          <InkButton href="/game/skills">查看神通</InkButton>
          <InkButton href="/game">返回主界</InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="感悟之道">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InkCard className="p-4 flex flex-col items-center text-center">
            <div className="text-4xl mb-2">⚡</div>
            <h3 className="text-xl font-bold text-ink-primary mb-2">
              【神通推演】
            </h3>
            <p className="text-sm text-ink-secondary mb-4 min-h-10">
              感天地造化，推演攻伐妙术。
              <br />
              需消耗大量灵感与神念。
            </p>
            <InkButton href="/game/enlightenment/skill" variant="primary">
              开始推演
            </InkButton>
          </InkCard>

          <InkCard className="p-4 flex flex-col items-center text-center">
            <div className="text-4xl mb-2">📖</div>
            <h3 className="text-xl font-bold text-ink-primary mb-2">
              【功法参悟】
            </h3>
            <p className="text-sm text-ink-secondary mb-4 min-h-10">
              参悟大道法则，创造修炼功法。
              <br />
              需消耗功法典籍。
            </p>
            <InkButton href="/game/enlightenment/gongfa" variant="primary">
              开始参悟
            </InkButton>
          </InkCard>
        </div>
      </InkSection>

      <InkSection title="关于藏经阁">
        <div className="text-sm text-ink-secondary space-y-2">
          <p>• 此处是修仙者感悟天地、创造法门之地。</p>
          <p>
            • <strong>神通推演</strong>
            ：基于自身灵根、悟性与法宝，创造独特的主动技能。
            <br />
            需消耗功法典籍作为灵感来源。
          </p>
          <p>
            • <strong>功法参悟</strong>
            ：创造被动功法，提升基础属性与修炼速度。
            <br />
            需消耗功法典籍作为参悟基础。
          </p>
        </div>
      </InkSection>
    </InkPageShell>
  );
}
