import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import {
  BEAST_SPECIES,
  type SummonedBeast,
} from '@shared/engine/combat-v6/beasts';
import { fusionPreview } from '@shared/engine/combat-v6/beasts/fusion';
import { BEAST_FUSION } from '@shared/engine/combat-v6/beasts/fusion-config';

export function FusionPreview({
  first,
  second,
  reason,
  pending,
  onClose,
  onConfirm,
}: {
  first: SummonedBeast;
  second: SummonedBeast;
  reason: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const outcomes = fusionPreview(first, second);
  const percent = (chance: number) => `${Math.round(chance * 100)}%`;
  return (
    <InkDetailDrawer
      isOpen
      title="融合预览"
      description="看看这次融合可能迎来哪位新伙伴。"
      onClose={onClose}
      closeOnEscape={!pending}
      closeOnOverlayClick={!pending}
      footer={
        <div className="space-y-3">
          <p className="text-crimson text-sm leading-6">
            {first.name}与{second.name}
            将永久消耗，获得一只新灵兽。不额外收取灵石。
          </p>
          {reason && (
            <p role="alert" className="text-crimson text-sm">
              {reason}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <InkButton disabled={pending} onClick={onClose}>
              再想想
            </InkButton>
            <InkButton
              variant="primary"
              disabled={!!reason}
              pending={pending}
              pendingLabel="正在融合……"
              onClick={onConfirm}
            >
              消耗两只并融合
            </InkButton>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-sm">
        <section>
          <h3 className="mb-3 font-semibold">可能的新生灵兽</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {outcomes.map((outcome) => (
              <div key={outcome.speciesId} className="bg-ink/[0.025] p-4">
                <div className="flex items-center gap-3">
                  <BeastIcon
                    speciesId={outcome.speciesId}
                    className="text-6xl"
                  />
                  <div>
                    <p>
                      {
                        BEAST_SPECIES.find((s) => s.id === outcome.speciesId)
                          ?.name
                      }
                    </p>
                    <p className="text-teal font-mono">
                      {outcomes.length === 1 ? '100%' : '50%'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="border-ink/10 space-y-2 border-t pt-4 leading-7">
          <h3 className="font-semibold">技能和资质会怎么变？</h3>
          <p>
            新灵兽会拥有自身的天生必带技能。两只灵兽的其他技能，每个都有{' '}
            <span className="font-mono">
              {percent(BEAST_FUSION.skillChance)}
            </span>{' '}
            的机会留下；两只都会的技能，也只有一次机会。
          </p>
          <p className="text-ink-secondary">
            资质和成长会参考两只灵兽重新生成，可能变好，也可能变差，不保证比原来更强。
          </p>
        </section>
      </div>
    </InkDetailDrawer>
  );
}
