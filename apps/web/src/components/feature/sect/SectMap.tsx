import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { cn } from '@app/lib/cn';
import { useGameSettings } from '@app/lib/game-setting';
import type {
  ResolvedSectPresentation,
  SectFacilityState,
  SectMapHotspot,
  SectPermissionState,
  SectSceneKey,
} from '@daoyou/game-rules/sect-organization';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SectMapCanvas } from './SectMapCanvas';
import {
  SectMapText,
  SectMapToolbar,
  type SectMapBackAction,
} from './SectMapChrome';
import {
  resolveSectMapHotspotState,
  type SectMapHotspotState,
  type SectMapMode,
} from './sectMapState';
import type { SectMapController } from './SectPhaserRuntime';

interface SectMapProps {
  title: string;
  backAction: SectMapBackAction;
  image?: string;
  alt: string;
  aspectRatio?: number;
  hotspots: readonly SectMapHotspot[];
  mode?: SectMapMode;
  facilities?: ReadonlyMap<string, SectFacilityState>;
  permissions?: Readonly<Record<string, SectPermissionState>>;
  rooms?: ResolvedSectPresentation['rooms'];
  scenes?: ResolvedSectPresentation['scenes'];
  visitorEntry?: { hotspotId: string; label: string; route: string };
  initialSelectedId?: string;
  renderLocation?(location: {
    spot: SectMapHotspot;
    description?: string;
    footer?: ReactNode;
    onClose(): void;
  }): ReactNode;
  onNavigate?(route: string, hotspotId: string): void;
}

type Location = { spot: SectMapHotspot; state: SectMapHotspotState };

const EMPTY_FACILITIES = new Map<string, SectFacilityState>();
const HOTSPOT_SCENE_KEYS: Readonly<Record<string, SectSceneKey>> = {
  hall: 'hall',
  affairs: 'affairs',
  archive: 'archive',
  cliff: 'paths',
  paths: 'paths',
  arena: 'arena',
  treasury: 'treasury',
  industries: 'industries',
  cultivation: 'cultivation',
  alchemy: 'alchemy',
  refinery: 'refinery',
  vein: 'spiritVein',
  garden: 'herbGarden',
  gate: 'gate',
  cave: 'cave',
};

function resolveHotspotDescription(
  { spot, state }: Location,
  rooms?: ResolvedSectPresentation['rooms'],
  scenes?: ResolvedSectPresentation['scenes'],
) {
  if (state.reason) return state.reason;
  const sceneKey = HOTSPOT_SCENE_KEYS[spot.id];
  return (
    (sceneKey ? rooms?.[sceneKey]?.description : undefined) ??
    (sceneKey ? scenes?.[sceneKey].description : undefined) ??
    spot.note
  );
}

