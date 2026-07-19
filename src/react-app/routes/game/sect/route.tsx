import {
  GameSceneFrame,
  GameSceneLoading,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { fetchSectCatalog, fetchSectCurrent } from '@app/lib/sect/sectClient';
import {
  SECT_FACILITY_LABELS,
  SECT_RANK_LABELS,
  type CultivatorSectState,
} from '@shared/engine/sect';
import { useCallback, useMemo, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { useNavigate } from 'react-router';
import { GateTab } from './components/GateTab';
import { SectQueryError, useSectQuery } from './components/SectScene';
import { SECT_MAP_HOTSPOTS } from './mapConfig';

export default function SectPage() {
  const [busy, setBusy] = useState(false);
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();
  const navigate = useNavigate();

  const loader = useCallback(async (signal: AbortSignal) => {
    const [catalog, data] = await Promise.all([
      fetchSectCatalog(signal),
      fetchSectCurrent(signal),
    ]);
    return { catalog, data };
  }, []);
  const { data: query, error, reload, retry } = useSectQuery(loader);
  const catalog = query?.catalog;
  const data = query?.data;

  const action = useCallback(
    async (url: string, init: RequestInit) => {
      setBusy(true);
      try {
        await mutate<{ sect: CultivatorSectState }>(fetch(url, init));
        await reload();
        pushToast({ message: '拜师礼成，宗门舆图已开启', tone: 'success' });
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

  const facilities = useMemo(
    () => new Map(data?.overview?.facilities.map((item) => [item.key, item])),
    [data?.overview?.facilities],
  );

  if (error) return <SectQueryError error={error} retry={() => void retry()} />;
  if (!catalog || !data)
    return <GameSceneLoading message="山门云阶渐次显现……" />;

  if (!data.sect || !data.definition) {
    return (
      <GameSceneFrame
        title="【诸宗山门】"
        description="诸宗传承各有所长，可先试其法，再择一门而入。"
      >
        <GateTab catalog={catalog} busy={busy} action={action} />
      </GameSceneFrame>
    );
  }

  const rank = data.sect.discipleRank ?? 'registered';
  return (
    <GameSceneFrame
      title={`【${data.definition.name}舆图】`}
      description="云海诸峰各司其职。择一处落下遁光，进入对应设施办理宗门事务。"
      aside={
        <div className="space-y-2 text-sm leading-7">
          <p>身份：{SECT_RANK_LABELS[rank]}</p>
          <p>贡献：{data.sect.contribution}</p>
          <p>本周工程：{data.overview?.project ? `${SECT_FACILITY_LABELS[data.overview.project.facilityKey]}升至 ${data.overview.project.targetLevel} 级` : '长老议定中'}</p>
        </div>
      }
      contentClassName="lg:max-w-none"
    >
      <p className="text-ink-secondary text-sm">拖动舆图巡览群峰，滚轮或双指可缩放；聚焦设施即可查看其职司。</p>

      <TransformWrapper
        initialScale={1}
        minScale={1}
        maxScale={3}
        centerOnInit
        limitToBounds
        wheel={{ step: 0.16 }}
        panning={{ velocityDisabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className="border-ink/20 relative overflow-hidden border bg-[#e9e1cf] shadow-inner">
            <div className="absolute top-3 right-3 z-20 flex gap-1 bg-[rgba(247,241,224,0.88)] px-2 py-1 shadow-md backdrop-blur-sm" aria-label="宗门地图缩放控件">
              <InkButton onClick={() => zoomOut()} className="focus-visible:outline-crimson focus-visible:outline-2">缩小</InkButton>
              <InkButton onClick={() => zoomIn()} className="focus-visible:outline-crimson focus-visible:outline-2">放大</InkButton>
              <InkButton onClick={() => resetTransform()} className="focus-visible:outline-crimson focus-visible:outline-2">复位</InkButton>
            </div>
            <TransformComponent
              wrapperClass="!w-full !h-auto aspect-[1672/941] cursor-grab active:cursor-grabbing"
              contentClass="!w-full !h-full"
            >
              <div className="relative aspect-[1672/941] w-full">
                <img
                  src="/assets/sect/lingxiao-map.webp"
                  alt="凌霄剑宗群峰、楼阁、灵脉矿场与药田的水墨鸟瞰图"
                  className="pointer-events-none block h-full w-full select-none object-cover"
                  draggable={false}
                />
                {SECT_MAP_HOTSPOTS.map((spot) => {
                  const facility = spot.facility ? facilities.get(spot.facility) : undefined;
                  const access = spot.permission
                    ? data.overview?.permissions?.[spot.permission]
                    : undefined;
                  const disabled = spot.locked || !spot.route || access?.granted === false;
                  return (
                    <button
                      key={spot.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (spot.route) navigate(spot.route);
                      }}
                      style={{ left: spot.left, top: spot.top }}
                      className={`group absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border px-2.5 py-1.5 text-center shadow-[0_3px_14px_rgba(26,20,15,0.28)] backdrop-blur-sm transition focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 ${disabled ? 'border-ink/25 bg-ink/70 cursor-not-allowed text-white/70 focus-visible:outline-white' : 'border-crimson/40 bg-[rgba(250,245,230,0.9)] hover:z-10 hover:-translate-y-[55%] hover:border-crimson focus-visible:outline-crimson'}`}
                    >
                      <strong className="block whitespace-nowrap text-xs sm:text-sm">{spot.label}{facility && facility.key !== 'formation' ? ` · ${facility.level}级` : ''}</strong>
                      <span className="block max-h-0 overflow-hidden whitespace-nowrap text-[10px] opacity-0 transition-all group-hover:max-h-5 group-hover:opacity-75 group-focus-visible:max-h-5 group-focus-visible:opacity-75 sm:text-[11px]">{access?.granted === false ? access.reason : spot.note}{spot.locked ? ' · 锁定' : ''}</span>
                    </button>
                  );
                })}
              </div>
            </TransformComponent>
          </div>
        )}
      </TransformWrapper>
    </GameSceneFrame>
  );
}
