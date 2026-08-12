import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type {
  ResolvedSectPresentation,
  SectFacilityState,
  SectMapHotspot,
  SectPermissionState,
  SectSceneKey,
} from '@shared/engine/sect';
import { cn } from '@shared/lib/cn';
import {
  useCallback,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import {
  KeepScale,
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from 'react-zoom-pan-pinch';
import { resolveClosestSectMapHotspot } from './sectMapHitTest';
import {
  resolveSectMapHotspotState,
  type SectMapHotspotState,
  type SectMapMode,
} from './sectMapState';

interface SectMapProps {
  image: string;
  alt: string;
  hotspots: readonly SectMapHotspot[];
  mode?: SectMapMode;
  facilities?: ReadonlyMap<string, SectFacilityState>;
  permissions?: Readonly<Record<string, SectPermissionState>>;
  rooms?: ResolvedSectPresentation['rooms'];
  scenes?: ResolvedSectPresentation['scenes'];
  visitorEntry?: { hotspotId: string; label: string; route: string };
  onNavigate?(route: string): void;
}

interface MapControlButtonProps extends Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  label: string;
  children: ReactNode;
}

const MAP_LABEL_STYLE = {
  WebkitTextStroke: '1.5px rgba(250, 245, 230, 0.96)',
  paintOrder: 'stroke fill',
  textRendering: 'geometricPrecision',
  textShadow: '0 1px 3px rgba(26, 20, 15, 0.35)',
} as const;

const HOTSPOT_SCENE_KEYS: Readonly<Record<string, SectSceneKey>> = {
  hall: 'hall',
  affairs: 'affairs',
  archive: 'archive',
  cliff: 'paths',
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
  spot: SectMapHotspot,
  state: SectMapHotspotState,
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

const AVAILABLE_MARKER_STYLE = {
  background:
    'radial-gradient(circle at 30% 22%, rgba(255,235,229,0.96) 0%, rgba(255,210,198,0.56) 9%, transparent 27%), linear-gradient(145deg, #d86b5c 0%, #a93e34 34%, #76221e 68%, #4a110f 100%)',
  boxShadow:
    'inset 0 1px 1px rgba(255,255,255,0.46), inset 0 -2px 3px rgba(46,8,6,0.48), 0 1px 3px rgba(26,20,15,0.42)',
} as const;

const SELECTED_MARKER_STYLE = {
  ...AVAILABLE_MARKER_STYLE,
  boxShadow:
    'inset 0 1px 1px rgba(255,255,255,0.48), inset 0 -2px 3px rgba(46,8,6,0.42), 0 0 0 2px rgba(250,245,230,0.88), 0 0 0 4px rgba(145,36,28,0.3), 0 2px 5px rgba(26,20,15,0.4)',
} as const;

const LOCKED_MARKER_STYLE = {
  background:
    'radial-gradient(circle at 32% 26%, #8c8177 0%, #5f554d 38%, #332b27 100%)',
  boxShadow:
    'inset 0 1px 1px rgba(255,255,255,0.22), inset 0 -2px 3px rgba(12,9,7,0.42), 0 1px 3px rgba(26,20,15,0.36)',
} as const;

function MapControlButton({ label, children, onClick }: MapControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-ink-secondary hover:text-crimson focus-visible:outline-crimson flex size-10 items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
    >
      {children}
    </button>
  );
}

function ZoomOutIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-[18px]"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.6"
    >
      <path d="M4.5 10h11" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-[18px]"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.6"
    >
      <path d="M4.5 10h11M10 4.5v11" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-[18px]"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    >
      <path d="M5.2 6.3H2.7V3.8" />
      <path d="M3.2 6a7 7 0 1 1-.1 7.8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-2.5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    >
      <rect x="5.2" y="8.4" width="9.6" height="7.2" rx="1.2" />
      <path d="M7.3 8.4V6.5a2.7 2.7 0 0 1 5.4 0v1.9" />
    </svg>
  );
}

function FacilityMarkerGlyph({
  locked,
  selected = false,
}: {
  locked: boolean;
  selected?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      style={
        locked
          ? LOCKED_MARKER_STYLE
          : selected
            ? SELECTED_MARKER_STYLE
            : AVAILABLE_MARKER_STYLE
      }
      className={cn(
        'relative flex size-[18px] shrink-0 transform-gpu items-center justify-center rounded-full border transition duration-150',
        locked
          ? 'border-paper/30 text-paper/75 group-hover:border-paper/45 group-hover:scale-105'
          : selected
            ? 'border-paper/90 text-paper'
            : 'border-paper/65 text-paper/95 group-hover:border-paper/90 group-hover:scale-105',
      )}
    >
      {locked ? (
        <span className="relative z-10 flex items-center justify-center">
          <LockIcon />
        </span>
      ) : null}
    </span>
  );
}

