import { SectMap } from '@app/components/feature/sect/SectMap';
import { useSectTasksQuery } from '@app/components/feature/sect/sectResources';
import { usePlayerSession } from '@app/lib/resources/player';
import { resolveMapReturnHref } from '@app/lib/router/mapNavigation';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import { getSectLandmarkBySectId } from '@daoyou/game-content/world/map';
import { productionSectRuntime } from '@daoyou/game-rules/sect-organization/production';
import { lazy, useCallback } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { SectImmersiveFrame } from '../components/SectImmersiveFrame';
import { SectMapLocationPanel } from '../components/SectMapLocationPanel';

const SectForeignGateConversation = lazy(async () => ({
  default: (await import('../foreign-gate/route')).SectForeignGateConversation,
}));

export default function SectVisitPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { sectId = '' } = useParams();
  const session = usePlayerSession();
  const tasks = useSectTasksQuery();
  const activeSectId = session.data?.activeCultivator?.sectId ?? null;
  const landmark = getSectLandmarkBySectId(sectId);
  const worldMapHref = resolveMapReturnHref(
    landmark
      ? `/game/map-v2?intent=sect&nodeId=${encodeURIComponent(landmark.id)}`
      : '/game/map-v2?intent=sect',
    state,
  );
  const backToWorld = useCallback(
    () => navigate(worldMapHref, { replace: true }),
    [navigate, worldMapHref],
  );
  const definition = productionSectRuntime.registry.get(sectId)?.definition;
  const bounty = tasks.data?.items.find(
    (task) =>
      task.definitionId === 'weekly_bounty_battle' &&
      task.state === 'active' &&
      task.battleTarget?.sectId === sectId,
  );

  if (activeSectId === sectId) {
    return <Navigate to="/game/sect" replace />;
  }

  if (!definition || !landmark) {
    return (
      <SectImmersiveFrame
        title="山门不在此界"
        description="舆图上没有找到这处宗门，或山门暂时隐入云外。"
        backAction={{ label: '返回大世界', onBack: backToWorld }}
      />
    );
  }

  const presentation = getSectPresentation(definition.id);
  const visitorEntry = bounty
    ? {
        hotspotId: 'gate',
        label: '前往山门查探悬赏目标',
        route: `/game/sect/${encodeURIComponent(sectId)}/gate`,
      }
    : undefined;
  return (
    <>
      <title>
        {formatDocumentTitle(`${presentation.scenes.map.title} · 访宗`)}
      </title>
      <SectMap
        title={`${presentation.scenes.map.title} · 访宗`}
        backAction={{ label: '返回大世界', onBack: backToWorld }}
        mode="visitor"
        image={presentation.map.image}
        alt={presentation.map.alt}
        aspectRatio={presentation.map.aspectRatio}
        hotspots={presentation.map.hotspots}
        rooms={presentation.rooms}
        scenes={presentation.scenes}
        visitorEntry={visitorEntry}
        initialSelectedId={state?.sectMapSpotId === 'gate' ? 'gate' : undefined}
        renderLocation={({ spot, description, onClose }) => {
          const target = bounty?.battleTarget;
          if (spot.id !== 'gate' || !bounty || !target) return null;
          return (
            <SectMapLocationPanel
              key={spot.id}
              title={spot.label}
              description={description}
              actors={[
                {
                  id: 'bounty',
                  sigil: target.name.slice(0, 1),
                  name: target.name,
                  identity: '悬赏目标',
                  responsibility: `${target.realm}${target.realmStage}`,
                  portrait: target.portrait,
                },
              ]}
              onClose={onClose}
              renderConversation={(_, onExit) => (
                <SectForeignGateConversation
                  sectName={definition.name}
                  task={bounty}
                  onExit={onExit}
                  exitLabel="返回山门"
                />
              )}
            />
          );
        }}
        onNavigate={(route) =>
          navigate(route, { state: { mapReturnTo: worldMapHref } })
        }
      />
    </>
  );
}
