import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import type { SectCatalogData } from '@shared/contracts/sect';
import { useNavigate } from 'react-router';
import { sectJsonRequest, type SectAction } from './types';

export function GateTab({
  catalog,
  busy,
  action,
}: {
  catalog: SectCatalogData;
  busy: boolean;
  action: SectAction;
}) {
  const navigate = useNavigate();
  if (catalog.activeSectId) {
    const active = catalog.sects.find(
      (entry) => entry.definition.id === catalog.activeSectId,
    );
    return (
      <InkNotice>
        名录已定：{active?.definition.name ?? catalog.activeSectId}弟子。
      </InkNotice>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {catalog.sects.map((entry) => (
        <InkCard key={entry.definition.id}>
          <h3 className="font-semibold">{entry.definition.name}</h3>
          <p className="text-ink-secondary mt-1 text-sm leading-7">
            {entry.definition.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <InkButton
              disabled={busy}
              onClick={() =>
                navigate(`/game/sect/trial/${entry.definition.id}`)
              }
            >
              {entry.experiencedAt
                ? `再次${entry.definition.trial.name}`
                : entry.definition.trial.name}
            </InkButton>
            {entry.experiencedAt ? (
              <InkButton
                variant="primary"
                disabled={busy}
                onClick={() =>
                  void action(
                    `/api/sects/${entry.definition.id}/join`,
                    sectJsonRequest('POST'),
                  )
                }
              >
                拜师入宗
              </InkButton>
            ) : null}
          </div>
        </InkCard>
      ))}
    </div>
  );
}
