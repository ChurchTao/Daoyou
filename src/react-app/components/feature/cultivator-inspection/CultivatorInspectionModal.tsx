import { InkModal } from '@app/components/layout/InkModal';
import { LingGenMini } from '@app/components/func/LingGen';
import { InkBadge } from '@app/components/ui';
import { BodyCultivationInspectionSection } from '@app/components/feature/cultivator/BodyCultivationPanels';
import type { Cultivator } from '@shared/types/cultivator';
import type { ReactNode } from 'react';
import { CultivatorAttributeTable } from './CultivatorAttributeTable';
import { CultivatorFateSection } from './CultivatorFateSection';
import { CultivatorLoadoutSections } from './CultivatorLoadoutSections';

export interface CultivatorInspectionModalProps {
  cultivator: Cultivator | null;
  isOpen: boolean;
  onClose: () => void;
  mode: 'enemy' | 'cultivator';
  badges?: ReactNode[];
}

export function CultivatorInspectionModal({
  cultivator,
  isOpen,
  onClose,
  mode,
  badges = [],
}: CultivatorInspectionModalProps) {
  if (!cultivator) {
    return null;
  }

  const background = cultivator.background ?? cultivator.description;

  return (
    <InkModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'enemy' ? '敌情查探' : '神识查探'}
      className="max-w-3xl"
    >
      <div className="space-y-5">
        <section className="space-y-3 text-center">
          <div className="text-4xl">👁️</div>
          <div className="space-y-2">
            <h4 className="text-ink text-xl font-semibold">
              {cultivator.name}
            </h4>
            {cultivator.title ? (
              <p className="text-ink-secondary text-sm leading-6">
                「{cultivator.title}」
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <InkBadge tier={cultivator.realm}>
              {cultivator.realm_stage}
            </InkBadge>
            {cultivator.gender ? (
              <InkBadge tone="default">{cultivator.gender}</InkBadge>
            ) : null}
            {badges.map((badge, index) => (
              <div key={index}>{badge}</div>
            ))}
          </div>
          {background ? (
            <p className="text-ink-secondary mx-auto max-w-2xl text-sm leading-7">
              {background}
            </p>
          ) : null}
        </section>

        {cultivator.spiritual_roots?.length ? (
          <section>
            <LingGenMini spiritualRoots={cultivator.spiritual_roots} />
          </section>
        ) : null}

        <BodyCultivationInspectionSection cultivator={cultivator} />
        <CultivatorAttributeTable cultivator={cultivator} />
        <CultivatorLoadoutSections cultivator={cultivator} />
        {mode === 'cultivator' ? (
          <CultivatorFateSection cultivator={cultivator} />
        ) : null}
      </div>
    </InkModal>
  );
}
