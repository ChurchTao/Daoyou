import { toFateDisplayModel } from '@app/components/feature/fates/FateDisplayAdapter';
import { FateEffectInlineList } from '@app/components/feature/fates/FateEffectInlineList';
import { InkList, InkNotice } from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';
import type { CultivatorInspectionData } from '@daoyou/shared/contracts/player';

export function CultivatorFateSection({
  cultivator,
}: {
  cultivator: CultivatorInspectionData;
}) {
  const fates = cultivator.pre_heaven_fates ?? [];

  return (
    <section className="space-y-3">
      <h5 className="text-ink font-semibold">命格</h5>
      {fates.length === 0 ? (
        <InkNotice>暂无命格</InkNotice>
      ) : (
        <InkList>
          {fates.map((fate, index) => {
            const display = toFateDisplayModel(fate);
            return (
              <ItemCard
                key={`${fate.name}-${index}`}
                icon="🔮"
                name={fate.name}
                quality={fate.quality}
                meta={<FateEffectInlineList lines={display.previewLines} />}
                description={fate.description}
                layout="col"
              />
            );
          })}
        </InkList>
      )}
    </section>
  );
}
