import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneNote,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkTabs } from '@app/components/ui';
import { useActiveCultivatorProfile } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { fetchSectCatalog, fetchSectCurrent } from '@app/lib/sect/sectClient';
import type { SectCatalogData, SectCurrentData } from '@shared/contracts/sect';
import type { CultivatorSectState } from '@shared/engine/sect';
import { useCallback, useEffect, useState } from 'react';
import { CommissionsTab } from './components/CommissionsTab';
import { GateTab } from './components/GateTab';
import { MethodsTab } from './components/MethodsTab';
import { PathsTab } from './components/PathsTab';

const tabs = [
  { value: 'gate', label: '山门' },
  { value: 'methods', label: '心法' },
  { value: 'paths', label: '流派' },
  { value: 'commissions', label: '委托' },
];

export default function SectPage() {
  const [catalog, setCatalog] = useState<SectCatalogData>();
  const [data, setData] = useState<SectCurrentData>();
  const [tab, setTab] = useState('gate');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();
  const cultivator = useActiveCultivatorProfile();

  const reload = useCallback(async () => {
    const [nextCatalog, nextData] = await Promise.all([
      fetchSectCatalog(),
      fetchSectCurrent(),
    ]);
    setCatalog(nextCatalog);
    setData(nextData);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchSectCatalog(), fetchSectCurrent()])
      .then(([nextCatalog, nextData]) => {
        if (!cancelled) {
          setCatalog(nextCatalog);
          setData(nextData);
        }
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : '宗门卷宗读取失败',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const action = useCallback(
    async (url: string, init: RequestInit) => {
      setBusy(true);
      try {
        await mutate<{ sect: CultivatorSectState }>(fetch(url, init));
        await reload();
        pushToast({ message: '宗门事务已办妥', tone: 'success' });
      } catch (reason) {
        pushToast({
          message: reason instanceof Error ? reason.message : '宗门事务失败',
          tone: 'danger',
        });
      } finally {
        setBusy(false);
      }
    },
    [mutate, pushToast, reload],
  );

  if (!catalog || !data)
    return <GameSceneLoading message="山门云阶渐次显现……" />;

  const definition = data.definition;
  const sect = data.sect;
  return (
    <GameSceneFrame
      title={definition ? `【${definition.name}】` : '【诸宗山门】'}
      description={
        definition?.description ??
        '诸宗传承各有所长，可先试其法，再择一门而入。'
      }
      headerMeta={
        error ? <GameSceneNote tone="danger">{error}</GameSceneNote> : undefined
      }
      aside={
        <div className="space-y-2 text-sm leading-7">
          <p>
            种族：{catalog.playerRace === 'human' ? '人族' : catalog.playerRace}
          </p>
          <p>身份：{sect ? `${definition?.name ?? '宗门'}弟子` : '山外散修'}</p>
          {sect ? <p>贡献：{sect.contribution}</p> : null}
        </div>
      }
    >
      <InkTabs items={tabs} activeValue={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'gate' ? (
          <GateTab catalog={catalog} busy={busy} action={action} />
        ) : null}
        {tab === 'methods' ? (
          <MethodsTab
            data={data}
            busy={busy}
            action={action}
            realm={cultivator?.realm ?? '炼气'}
            stage={cultivator?.realm_stage ?? '初期'}
          />
        ) : null}
        {tab === 'paths' ? (
          <PathsTab
            data={data}
            busy={busy}
            action={action}
            realm={cultivator?.realm ?? '炼气'}
            stage={cultivator?.realm_stage ?? '初期'}
          />
        ) : null}
        {tab === 'commissions' ? (
          <CommissionsTab data={data} busy={busy} action={action} />
        ) : null}
      </div>
    </GameSceneFrame>
  );
}
