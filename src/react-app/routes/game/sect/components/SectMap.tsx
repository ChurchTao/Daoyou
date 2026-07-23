import { InkButton } from '@app/components/ui';
import type {
  SectFacilityState,
  SectMapHotspot,
  SectPermissionState,
} from '@shared/engine/sect';
import { cn } from '@shared/lib/cn';
import {
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import {
  KeepScale,
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from 'react-zoom-pan-pinch';

interface SectMapProps {
  image: string;
  alt: string;
  hotspots: readonly SectMapHotspot[];
  facilities: ReadonlyMap<string, SectFacilityState>;
  permissions?: Readonly<Record<string, SectPermissionState>>;
  onNavigate(route: string): void;
}

interface MapControlButtonProps extends Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  label: string;
  children: ReactNode;
}

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
      className="size-3.5"
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

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
    >
      <path d="m5.5 5.5 9 9m0-9-9 9" />
    </svg>
  );
}

function getHotspotState(
  spot: SectMapHotspot,
  facilities: ReadonlyMap<string, SectFacilityState>,
  permissions?: Readonly<Record<string, SectPermissionState>>,
) {
  const facility = spot.facility ? facilities.get(spot.facility) : undefined;
  const access = spot.permission ? permissions?.[spot.permission] : undefined;
  const locked = spot.locked || !spot.route || access?.granted === false;

  return {
    facility,
    locked,
    reason: access?.granted === false ? access.reason : undefined,
  };
}

