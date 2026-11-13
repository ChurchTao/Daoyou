import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import type { AchievementView } from '@daoyou/contracts/achievements';
import { ACHIEVEMENT_CATEGORY_IDS } from '@daoyou/game-domain/achievements';
import { useId } from 'react';
import { achievementIcon } from '../achievements/achievementIcons';

export function AchievementPicker({
  achievements,
  selectedIds,
  disabled,
  onToggle,
}: {
  achievements: AchievementView[];
  selectedIds: string[];
  disabled: boolean;
  onToggle: (achievement: AchievementView) => void;
}) {
  const limitHintId = useId();
  const atLimit = selectedIds.length >= 3;
  const selected = selectedIds.flatMap((id) => {
    const achievement = achievements.find((item) => item.id === id);
    return achievement ? [achievement] : [];
  });
  const earned = achievements.filter((achievement) => achievement.unlocked);
  const categories = ACHIEVEMENT_CATEGORY_IDS.flatMap((category) => {
    const items = earned.filter((item) => item.category === category);
    if (!items.length) return [];
    const series = new Map<
      string,
      { name: string; items: AchievementView[] }
    >();
    for (const item of items) {
      const group = series.get(item.seriesId);
      if (group) group.items.push(item);
      else series.set(item.seriesId, { name: item.seriesName, items: [item] });
    }
    return [
      {
        id: category,
        label: items[0].categoryLabel,
        series: [...series.entries()].map(([id, group]) => ({
          id,
          name: group.name,
          items: group.items.sort((left, right) => left.tier - right.tier),
        })),
      },
    ];
  });

  return (
    <div className="space-y-5">
      <section
        aria-label="当前已选成就"
        className="border-ink/15 border-b pb-3"
      >
        <h3 className="text-ink-secondary text-xs">当前已选</h3>
        {selected.length ? (
          <ul className="mt-1">
            {selected.map((achievement) => (
              <li key={achievement.id}>
                <div
                  role="group"
                  aria-label={achievement.name}
                  className="flex min-w-0 items-center gap-2"
                >
                  <GameIcon
                    value={achievementIcon(achievement)}
                    className="text-lg"
                  />
                  <span className="text-ink min-w-0 flex-1 text-sm leading-6 wrap-anywhere">
                    {achievement.name}
                  </span>
                  <InkButton
                    variant="secondary"
                    disabled={disabled}
                    className="min-h-11"
                    onClick={() => onToggle(achievement)}
                  >
                    取消
                  </InkButton>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-secondary mt-2 text-sm leading-6">
            {selectedIds.length
              ? '已选成就暂不可读取。'
              : earned.length
                ? '尚未选择，可从下方已获成就中挑选。'
                : '尚未选择展示成就。'}
          </p>
        )}
        {atLimit ? (
          <p
            id={limitHintId}
            role="status"
            className="text-crimson mt-2 text-sm leading-6"
          >
            已选满三项，先取消一项即可替换。
          </p>
        ) : null}
      </section>
      {categories.length ? (
        <div className="space-y-6">
          {categories.map((category) => (
            <section key={category.id} aria-label={category.label + '成就'}>
              <h3 className="border-ink/20 border-b pb-2 text-base font-semibold">
                {category.label}
              </h3>
              <div className="space-y-3 pt-3">
                {category.series.map((series) => (
                  <section key={series.id} aria-label={series.name}>
                    <h4 className="text-ink-secondary mb-1 text-xs">
                      {series.name}
                    </h4>
                    <ul className="divide-ink/8 divide-y">
                      {series.items.map((achievement) => {
                        const isSelected = selectedIds.includes(achievement.id);
                        const unavailable = atLimit && !isSelected;
                        return (
                          <li key={achievement.id}>
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              aria-disabled={unavailable || disabled}
                              aria-describedby={
                                unavailable ? limitHintId : undefined
                              }
                              disabled={disabled}
                              onClick={() => {
                                if (!unavailable) onToggle(achievement);
                              }}
                              className={cn(
                                'focus-visible:outline-crimson grid min-h-16 w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 border-l-2 py-3 pr-2 pl-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                                isSelected
                                  ? 'border-crimson bg-crimson/5'
                                  : 'border-transparent',
                                unavailable
                                  ? 'cursor-not-allowed'
                                  : 'hover:bg-ink/3 cursor-pointer',
                              )}
                            >
                              <GameIcon
                                value={achievementIcon(achievement)}
                                className="mt-1 text-2xl"
                              />
                              <span className="min-w-0">
                                <span className="text-ink block text-base leading-6 font-semibold wrap-anywhere">
                                  {achievement.name}
                                </span>
                                <span className="text-ink-secondary mt-0.5 block text-sm leading-6 wrap-anywhere">
                                  {achievement.condition}
                                </span>
                              </span>
                              <span
                                className={cn(
                                  'shrink-0 pt-0.5 text-xs leading-6',
                                  isSelected
                                    ? 'text-crimson'
                                    : 'text-ink-secondary',
                                )}
                              >
                                {isSelected
                                  ? '✓ 已选'
                                  : unavailable
                                    ? '名额已满'
                                    : '选择'}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p role="status" className="text-ink-secondary py-4 text-sm leading-7">
          尚无可展示的成就，获得后会出现在这里。
        </p>
      )}
    </div>
  );
}
