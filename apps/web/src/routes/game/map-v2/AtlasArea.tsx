import { LocalMapCanvas } from '@app/components/feature/map/LocalMapCanvas';
import {
  LocalMapText,
  LocalMapToolbar,
} from '@app/components/feature/map/LocalMapChrome';
import type {
  LocalMapController,
  LocalMapMarker,
} from '@app/components/feature/map/LocalMapRuntime';
import { buildMapLocationActions } from '@app/components/feature/map/mapActions';
import { MapLocationDrawer } from '@app/components/feature/map/MapLocationDrawer';
import { storyPassageActor } from '@app/components/feature/story/storyPassageActor';
import { StoryPassageDetail } from '@app/components/feature/story/StoryPassageDetail';
import { GameTaskIndicator } from '@app/components/game-shell/GameTaskIndicator';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useGameSettings } from '@app/lib/game-setting';
import { usePlayerSession } from '@app/lib/resources/player';
import { useStory } from '@app/lib/story/useStory';
import {
  getMapAreaContent,
  getMapPassage,
} from '@daoyou/game-content/world/map';
import type { StoryView } from '@daoyou/game-domain/story';
import { storySceneOpen } from '@daoyou/game-domain/story/gates';
import type {
  MapAreaPlace,
  MapNode,
  MapPassage,
  WorldMapLocation,
} from '@daoyou/game-domain/world/map';
import { sameMapPlace } from '@daoyou/game-domain/world/map';
import {
  getAtlasAreaLocations,
  getAtlasRegion,
  getAtlasShortName,
} from '@daoyou/game-rules/world/atlas';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { atlasAreaHref } from './areaNavigation';
import { AtlasNodePanel } from './AtlasNodePanel';

const directoryLabel = '地点名录';

