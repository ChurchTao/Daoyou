import { SectMap } from '@app/components/feature/sect/SectMap';
import {
  getSectDefinition,
  getSectPresentationForContext,
  useSectContextQuery,
  useSectInfrastructureQuery,
} from '@app/components/feature/sect/sectResources';
import { GameSceneFrame, GameSceneLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { SectQueryError } from './components/SectScene';

export default function SectPage() {
  const navigate = useNavigate();

  const context = useSectContextQuery();
  const infrastructure = useSectInfrastructureQuery();
  const currentPresentation = getSectPresentationForContext(context.data);
  const error = context.error ?? infrastructure.error;

  const facilities = useMemo(
    () =>
      new Map(infrastructure.data?.facilities.map((item) => [item.key, item])),
    [infrastructure.data?.facilities],
  );

  if (error === '尚未拜入宗门') {
    return (
      <GameSceneFrame
        title="诸宗山门"
        description="你还没有拜入山门，仍以散修身份行走。"
        identityOverride={{
          label: '诸宗山门',
          summary: '你还没有拜入山门，仍以散修身份行走。',
        }}
      >
        <p data-guide="sect.self" className="text-ink-secondary text-sm leading-7">
          山门没有拦你。想认一认诸宗，可以自己进去看看；眼下洞府里的路也走得通。
        </p>
        <span data-guide="sect.door" className="mt-4 inline-flex">
          <InkButton href="/game/sect/onboarding" variant="primary">
            去看看山门
          </InkButton>
        </span>
      </GameSceneFrame>
    );
  }

  if (error)
    return (
      <SectQueryError
        error={error}
        retry={() =>
          void Promise.all([context.retry(), infrastructure.retry()])
        }
      />
    );
  if (!context.data || !infrastructure.data)
    return (
      <GameSceneLoading message={currentPresentation.scenes.map.loadingText} />
    );

  const definition = getSectDefinition(context.data);
  const permissions = context.data.permissions;
  const presentation = getSectPresentation(definition.id);
  const mapScene = presentation.scenes.map;
  return (
    <GameSceneFrame
      title={`【${mapScene.title}】`}
      description={mapScene.description}
      identityOverride={{
        label: mapScene.title,
        summary: mapScene.description,
      }}
      contentClassName="lg:max-w-none"
    >
      <title>{formatDocumentTitle(mapScene.title)}</title>
      {presentation.map.image ? (
        <SectMap
          image={presentation.map.image}
          alt={presentation.map.alt}
          aspectRatio={presentation.map.aspectRatio}
          hotspots={presentation.map.hotspots}
          facilities={facilities}
          permissions={permissions}
          rooms={presentation.rooms}
          scenes={presentation.scenes}
          onNavigate={(route) => navigate(route)}
        />
      ) : (
        <div className="border-ink/15 bg-ink/10 grid gap-px border sm:grid-cols-2 lg:grid-cols-3">
          {presentation.map.hotspots.map((spot) => {
            const access = spot.permission
              ? permissions?.[spot.permission]
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
                <strong>{spot.label}</strong>
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
