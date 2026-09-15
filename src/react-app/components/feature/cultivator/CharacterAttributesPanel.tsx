import { CultivatorBiography } from '@app/components/feature/cultivator/CultivatorBiography';
import { CultivatorStatsPanel } from '@app/components/feature/cultivator/CultivatorStatsPanel';
import { CultivatorVitals } from '@app/components/feature/cultivator/CultivatorVitals';
import { useCultivatorDisplayProjection } from '@app/components/feature/cultivator/useCultivatorDisplayProjection';
import { getSectIdentityLabels } from '@app/components/feature/sect/sectIdentityDisplay';
import { useActiveSectContextQuery } from '@app/components/feature/sect/sectResources';
import { InkButton, InkDetailDrawer, InkNotice } from '@app/components/ui';
import { useState } from 'react';

export function CharacterAttributesPanel() {
  const projection = useCultivatorDisplayProjection();
  const sect = useActiveSectContextQuery();
  const [biographyOpen, setBiographyOpen] = useState(false);
  if (projection.error) return <InkNotice>{projection.error}</InkNotice>;
  if (!projection.data) return <InkNotice>正在读取角色属性……</InkNotice>;
  const { cultivator } = projection.data;
  const identity = sect.data ? getSectIdentityLabels(sect.data) : null;
  return (
    <div className="space-y-4">
      <div className="grid items-center gap-4 md:grid-cols-2 md:gap-8">
        <div className="flex items-center gap-4">
          <img
            src={`/assets/inventory/cultivator-${cultivator.gender === '女' ? 'female' : 'male'}-ink.webp`}
            alt=""
            className="h-20 w-14 shrink-0 object-contain mix-blend-multiply"
          />
          <div className="min-w-0 space-y-1 text-sm">
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-semibold">{cultivator.name}</span>
              {cultivator.title ? (
                <span className="text-crimson">{cultivator.title}</span>
              ) : null}
            </p>
            <p className="text-ink-secondary">
              {cultivator.realm} · {cultivator.realm_stage} ·{' '}
              {identity
                ? `${identity.sectName} · ${identity.rankLabel}`
                : '散修'}
            </p>
            <p className="text-ink-secondary">
              {cultivator.gender} · {cultivator.origin || '散修出身'}
            </p>
            <p className="text-ink-secondary">
              寿元{' '}
              <span className="font-mono">
                {cultivator.age} / {cultivator.lifespan}
              </span>{' '}
              年
            </p>
            <InkButton
              className="text-xs"
              onClick={() => setBiographyOpen(true)}
            >
              身世详情
            </InkButton>
          </div>
        </div>
        <CultivatorVitals projection={projection.data} />
      </div>
      <CultivatorStatsPanel key={cultivator.id} projection={projection.data} />
      <InkDetailDrawer
        isOpen={biographyOpen}
        onClose={() => setBiographyOpen(false)}
        title="身世详情"
        size="md"
      >
        <CultivatorBiography key={cultivator.id} />
      </InkDetailDrawer>
    </div>
  );
}