export function SectMap({
  image,
  alt,
  hotspots,
  facilities,
  permissions,
  onNavigate,
}: SectMapProps) {
  const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  const selectedSpot =
    hotspots.find((hotspot) => hotspot.id === selectedId) ?? null;
  const selectedState = selectedSpot
    ? getHotspotState(selectedSpot, facilities, permissions)
    : null;

  const selectFromList = (spot: SectMapHotspot) => {
    setSelectedId(spot.id);
    setMobileView('map');
    window.requestAnimationFrame(() => {
      transformRef.current?.zoomToElement(
        `sect-map-hotspot-${spot.id}`,
        1.35,
        320,
      );
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-ink-secondary hidden text-sm md:block">
          拖动或缩放舆图，点选设施查看职司。
        </p>
        <div
          className="border-ink/15 flex border-b border-dashed md:hidden"
          aria-label="宗门舆图浏览方式"
        >
          <button
            type="button"
            aria-pressed={mobileView === 'map'}
            onClick={() => setMobileView('map')}
            className={cn(
              'px-2.5 py-2 text-sm transition-colors',
              mobileView === 'map'
                ? 'text-crimson font-semibold'
                : 'text-ink-secondary',
            )}
          >
            舆图
          </button>
          <button
            type="button"
            aria-pressed={mobileView === 'list'}
            onClick={() => setMobileView('list')}
            className={cn(
              'px-2.5 py-2 text-sm transition-colors',
              mobileView === 'list'
                ? 'text-crimson font-semibold'
                : 'text-ink-secondary',
            )}
          >
            设施名录
          </button>
        </div>
      </div>

      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.72}
        maxScale={3}
        centerOnInit
        centerZoomedOut
        limitToBounds
        wheel={{ step: 0.16 }}
        panning={{
          velocityDisabled: true,
          excluded: ['sect-map-marker'],
        }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div
              className={cn(
                'items-center justify-between gap-3',
                mobileView === 'map' ? 'flex' : 'hidden md:flex',
              )}
            >
              <p className="text-ink-secondary text-xs md:hidden">
                单指拖动，双指缩放
              </p>
              <div className="border-ink/15 bg-paper/70 ml-auto flex border shadow-sm backdrop-blur-sm">
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

            <div
              className={cn(
                'relative',
                mobileView === 'map' ? 'block' : 'hidden md:block',
              )}
            >
              <div className="border-ink/15 relative overflow-hidden border bg-[#e9e1cf] shadow-inner">
                <TransformComponent
                  wrapperClass="!w-full !h-[min(56svh,427px)] !min-h-[320px] md:!h-auto md:!min-h-0 md:aspect-[1672/941] cursor-grab active:cursor-grabbing"
                  contentClass="!w-max !h-max md:!w-full md:!h-full"
                >
                  <div className="relative aspect-[1672/941] w-[760px] md:w-full">
                    <img
                      src={image}
                      alt={alt}
                      className="pointer-events-none block h-full w-full select-none"
                      draggable={false}
                    />
                    {hotspots.map((spot) => {
                      const state = getHotspotState(
                        spot,
                        facilities,
                        permissions,
                      );
                      const selected = spot.id === selectedId;
                      const level = state.facility?.level;

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
                              aria-pressed={selected}
                              aria-label={`${spot.label}${level ? `，${level}级` : ''}${state.locked ? '，未开放' : ''}`}
                              onClick={() => setSelectedId(spot.id)}
                              className={cn(
                                'sect-map-marker group focus-visible:outline-crimson relative flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2',
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'absolute size-7 rotate-45 rounded-[3px] border shadow-[0_2px_8px_rgba(26,20,15,0.18)] backdrop-blur-[1px] transition',
                                  state.locked
                                    ? 'border-paper/30 bg-ink/65 text-paper/80'
                                    : selected
                                      ? 'border-crimson bg-paper text-crimson shadow-[0_3px_12px_rgba(118,32,24,0.25)]'
                                      : 'border-ink/35 bg-paper/75 text-ink-secondary hover:border-crimson/60 hover:bg-paper',
                                )}
                              />
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'relative z-10 flex items-center justify-center',
                                  state.locked
                                    ? 'text-paper/75'
                                    : 'text-crimson/80',
                                )}
                              >
                                {state.locked ? (
                                  <LockIcon />
                                ) : (
                                  <span className="block size-1.5 rounded-full bg-current" />
                                )}
                              </span>
                              <span
                                className={cn(
                                  'bg-paper/92 text-ink pointer-events-none absolute top-10 left-1/2 z-20 -translate-x-1/2 border-b border-dashed px-2 py-1 text-xs leading-5 whitespace-nowrap shadow-sm transition-opacity',
                                  selected
                                    ? 'border-crimson/35 opacity-100'
                                    : 'border-ink/20 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
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

              {selectedSpot && selectedState ? (
                <section
                  aria-live="polite"
                  className="border-crimson/45 bg-paper/95 absolute right-3 bottom-3 left-3 z-20 border-l-2 px-3 py-2.5 shadow-sm backdrop-blur-sm md:right-auto md:w-[min(22rem,calc(100%-1.5rem))]"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <strong className="text-sm">
                          {selectedSpot.label}
                        </strong>
                        {selectedState.facility && !selectedSpot.locked ? (
                          <span className="text-ink-secondary text-xs">
                            {selectedState.facility.level}级
                          </span>
                        ) : null}
                        {selectedState.locked ? (
                          <span className="text-crimson/75 text-xs">
                            未开放
                          </span>
                        ) : null}
                      </div>
                      <p className="text-ink-secondary mt-1 text-xs leading-5">
                        {selectedState.reason ?? selectedSpot.note}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      aria-label="关闭设施详情"
                      className="text-ink-secondary hover:text-ink focus-visible:outline-crimson -mr-1 flex size-8 shrink-0 items-center justify-center focus-visible:outline-2"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                  {!selectedState.locked && selectedSpot.route ? (
                    <div className="mt-1.5">
                      <InkButton
                        variant="primary"
                        onClick={() => onNavigate(selectedSpot.route!)}
                      >
                        进入{selectedSpot.label}
                      </InkButton>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>

            <div
              className={cn(
                'border-ink/15 divide-ink/10 divide-y divide-dashed border-y md:hidden',
                mobileView === 'list' ? 'block' : 'hidden',
              )}
            >
              {hotspots.map((spot) => {
                const state = getHotspotState(spot, facilities, permissions);
                return (
                  <button
                    key={spot.id}
                    type="button"
                    onClick={() => selectFromList(spot)}
                    className="hover:bg-ink/5 focus-visible:outline-crimson flex w-full items-center gap-3 px-1 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-7 shrink-0 rotate-45 items-center justify-center rounded-[3px] border',
                        state.locked
                          ? 'border-ink/25 bg-ink/55 text-paper/80'
                          : 'border-crimson/25 bg-paper text-crimson/75',
                      )}
                    >
                      <span className="-rotate-45">
                        {state.locked ? (
                          <LockIcon />
                        ) : (
                          <span className="block size-1.5 rounded-full bg-current" />
                        )}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <strong className="text-sm">{spot.label}</strong>
                        {state.facility && !spot.locked ? (
                          <span className="text-ink-secondary text-xs">
                            {state.facility.level}级
                          </span>
                        ) : null}
                        {state.locked ? (
                          <span className="text-crimson/75 text-xs">
                            未开放
                          </span>
                        ) : null}
                      </span>
                      <span className="text-ink-secondary mt-0.5 block truncate text-xs">
                        {state.reason ?? spot.note}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-ink-secondary pr-1 text-sm"
                    >
                      →
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
