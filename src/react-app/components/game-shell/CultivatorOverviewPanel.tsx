import { CultivatorBiography } from '@app/components/feature/cultivator/CultivatorBiography';
import { CultivatorStatsPanel } from '@app/components/feature/cultivator/CultivatorStatsPanel';
import { CultivatorVitals } from '@app/components/feature/cultivator/CultivatorVitals';
import { useCultivatorDisplayProjection } from '@app/components/feature/cultivator/useCultivatorDisplayProjection';
import { getSectIdentityLabels } from '@app/components/feature/sect/sectIdentityDisplay';
import { useActiveSectContextQuery } from '@app/components/feature/sect/sectResources';
import { InkNotice, InkTabs } from '@app/components/ui';
import { useSearchParams } from 'react-router';

const tabs = [
  { value: 'attributes', label: '属性' },
  { value: 'biography', label: '身世' },
];

export function CultivatorOverviewPanel() {
  const projection = useCultivatorDisplayProjection();
  const sect = useActiveSectContextQuery();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'biography' ? 'biography' : 'attributes';
  if (projection.error) return <InkNotice>{projection.error}</InkNotice>;
  if (!projection.data) return <InkNotice>正在读取角色属性……</InkNotice>;
  const { cultivator } = projection.data;
  const identity = sect.data ? getSectIdentityLabels(sect.data) : null;
  return (
    <div className="space-y-4">
      <InkTabs
        items={tabs}
        activeValue={tab}
        onChange={(value) =>
          setParams(value === 'biography' ? { tab: value } : {})
        }
      />
      <div
        className={
          tab === 'attributes'
            ? 'grid items-center gap-4 md:grid-cols-2 md:gap-8'
            : ''
        }
      >
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
              寿元{' '}
              <span className="font-mono">
                {cultivator.age} / {cultivator.lifespan}
              </span>{' '}
              年
            </p>
          </div>
        </div>
        {tab === 'attributes' ? (
          <CultivatorVitals projection={projection.data} />
        ) : null}
      </div>
      {tab === 'biography' ? (
        <CultivatorBiography key={cultivator.id} />
      ) : (
        <CultivatorStatsPanel
          key={cultivator.id}
          projection={projection.data}
        />
      )}
    </div>
  );
}
