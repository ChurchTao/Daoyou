import { achievementCategoryIcon } from '@app/components/feature/achievements/achievementIcons';
import { useSocialQuery } from '@app/components/feature/friends/socialApi';
import { GameLoadingState, GameSceneFrame } from '@app/components/game-shell';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { useAuth } from '@app/lib/auth/useAuth';
import { cn } from '@app/lib/cn';
import { usePlayerSession } from '@app/lib/resources/player';
import type { AchievementView } from '@daoyou/contracts/achievements';
import { ACHIEVEMENT_CATEGORY_IDS } from '@daoyou/game-domain/achievements';
import { useSearchParams } from 'react-router';
import { groupAchievementSeries } from './achievementPresentation';
import { AchievementEntry } from './components/AchievementEntry';

export default function AchievementsPage() {
  const { user } = useAuth();
  const actorId = usePlayerSession().data?.activeCultivator?.id;
  return actorId ? (
    <AchievementsWorkspace key={(user?.id ?? '') + ':' + actorId} />
  ) : (
    <GameSceneFrame>
      <GameLoadingState message="正在读取当前角色……" variant="inline" />
    </GameSceneFrame>
  );
}

function AchievementsWorkspace() {
  const query = useSocialQuery<{ achievements: AchievementView[] }>(
    '/api/achievements',
  );
  const [params, setParams] = useSearchParams();
  const achievements = query.data?.achievements ?? [];
  const series = groupAchievementSeries(achievements);
  const categories = ACHIEVEMENT_CATEGORY_IDS.flatMap((id) => {
    const items = achievements.filter((item) => item.category === id);
    return items.length
      ? [
          {
            id,
            label: items[0].categoryLabel,
            total: items.length,
            unlocked: items.filter((item) => item.unlocked).length,
          },
        ]
      : [];
  });
  const selectedId = params.get('achievement');
  const selected = achievements.find((item) => item.id === selectedId);
  const category =
    categories.find(
      (item) => item.id === (selected?.category ?? params.get('category')),
    ) ?? categories[0];
  const visible = series.filter((item) => item.category === category?.id);
  const unlocked = achievements.filter((item) => item.unlocked).length;

  function selectCategory(id: string) {
    setParams({ category: id });
  }

  function toggleAchievement(item: AchievementView) {
    const next = new URLSearchParams({ category: item.category });
    if (selectedId !== item.id) next.set('achievement', item.id);
    setParams(next, { replace: selectedId === item.id });
  }

  return (
    <GameSceneFrame>
      {query.loading && !query.data ? (
        <GameLoadingState message="正在翻阅成就簿……" variant="inline" />
      ) : null}
      {query.error ? (
        <div
          role="alert"
          className="border-crimson/25 space-y-2 border-l-2 pl-4"
        >
          <p className="text-crimson text-sm leading-7">{query.error}</p>
          <InkButton
            onClick={() => void query.reload()}
            pending={query.loading}
            className="min-h-11"
          >
            重新读取成就
          </InkButton>
        </div>
      ) : null}
      {query.data ? (
        <>
          <section
            aria-label="成就总览"
            className="border-ink/15 flex items-center gap-4 border-b py-4 sm:gap-5"
          >
            <GameIcon value="🏆" className="text-4xl" />
            <div className="shrink-0">
              <p className="text-ink-secondary text-xs tracking-widest">
                已获成就
              </p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-teal font-mono text-3xl font-semibold tracking-tight">
                  {unlocked}
                </span>
                <span className="text-ink-secondary text-sm">
                  / <span className="font-mono">{achievements.length}</span>
                </span>
              </p>
            </div>
            <div
              role="progressbar"
              aria-label="成就收集进度"
              aria-valuemin={0}
              aria-valuemax={achievements.length || 1}
              aria-valuenow={unlocked}
              className="bg-ink/8 ml-auto h-1.5 w-24 sm:w-44"
            >
              <div
                className="bg-teal/65 h-full transition-[width]"
                style={{
                  width: achievements.length
                    ? (unlocked / achievements.length) * 100 + '%'
                    : '0%',
                }}
              />
            </div>
          </section>
          {categories.length ? (
            <div className="grid min-w-0 gap-6 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8">
              <nav
                aria-label="成就分类"
                className="min-w-0 md:sticky md:top-4 md:self-start"
              >
                <div className="grid grid-cols-4 gap-1 md:grid-cols-1 md:gap-1.5">
                  {categories.map((item) => {
                    const active = item.id === category.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        aria-controls="achievement-catalogue"
                        onClick={() => selectCategory(item.id)}
                        className={cn(
                          'focus-visible:outline-crimson flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 border-l-2 px-1 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 md:min-h-14 md:flex-row md:justify-start md:gap-3 md:px-3',
                          active
                            ? 'border-crimson bg-crimson/5 text-crimson'
                            : 'text-ink-secondary hover:bg-ink/4 hover:text-ink border-transparent',
                        )}
                      >
                        <span className="flex items-center gap-1.5 md:gap-2">
                          <GameIcon value={achievementCategoryIcon(item.id)} />
                          <span
                            className={cn('text-sm', active && 'font-semibold')}
                          >
                            {item.label}
                          </span>
                        </span>
                        <span className="font-mono text-xs md:ml-auto">
                          <span className="sr-only">已获</span>
                          {item.unlocked}/{item.total}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </nav>
              <div id="achievement-catalogue" className="min-w-0">
                <div className="mb-5 flex items-baseline gap-3">
                  <h2 className="text-xl font-semibold">{category.label}</h2>
                  <p className="text-ink-secondary text-xs">
                    <span className="font-mono">{visible.length}</span> 个系列
                  </p>
                </div>
                {selectedId && !selected ? (
                  <div
                    role="status"
                    className="text-ink-secondary mb-4 text-sm"
                  >
                    <p>这项成就暂未收录。</p>
                    <InkButton
                      variant="secondary"
                      className="min-h-11"
                      onClick={() => selectCategory(category.id)}
                    >
                      收起详情
                    </InkButton>
                  </div>
                ) : null}
                <div className="space-y-7">
                  {visible.map((group) => {
                    const attained = group.items.filter(
                      (item) => item.unlocked,
                    ).length;
                    const next = group.items.find(
                      (item) => !item.unlocked && !item.blockedReason,
                    );
                    return (
                      <section
                        key={group.id}
                        aria-labelledby={'series-' + group.id}
                      >
                        <div className="border-ink/20 flex items-center justify-between gap-3 border-b pb-2">
                          <h3
                            id={'series-' + group.id}
                            className="border-ink/40 border-l-2 pl-2.5 text-base font-semibold"
                          >
                            {group.name}
                          </h3>
                          <p className="text-ink-secondary shrink-0 text-xs">
                            已获{' '}
                            <span className="font-mono">
                              {attained}/{group.items.length}
                            </span>
                          </p>
                        </div>
                        <ul className="divide-ink/8 divide-y">
                          {group.items.map((item) => (
                            <AchievementEntry
                              key={item.id}
                              achievement={item}
                              next={item.id === next?.id}
                              expanded={selectedId === item.id}
                              onToggle={() => toggleAchievement(item)}
                              onRefresh={() => void query.reload()}
                              loading={query.loading}
                            />
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-ink-secondary py-8 text-sm">
              成就簿暂未收录成就。
            </p>
          )}
        </>
      ) : null}
    </GameSceneFrame>
  );
}