export function SectMap({
  image,
  alt,
  hotspots,
  mode = 'member',
  facilities = new Map(),
  permissions,
  rooms,
  scenes,
  visitorEntry,
  onNavigate,
}: SectMapProps) {
  const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [gestureHintVisible, setGestureHintVisible] = useState(true);
  const selectedSpot =
    hotspots.find((hotspot) => hotspot.id === selectedId) ?? null;
  const selectedState = selectedSpot
    ? resolveSectMapHotspotState(selectedSpot, mode, facilities, permissions)
    : null;

  const dismissGestureHint = useCallback(() => {
    setGestureHintVisible(false);
  }, []);

  const closeDirectory = useCallback(() => {
    setDirectoryOpen(false);
  }, []);

  const selectFromList = (spot: SectMapHotspot) => {
    const state = resolveSectMapHotspotState(
      spot,
      mode,
      facilities,
      permissions,
    );
    if (!state.selectable) return;
    setSelectedId(spot.id);
    setDirectoryOpen(false);
    dismissGestureHint();
    window.requestAnimationFrame(() => {
      transformRef.current?.zoomToElement(
        `sect-map-hotspot-${spot.id}`,
        1.35,
        320,
      );
    });
  };

  const handleHotspotClickCapture = (
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    if (
      event.detail === 0 ||
      !(event.target instanceof Element) ||
      !event.target.closest('.sect-map-marker')
    )
      return;

    const canvasRect = event.currentTarget.getBoundingClientRect();
    const closest = resolveClosestSectMapHotspot(
      hotspots,
      {
        x: event.clientX - canvasRect.left,
        y: event.clientY - canvasRect.top,
      },
      { width: canvasRect.width, height: canvasRect.height },
    );
    if (!closest) return;
    const state = resolveSectMapHotspotState(
      closest,
      mode,
      facilities,
      permissions,
    );
    if (!state.selectable) return;

    event.stopPropagation();
    setSelectedId(closest.id);
    dismissGestureHint();
  };

  return (
    <div>
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={1}
        maxScale={3}
        centerOnInit
        limitToBounds
        wheel={{ step: 0.16 }}
        panning={{
          velocityDisabled: true,
          excluded: ['sect-map-marker'],
        }}
        onPanningStart={dismissGestureHint}
        onZoomStart={dismissGestureHint}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className="relative">
            <div className="border-ink/15 relative overflow-hidden border bg-[#e9e1cf] shadow-inner">
              <TransformComponent
                wrapperClass="!w-full !h-[min(56svh,427px)] !min-h-[320px] md:!h-auto md:!min-h-0 md:aspect-[1672/941] cursor-grab active:cursor-grabbing"
                contentClass="!w-max !h-max md:!w-full md:!h-full"
              >
                <div
                  className="relative aspect-[1672/941] w-[760px] md:w-full"
                  onClickCapture={handleHotspotClickCapture}
                >
                  <img
                    src={image}
                    alt={alt}
                    className="pointer-events-none block h-full w-full select-none"
                    draggable={false}
                  />
                  {hotspots.map((spot) => {
                    const state = resolveSectMapHotspotState(
                      spot,
                      mode,
                      facilities,
                      permissions,
                    );
                    const selected = spot.id === selectedId;
                    return (
                      <div
                        key={spot.id}
                        style={{ left: spot.left, top: spot.top }}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                      >
                        <KeepScale>
                          <button
                            id={`sect-map-hotspot-${spot.id}`}
                            type="button"
                            disabled={!state.selectable}
                            aria-pressed={selected}
                            aria-label={`${spot.label}${state.locked ? '，未开放' : ''}`}
                            onClick={() => {
                              if (state.selectable) {
                                setSelectedId(spot.id);
                                dismissGestureHint();
                              }
                            }}
                            className={cn(
                              'sect-map-marker group focus-visible:outline-crimson relative flex size-7 transform-gpu items-center justify-center rounded-full transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2',
                              selected ? 'z-20 scale-[1.08]' : '',
                              state.selectable
                                ? 'cursor-pointer'
                                : 'cursor-not-allowed opacity-55',
                            )}
                          >
                            <FacilityMarkerGlyph
                              locked={state.locked}
                              selected={selected}
                            />
                            <span
                              style={MAP_LABEL_STYLE}
                              className={cn(
                                'pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 translate-y-[13px] px-1 py-0.5 text-[11px] leading-4 font-semibold tracking-[0.08em] whitespace-nowrap',
                                state.locked
                                  ? 'text-ink-secondary'
                                  : 'text-crimson',
                              )}
                            >
                              {spot.label}
                            </span>
                          </button>
                        </KeepScale>
                      </div>
                    );
                  })}
                </div>
              </TransformComponent>
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2.5 md:p-3">
              <button
                type="button"
                onClick={() => setDirectoryOpen(true)}
                className="border-ink/15 bg-paper/85 text-ink hover:text-crimson focus-visible:outline-crimson pointer-events-auto flex min-h-10 items-center border px-3 text-sm shadow-sm backdrop-blur-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 md:hidden"
              >
                设施名录
              </button>
              <p className="bg-paper/80 text-ink-secondary hidden max-w-[calc(100%-9rem)] px-2.5 py-2 text-sm shadow-sm backdrop-blur-sm md:block">
                {mode === 'visitor'
                  ? '拖动或缩放舆图，可在山门与护山阵法外驻足查看。'
                  : '拖动或缩放舆图，点选设施查看职司。'}
              </p>
              <div className="border-ink/15 bg-paper/85 pointer-events-auto ml-auto flex shrink-0 border shadow-sm backdrop-blur-sm">
                <MapControlButton
                  label="缩小宗门舆图"
                  onClick={() => zoomOut()}
                >
                  <ZoomOutIcon />
                </MapControlButton>
                <span className="bg-ink/10 my-2 w-px" aria-hidden="true" />
                <MapControlButton label="放大宗门舆图" onClick={() => zoomIn()}>
                  <ZoomInIcon />
                </MapControlButton>
                <span className="bg-ink/10 my-2 w-px" aria-hidden="true" />
                <MapControlButton
                  label="复位宗门舆图"
                  onClick={() => resetTransform()}
                >
                  <ResetIcon />
                </MapControlButton>
              </div>
            </div>

            <p
              className={cn(
                'bg-paper/85 text-ink-secondary pointer-events-none absolute bottom-2.5 left-2.5 z-10 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur-sm transition-opacity duration-200 md:hidden',
                gestureHintVisible && !selectedSpot
                  ? 'opacity-100'
                  : 'opacity-0',
              )}
            >
              单指拖动 · 双指缩放
            </p>
          </div>
        )}
      </TransformWrapper>

      <InkDetailDrawer
        isOpen={selectedSpot !== null && selectedState !== null}
        onClose={() => setSelectedId(null)}
        title={selectedSpot?.label ?? '设施详情'}
        description={
          selectedSpot && selectedState
            ? resolveHotspotDescription(
                selectedSpot,
                selectedState,
                rooms,
                scenes,
              )
            : undefined
        }
        size="sm"
        footer={
          selectedSpot && selectedState ? (
            <>
              {mode === 'member' &&
              !selectedState.locked &&
              selectedSpot.route &&
              onNavigate ? (
                <InkButton
                  variant="primary"
                  className="w-full justify-center"
                  onClick={() => onNavigate(selectedSpot.route!)}
                >
                  进入{selectedSpot.label}
                </InkButton>
              ) : null}
              {mode === 'visitor' &&
              visitorEntry?.hotspotId === selectedSpot.id &&
              onNavigate ? (
                <InkButton
                  variant="primary"
                  className="w-full justify-center"
                  onClick={() => onNavigate(visitorEntry.route)}
                >
                  {visitorEntry.label}
                </InkButton>
              ) : null}
            </>
          ) : undefined
        }
      >
        {selectedState?.locked ? (
          <p className="text-crimson text-sm">该设施当前尚未开放。</p>
        ) : (
          <p className="text-ink-secondary text-sm leading-7">
            选择下方操作继续前往该设施。
          </p>
        )}
      </InkDetailDrawer>

      <InkDetailDrawer
        isOpen={directoryOpen}
        onClose={closeDirectory}
        title="设施名录"
      >
        <div className="divide-ink/10 divide-y divide-dashed">
          {hotspots.map((spot) => {
            const state = resolveSectMapHotspotState(
              spot,
              mode,
              facilities,
              permissions,
            );
            return (
              <button
                key={spot.id}
                type="button"
                disabled={!state.selectable}
                onClick={() => selectFromList(spot)}
                className={cn(
                  'focus-visible:outline-crimson group flex w-full items-center gap-3 px-1 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                  state.selectable
                    ? 'hover:bg-ink/5'
                    : 'cursor-not-allowed opacity-55',
                )}
              >
                <FacilityMarkerGlyph locked={state.locked} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <strong className="text-sm">{spot.label}</strong>
                    {state.locked ? (
                      <span className="text-crimson/75 text-xs">未开放</span>
                    ) : null}
                  </span>
                  <span className="text-ink-secondary mt-0.5 block truncate text-xs">
                    {state.reason ?? spot.note}
                  </span>
                </span>
                {state.selectable ? (
                  <span
                    aria-hidden="true"
                    className="text-ink-secondary pr-1 text-sm"
                  >
                    →
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </InkDetailDrawer>
    </div>
  );
}
