import {
  useSectCurrentQuery,
  useSectPresentation,
  useSectResourceQuery,
} from '@app/components/feature/sect/SectQueryProvider';
import { GameSceneFrame, GameSceneLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import { fetchSectCatalog } from '@app/lib/sect/sectClient';
import {
  getSectFacilityLabel,
  getSectPresentation,
} from '@app/lib/sect/sectPresentation';
import {
  SECT_RANK_LABELS,
} from '@shared/engine/sect';
import { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { SectQueryError } from './components/SectScene';

export default function SectPage() {
  const navigate = useNavigate();

  const {
    data: catalog,
    error: catalogError,
    retry,
  } = useSectResourceQuery('catalog', fetchSectCatalog);
  const current = useSectCurrentQuery();
  const currentPresentation = useSectPresentation();
  const data = current.data;
  const error = catalogError ?? current.error;

  const facilities = useMemo(
    () => new Map(data?.overview?.facilities.map((item) => [item.key, item])),
    [data?.overview?.facilities],
  );

  if (error)
    return (
      <SectQueryError
        error={error}
        retry={() => void Promise.all([retry(), current.retry()])}
      />
    );
  if (!catalog || !data)
    return (
      <GameSceneLoading message={currentPresentation.scenes.map.loadingText} />
    );

  if (!data.sect || !data.definition) {
    return <Navigate to="/game/sect/onboarding" replace />;
  }

  const rank = data.sect.discipleRank ?? 'registered';
  const presentation = getSectPresentation(data.definition.id);
  const mapScene = presentation.scenes.map;
  return (
    <GameSceneFrame
      title={`【${mapScene.title}】`}
      description={mapScene.description}
      identityOverride={{
        label: mapScene.title,
        summary: mapScene.description,
      }}
      aside={
        <div className="space-y-2 text-sm leading-7">
          <p>身份：{SECT_RANK_LABELS[rank]}</p>
          <p>贡献：{data.sect.contribution}</p>
          <p>
            本周工程：
            {data.overview?.project
              ? `${getSectFacilityLabel(data.definition!.id, data.overview.project.facilityKey)}升至 ${data.overview.project.targetLevel} 级`
              : '长老议定中'}
          </p>
        </div>
      }
      contentClassName="lg:max-w-none"
    >
      <title>{formatDocumentTitle(mapScene.title)}</title>
      {presentation.map.image ? (
        <>
          <p className="text-ink-secondary text-sm">
            拖动舆图巡览群峰，滚轮或双指可缩放；聚焦设施即可查看其职司。
          </p>
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
                <div
                  className="absolute top-3 right-3 z-20 flex gap-1 bg-[rgba(247,241,224,0.88)] px-2 py-1 shadow-md backdrop-blur-sm"
                  aria-label="宗门地图缩放控件"
                >
                  <InkButton
                    onClick={() => zoomOut()}
                    className="focus-visible:outline-crimson focus-visible:outline-2"
                  >
                    缩小
                  </InkButton>
                  <InkButton
                    onClick={() => zoomIn()}
                    className="focus-visible:outline-crimson focus-visible:outline-2"
                  >
                    放大
                  </InkButton>
                  <InkButton
                    onClick={() => resetTransform()}
                    className="focus-visible:outline-crimson focus-visible:outline-2"
                  >
                    复位
                  </InkButton>
                </div>
                <TransformComponent
                  wrapperClass="!w-full !h-auto aspect-[1672/941] cursor-grab active:cursor-grabbing"
                  contentClass="!w-full !h-full"
                >
                  <div className="relative aspect-[1672/941] w-full">
                    <img
                      src={presentation.map.image}
                      alt={presentation.map.alt}
                      className="pointer-events-none block h-full w-full object-cover select-none"
                      draggable={false}
                    />
                    {presentation.map.hotspots.map((spot) => {
                      const facility = spot.facility
                        ? facilities.get(spot.facility)
                        : undefined;
                      const access = spot.permission
                        ? data.overview?.permissions?.[spot.permission]
                        : undefined;
                      const disabled =
                        spot.locked || !spot.route || access?.granted === false;
                      return (
                        <button
                          key={spot.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (spot.route) navigate(spot.route);
                          }}
                          style={{ left: spot.left, top: spot.top }}
                          className={`group absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border px-2.5 py-1.5 text-center shadow-[0_3px_14px_rgba(26,20,15,0.28)] backdrop-blur-sm transition focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 ${disabled ? 'border-ink/25 bg-ink/70 cursor-not-allowed text-white/70 focus-visible:outline-white' : 'border-crimson/40 hover:border-crimson focus-visible:outline-crimson bg-[rgba(250,245,230,0.9)] hover:z-10 hover:-translate-y-[55%]'}`}
                        >
                          <strong className="block text-xs whitespace-nowrap sm:text-sm">
                            {spot.label}
                            {facility && !spot.locked
                              ? ` · ${facility.level}级`
                              : ''}
                          </strong>
                          <span className="block max-h-0 overflow-hidden text-[10px] whitespace-nowrap opacity-0 transition-all group-hover:max-h-5 group-hover:opacity-75 group-focus-visible:max-h-5 group-focus-visible:opacity-75 sm:text-[11px]">
                            {access?.granted === false
                              ? access.reason
                              : spot.note}
                            {spot.locked ? ' · 锁定' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </TransformComponent>
              </div>
            )}
          </TransformWrapper>
        </>
      ) : (
        <div className="border-ink/15 bg-ink/10 grid gap-px border sm:grid-cols-2 lg:grid-cols-3">
          {presentation.map.hotspots.map((spot) => {
            const facility = spot.facility
              ? facilities.get(spot.facility)
              : undefined;
            const access = spot.permission
              ? data.overview?.permissions?.[spot.permission]
              : undefined;
            const disabled =
              spot.locked || !spot.route || access?.granted === false;
            return (
              <button
                key={spot.id}
                type="button"
                disabled={disabled}
                onClick={() => spot.route && navigate(spot.route)}
                className="bg-paper/90 min-h-24 p-4 text-left transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <strong>
                  {spot.label}
                  {facility ? ` · ${facility.level}级` : ''}
                </strong>
                <p className="text-ink-secondary mt-2 text-sm">
                  {access?.granted === false ? access.reason : spot.note}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </GameSceneFrame>
  );
}