export function AtlasArea({
  area,
  params,
  node,
}: {
  area: MapNode;
  params: URLSearchParams;
  node?: WorldMapLocation;
}) {
  const navigate = useNavigate();
  const { story } = useStory();
  const player = usePlayerSession();
  const { mapMode } = useGameSettings();
  const [requestedDirectory, setDirectoryOpen] = useState(false);
  const controller = useRef<LocalMapController | null>(null);
  const directoryTrigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLButtonElement>(null);
  const content = getMapAreaContent(area.id);
  const artwork = content?.artwork;
  const placeId = params.get('place') ?? params.get('site');
  const selectedPlace = content?.places.find(({ id }) => id === placeId);
  const selectedId = node?.id ?? selectedPlace?.id ?? null;
  const directoryOpen = requestedDirectory && selectedId === null;
  const activeLocation = story?.location;
  const storyPlaceId =
    activeLocation?.kind === 'area' && activeLocation.areaId === area.id
      ? activeLocation.placeId
      : undefined;
  const storyOnly = !storySceneOpen(story?.unlocked, 'map');
  const passage = story?.passage && getMapPassage(story.passage.id);
  const directions = story?.passage?.hint;
  const source =
    !node &&
    directions &&
    activeLocation?.kind === 'area' &&
    activeLocation.areaId === area.id &&
    activeLocation.placeId === params.get('from')
      ? content?.places.find(({ id }) => id === activeLocation.placeId)
      : undefined;
  const storyAtPlace =
    story &&
    selectedPlace &&
    activeLocation &&
    sameMapPlace(activeLocation, {
      kind: 'area',
      areaId: area.id,
      placeId: selectedPlace.id,
    })
      ? story
      : undefined;
  const region = getAtlasRegion(area);

  const gameplay = source || storyOnly ? [] : getAtlasAreaLocations(area.id);
  const hasLocalPlay =
    !source &&
    !storyOnly &&
    (area.market_config?.enabled || area.wild_encounter_id);
  const entries = [
    ...(content?.places ?? []).map((place) => ({
      id: place.id,
      label: place.name,
      note: place.description,
      kind: 'place' as const,
    })),
    ...(hasLocalPlay ? [area, ...gameplay] : gameplay).map((location) => ({
      id: location.id,
      label:
        location.id === area.id && area.market_config?.enabled
          ? '当地坊市'
          : getAtlasShortName(location),
      note: location.description,
      kind: 'node' as const,
    })),
  ];

  const markers = entries.flatMap<LocalMapMarker>((entry) => {
    const anchor = artwork?.anchors[entry.id];
    if (!anchor) return [];
    return [
      {
        id: entry.id,
        label:
          entry.id === source?.id ? `${entry.label} · 当前位置` : entry.label,
        x: anchor[0],
        y: anchor[1],
        current: entry.id === storyPlaceId,
        locked: false,
        selectable: true,
      },
    ];
  });
  const view = {
    markers,
    selectedId,
    blocked: directoryOpen || selectedId !== null,
  };

  useEffect(() => {
    if (selectedId !== null) return;
    const target = returnFocus.current;
    returnFocus.current = null;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      if (target.isConnected) target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId]);

  const areaId = area.id;
  const areaHref = atlasAreaHref(params, { area: areaId, from: source?.id });
  const placeHref = (id: string) =>
    atlasAreaHref(params, { area: areaId, place: id });
  const backAction = source
    ? {
        label: `回到${source.name}`,
        onBack: () => navigate(placeHref(source.id)),
      }
    : storyOnly && story
      ? {
          label: '回主线地点',
          onBack: () => navigate(story.href, { replace: true }),
        }
      : {
          label: `返回${region?.name ?? '世界舆图'}`,
          onBack: () =>
            navigate(
              atlasAreaHref(params, { region: region?.id, nodeId: areaId }),
            ),
        };
  const closeLocation = () => navigate(areaHref, { replace: true });
  const selectLocation = (id: string, trigger?: HTMLButtonElement) => {
    const entry = entries.find((item) => item.id === id);
    if (!entry) return;
    returnFocus.current = directoryOpen
      ? directoryTrigger.current
      : (trigger ?? null);
    setDirectoryOpen(false);
    navigate(
      atlasAreaHref(
        params,
        entry.kind === 'place'
          ? { area: areaId, site: id, from: source?.id }
          : { area: areaId, nodeId: id },
      ),
    );
  };
  const launch = (href: string) =>
    navigate(href, { state: { mapReturnTo: `/game/map-v2?${params}` } });
  const missingPlace = placeId && !selectedPlace && !node;
  const storyPlace = content?.places.find(({ id }) => id === storyPlaceId);
  const status = missingPlace ? (
    <p
      role="status"
      className="bg-paper/95 text-ink mx-auto mb-2 w-fit rounded-sm px-3 py-2 text-sm leading-6"
    >
      未找到该地点，请从地点名录选择。
    </p>
  ) : storyPlace ? (
    <GameTaskIndicator />
  ) : null;

  const directory = entries.length ? (
    <ul
      aria-label={directoryLabel}
      className="divide-ink/10 divide-y divide-dashed"
    >
      {entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            aria-current={entry.id === storyPlaceId ? 'location' : undefined}
            aria-pressed={entry.id === selectedId}
            className="hover:bg-ink/5 focus-visible:outline-crimson flex min-h-12 w-full items-center gap-3 px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
            onClick={(event) => selectLocation(entry.id, event.currentTarget)}
          >
            <span
              aria-hidden="true"
              className="bg-crimson size-2 shrink-0 rounded-full"
            />
            <span className="min-w-0 flex-1">
              <strong className="text-sm">{entry.label}</strong>
              {entry.id === source?.id ? (
                <span className="text-crimson ml-2 text-xs">当前位置</span>
              ) : entry.id === storyPlaceId ? (
                <span className="text-crimson ml-2 text-xs">主线地点</span>
              ) : null}
              <span className="text-ink-secondary mt-0.5 block text-xs leading-5">
                {entry.note}
              </span>
            </span>
            <span aria-hidden="true" className="text-ink-secondary">
              →
            </span>
          </button>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-ink-secondary text-sm">此地尚无可到访的地点。</p>
  );
  const canvasArtwork = mapMode === 'atlas' ? artwork : undefined;
  const mapTitle = source ? (artwork?.title ?? area.name) : area.name;
  const boardingStory =
    source &&
    selectedPlace &&
    passage?.to.kind === 'area' &&
    passage.to.areaId === area.id &&
    passage.to.placeId === selectedPlace.id
      ? story
      : undefined;
  const passageStory = boardingStory ?? (!source ? storyAtPlace : undefined);

  return (
    <div className="bg-paper absolute inset-0 overflow-hidden">
      {canvasArtwork ? (
        <LocalMapCanvas
          title={mapTitle}
          backAction={backAction}
          image={`/assets/maps/${canvasArtwork.file}`}
          alt={canvasArtwork.alt}
          aspectRatio={3 / 2}
          mapLabel="区域舆图"
          directoryLabel={directoryLabel}
          entryMarkerId={storyPlaceId}
          status={status}
          view={view}
          controller={controller}
          fallback={directory}
          onSelect={selectLocation}
          onClear={closeLocation}
          onOpenDirectory={(trigger) => {
            directoryTrigger.current = trigger;
            setDirectoryOpen(true);
          }}
          onError={() => setDirectoryOpen(false)}
        />
      ) : (
        <>
          <LocalMapToolbar
            title={mapTitle}
            backAction={backAction}
            mapMode={artwork ? mapMode : undefined}
          />
          <LocalMapText footer={!view.blocked ? status : null}>
            {directory}
          </LocalMapText>
        </>
      )}
      {canvasArtwork ? (
        <InkDetailDrawer
          isOpen={directoryOpen}
          onClose={() => setDirectoryOpen(false)}
          title={directoryLabel}
          size="sm"
          overlayClassName="bg-ink/20"
        >
          {directory}
        </InkDetailDrawer>
      ) : null}
      {node ? (
        <InkDetailDrawer
          isOpen
          onClose={closeLocation}
          title={node.name}
          size="sm"
          overlayClassName="bg-ink/20"
        >
          <AtlasNodePanel
            location={node}
            actions={buildMapLocationActions(
              node,
              player.data?.activeCultivator?.sectId ?? null,
              launch,
            )}
          />
        </InkDetailDrawer>
      ) : selectedPlace ? (
        <AtlasPlaceOccupants
          key={selectedPlace.id}
          place={selectedPlace}
          onClose={closeLocation}
          story={storyAtPlace}
          journey={
            passageStory?.passage && passage
              ? {
                  story: passageStory,
                  passage,
                  atDestination: Boolean(boardingStory),
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function AtlasPlaceOccupants({
  place,
  onClose,
  story,
  journey,
}: {
  place: MapAreaPlace;
  onClose(): void;
  story?: StoryView;
  journey?: { story: StoryView; passage: MapPassage; atDestination: boolean };
}) {
  const navigate = useNavigate();
  const facilities = place.scene?.facilities ?? [];
  const npcs = (place.scene?.npcs ?? []).filter(
    (npc) => !npc.storyOnly || story?.entry?.id === npc.id,
  );
  const passageActor = journey && storyPassageActor(journey.passage);
  const status = (kind: 'npc' | 'facility', id: string) =>
    story?.playHref && story.entry?.kind === kind && story.entry.id === id
      ? { label: '主线' }
      : undefined;
  const actors = [
    ...npcs.map((npc) => ({
      id: npc.id,
      name: npc.name,
      portrait: npc.portrait,
      sigil: '人',
      identity: npc.action,
      responsibility: '',
      status: status('npc', npc.id),
    })),
    ...facilities.map((facility) => ({
      id: facility.id,
      name: facility.name,
      sigil: 'icon:map-landmark',
      identity: facility.purpose,
      responsibility: '',
      appearance: 'facility' as const,
      status: status('facility', facility.id),
    })),
    ...(passageActor ? [passageActor] : []),
  ];
  return (
    <MapLocationDrawer
      title={place.name}
      description={
        journey?.atDestination
          ? place.description
          : (place.scene?.description ?? place.description)
      }
      onClose={onClose}
      actors={actors}
      onActivate={(id) => {
        if (
          story?.entry?.kind !== 'npc' ||
          story.entry.id !== id ||
          !story.playHref ||
          !npcs.some((npc) => npc.id === id && npc.storyOnly)
        )
          return false;
        void navigate(story.playHref);
        return true;
      }}
      renderConversation={(id) => {
        if (journey && id === passageActor?.id)
          return <StoryPassageDetail {...journey} />;
        const npc = npcs.find((item) => item.id === id);
        const facility = facilities.find((item) => item.id === id);
        if (!npc && !facility) return null;
        const action = status(npc ? 'npc' : 'facility', id) && story?.playHref;
        return (
          <section className="space-y-4">
            <h3 className="text-base font-semibold">
              {npc?.name ?? facility?.name}
            </h3>
            {npc ? (
              <blockquote className="border-ink/20 border-l-2 pl-4 text-sm leading-7">
                {npc.reply}
              </blockquote>
            ) : (
              <p className="text-ink-secondary text-sm leading-7">
                {facility?.details}
              </p>
            )}
            {action && story ? (
              <InkButton href={action} variant="primary" className="min-h-11">
                {story.actionLabel ?? '继续'}
              </InkButton>
            ) : null}
          </section>
        );
      }}
    />
  );
}