function SectMapDirectory({
  locations,
  selectedId,
  onSelect,
}: {
  locations: readonly Location[];
  selectedId: string | null;
  onSelect(id: string, button: HTMLButtonElement): void;
}) {
  return (
    <ul aria-label="设施名录" className="divide-ink/10 divide-y divide-dashed">
      {locations.map(({ spot, state }) => (
        <li key={spot.id}>
          <button
            type="button"
            disabled={!state.selectable}
            aria-pressed={spot.id === selectedId}
            onClick={(event) => onSelect(spot.id, event.currentTarget)}
            className="focus-visible:outline-crimson enabled:hover:bg-ink/5 flex min-h-11 w-full items-center gap-3 px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-2 shrink-0 rounded-full',
                state.locked ? 'bg-ink-secondary' : 'bg-crimson',
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <strong className="text-sm">{spot.label}</strong>
                {state.locked ? (
                  <span className="text-ink-secondary text-xs">未开放</span>
                ) : null}
              </span>
              <span className="text-ink-secondary mt-0.5 block text-xs leading-5">
                {state.reason ?? spot.note}
              </span>
            </span>
            {state.selectable ? (
              <span aria-hidden="true" className="text-ink-secondary pr-1">
                →
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SectMap({
  title,
  backAction,
  image,
  alt,
  aspectRatio = 1672 / 941,
  hotspots,
  mode = 'member',
  facilities = EMPTY_FACILITIES,
  permissions,
  rooms,
  scenes,
  visitorEntry,
  initialSelectedId,
  renderLocation,
  onNavigate,
}: SectMapProps) {
  const { mapMode, imageOpacity } = useGameSettings();
  const controller = useRef<SectMapController | null>(null);
  const directoryTrigger = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const [requestedId, setRequestedId] = useState(initialSelectedId ?? null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const locations = useMemo(
    () =>
      hotspots.map((spot) => ({
        spot,
        state: resolveSectMapHotspotState(spot, mode, facilities, permissions),
      })),
    [facilities, hotspots, mode, permissions],
  );
  const markers = useMemo(
    () =>
      locations
        .map(({ spot, state }) => ({
          id: spot.id,
          label: spot.label,
          x: Number.parseFloat(spot.left) / 100,
          y: Number.parseFloat(spot.top) / 100,
          locked: state.locked,
          selectable: state.selectable,
        }))
        .filter(({ x, y }) => x >= 0 && x <= 1 && y >= 0 && y <= 1),
    [locations],
  );
  const selected = locations.find(
    ({ spot, state }) => spot.id === requestedId && state.selectable,
  );
  const selectedId = selected?.spot.id ?? null;
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

  const closeLocation = () => setRequestedId(null);
  const selectLocation = (id: string) => {
    if (
      !locations.some(({ spot, state }) => spot.id === id && state.selectable)
    )
      return;
    setRequestedId(id);
    controller.current?.focus(id);
  };
  const directory = (
    <SectMapDirectory
      locations={locations}
      selectedId={selectedId}
      onSelect={(id, button) => {
        returnFocus.current = directoryOpen ? directoryTrigger.current : button;
        selectLocation(id);
        setDirectoryOpen(false);
      }}
    />
  );
  const locationAction = selected
    ? mode === 'member' && !selected.state.locked && selected.spot.route
      ? { route: selected.spot.route, label: `进入${selected.spot.label}` }
      : mode === 'visitor' && visitorEntry?.hotspotId === selected.spot.id
        ? visitorEntry
        : undefined
    : undefined;
  const footer =
    selected && locationAction && onNavigate ? (
      <InkButton
        variant="primary"
        className="w-full justify-center"
        onClick={() => onNavigate(locationAction.route, selected.spot.id)}
      >
        {locationAction.label}
      </InkButton>
    ) : undefined;
  const description = selected
    ? resolveHotspotDescription(selected, rooms, scenes)
    : undefined;
  const customLocation =
    selected && !selected.state.locked
      ? renderLocation?.({
          spot: selected.spot,
          description,
          footer,
          onClose: closeLocation,
        })
      : undefined;
  const canvasImage = mapMode === 'atlas' ? image : undefined;
  const view = useMemo(
    () => ({
      markers,
      selectedId,
      opacity: imageOpacity,
      blocked: directoryOpen || selectedId !== null,
    }),
    [directoryOpen, imageOpacity, markers, selectedId],
  );

  return (
    <div className="bg-paper absolute inset-0 overflow-hidden">
      {canvasImage ? (
        <SectMapCanvas
          key={canvasImage}
          title={title}
          backAction={backAction}
          image={canvasImage}
          alt={alt}
          aspectRatio={aspectRatio}
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
          <SectMapToolbar
            title={title}
            backAction={backAction}
            mapMode={image ? 'text' : undefined}
          />
          <SectMapText>{directory}</SectMapText>
        </>
      )}
      {selected
        ? (customLocation ?? (
            <InkDetailDrawer
              isOpen
              onClose={closeLocation}
              title={selected.spot.label}
              description={description}
              size="sm"
              footer={footer}
            >
              {selected.state.locked ? (
                <p className="text-crimson text-sm">该设施当前尚未开放。</p>
              ) : footer ? (
                <p className="text-ink-secondary text-sm leading-7">
                  选择下方操作继续前往该设施。
                </p>
              ) : null}
            </InkDetailDrawer>
          ))
        : null}
      {canvasImage ? (
        <InkDetailDrawer
          isOpen={directoryOpen}
          onClose={() => setDirectoryOpen(false)}
          title="设施名录"
        >
          {directory}
        </InkDetailDrawer>
      ) : null}
    </div>
  );
}
