import { CharacterAttributesPanel } from '@app/components/feature/cultivator/CharacterAttributesPanel';
import { lazy, Suspense, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { GameSceneLoading } from './GameSceneFrame';

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
  { value: 'manuals', label: '所修功法' },
  { value: 'body', label: '肉身修炼' },
] as const;

export function CultivatorOverviewPanel() {
  const [params, setParams] = useSearchParams();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = tabs.findIndex((tab) => tab.value === params.get('tab'));
  const activeIndex = selected < 0 ? 0 : selected;
  const active = tabs[activeIndex];
  const select = (index: number) =>
    setParams(index === 0 ? {} : { tab: tabs[index].value });
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-5">
      <div
        role="tablist"
        aria-label="角色面板"
        aria-orientation="vertical"
        className="border-ink/15 sticky top-3 flex flex-col gap-2 border-r pr-2"
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
                event.key === 'ArrowDown'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowUp'
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
            className={`min-h-24 rounded-sm px-1 py-3 text-sm tracking-widest [writing-mode:vertical-rl] sm:min-h-12 sm:px-2 sm:tracking-normal sm:[writing-mode:horizontal-tb] ${index === activeIndex ? 'bg-ink/5 text-crimson font-semibold' : 'text-ink-secondary hover:bg-ink/5 hover:text-ink'}`}
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
          {active.value === 'manuals' ? (
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
