import { CharacterAttributesPanel } from '@app/components/feature/cultivator/CharacterAttributesPanel';
import { lazy, Suspense, useRef, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';
import { GameSceneLoading } from './GameSceneFrame';

const CultivatorBiography = lazy(() =>
  import('@app/components/feature/cultivator/CultivatorBiography').then(
    (module) => ({ default: module.CultivatorBiography }),
  ),
);

const ManualRoom = lazy(() =>
  import('@app/components/feature/manuals/ManualRoom').then((module) => ({
    default: module.ManualRoom,
  })),
);
const BodyTrainingPanel = lazy(() =>
  import('@app/components/feature/cultivator/BodyCultivationPanels').then(
    (module) => ({ default: module.BodyCultivationDetailPanel }),
  ),
);
const tabs = [
  { value: 'attributes', label: '人物属性' },
  { value: 'innate', label: '先天设定' },
  { value: 'manuals', label: '所修功法' },
  { value: 'body', label: '肉身修炼' },
] as const;

const desktopQuery = '(min-width: 768px)';
const subscribeToViewport = (notify: () => void) => {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const isDesktopViewport = () => window.matchMedia(desktopQuery).matches;

export function CultivatorOverviewPanel() {
  const isDesktop = useSyncExternalStore(
    subscribeToViewport,
    isDesktopViewport,
    () => false,
  );
  const [params, setParams] = useSearchParams();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = tabs.findIndex((tab) => tab.value === params.get('tab'));
  const activeIndex = selected < 0 ? 0 : selected;
  const active = tabs[activeIndex];
  const select = (index: number) =>
    setParams(index === 0 ? {} : { tab: tabs[index].value });
  return (
    <div className="grid items-start gap-4 md:grid-cols-[6.5rem_minmax(0,1fr)] md:gap-5">
      <div
        role="tablist"
        aria-label="角色面板"
        aria-orientation={isDesktop ? 'vertical' : 'horizontal'}
        className="grid grid-cols-4 gap-1 md:sticky md:top-3 md:flex md:flex-col md:gap-2"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`character-tab-${tab.value}`}
            aria-controls={`character-panel-${tab.value}`}
            aria-selected={index === activeIndex}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => select(index)}
            onKeyDown={(event) => {
              const next =
                event.key === (isDesktop ? 'ArrowDown' : 'ArrowRight')
                  ? (index + 1) % tabs.length
                  : event.key === (isDesktop ? 'ArrowUp' : 'ArrowLeft')
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : null;
              if (next === null) return;
              event.preventDefault();
              select(next);
              buttons.current[next]?.focus();
            }}
            className={`min-h-11 rounded-sm px-1 py-2 text-sm whitespace-nowrap md:min-h-12 md:px-2 ${index === activeIndex ? 'bg-ink/5 text-crimson font-semibold' : 'text-ink-secondary hover:bg-ink/5 hover:text-ink'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section
        key={active.value}
        role="tabpanel"
        id={`character-panel-${active.value}`}
        aria-labelledby={`character-tab-${active.value}`}
        tabIndex={0}
        className="min-w-0"
      >
        <Suspense fallback={<GameSceneLoading message="正在翻阅角色资料……" />}>
          {active.value === 'innate' ? (
            <CultivatorBiography />
          ) : active.value === 'manuals' ? (
            <ManualRoom />
          ) : active.value === 'body' ? (
            <BodyTrainingPanel />
          ) : (
            <CharacterAttributesPanel />
          )}
        </Suspense>
      </section>
    </div>
  );
}
