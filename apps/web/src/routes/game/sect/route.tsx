import { SectMap } from '@app/components/feature/sect/SectMap';
import {
  getSectDefinition,
  getSectPresentationForContext,
  useSectContextQuery,
  useSectInfrastructureQuery,
} from '@app/components/feature/sect/sectResources';
import { GameLoadingState } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { SectImmersiveFrame } from './components/SectImmersiveFrame';
import { SectMemberMapLocation } from './components/SectMemberMapLocation';
import { SectQueryError } from './components/SectScene';

export default function SectPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const closeMap = () => navigate('/game', { replace: true });

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
      <SectImmersiveFrame
        title="诸宗山门"
        description="你还没有拜入山门，仍以散修身份行走。"
        backAction={{ label: '返回洞府', onBack: closeMap }}
      >
        <p
          data-guide="sect.self"
          className="text-ink-secondary text-sm leading-7"
        >
          可以先看看各宗门，再决定是否拜入。
        </p>
        <span data-guide="sect.door" className="mt-4 inline-flex">
          <InkButton href="/game/sect/onboarding" variant="primary">
            去看看山门
          </InkButton>
        </span>
      </SectImmersiveFrame>
    );
  }

  if (error)
    return (
      <SectQueryError
        error={error}
        backHref="/game"
        retry={() =>
          void Promise.all([context.retry(), infrastructure.retry()])
        }
      />
    );
  if (!context.data || !infrastructure.data)
    return (
      <GameLoadingState
        variant="immersive"
        message={currentPresentation.scenes.map.loadingText}
      />
    );

  const definition = getSectDefinition(context.data);
  const permissions = context.data.permissions;
  const presentation = getSectPresentation(definition.id);
  const mapScene = presentation.scenes.map;
  return (
    <>
      <title>{formatDocumentTitle(mapScene.title)}</title>
      <SectMap
        title={mapScene.title}
        backAction={{ label: '关闭地图', onBack: closeMap }}
        initialSelectedId={
          typeof state?.sectMapSpotId === 'string'
            ? state.sectMapSpotId
            : undefined
        }
        image={presentation.map.image}
        alt={presentation.map.alt}
        aspectRatio={presentation.map.aspectRatio}
        hotspots={presentation.map.hotspots}
        facilities={facilities}
        permissions={permissions}
        rooms={presentation.rooms}
        scenes={presentation.scenes}
        renderLocation={(location) => {
          const { spot } = location;
          if (
            (spot.id !== 'gate' && spot.id !== 'affairs') ||
            !spot.permission ||
            !permissions[spot.permission]?.granted
          )
            return null;
          const room = presentation.rooms[spot.id];
          return room ? (
            <SectMemberMapLocation
              key={spot.id}
              room={room}
              location={location}
            />
          ) : null;
        }}
        onNavigate={(route, sectMapSpotId) =>
          navigate(route, { state: { sectMapSpotId } })
        }
      />
    </>
  );
}
