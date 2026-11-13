import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkTabs } from '@app/components/ui/InkTabs';
import type { AchievementView } from '@daoyou/contracts/achievements';
import { useState } from 'react';

type AchievementFilter = 'unlocked' | 'all' | 'locked';
const filters = [
  { value: 'unlocked', label: '已解锁' },
  { value: 'all', label: '全部' },
  { value: 'locked', label: '未解锁' },
];

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
  const [filter, setFilter] = useState<AchievementFilter>('unlocked');
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase();
  const visible = achievements.filter(
    (achievement) =>
      (filter === 'all' || achievement.unlocked === (filter === 'unlocked')) &&
      (!query ||
        `${achievement.name} ${achievement.condition}`
          .toLocaleLowerCase()
          .includes(query)),
  );
  const emptyMessage = !achievements.length
    ? '暂无可浏览的成就。'
    : query
      ? '没有找到符合筛选的成就。'
      : filter === 'unlocked'
        ? '尚未解锁成就，可先查看达成条件。'
        : filter === 'locked'
          ? '全部成就均已解锁。'
          : '暂无可浏览的成就。';

  return (
    <div className="space-y-4">
      <p className="text-ink-secondary text-sm leading-6">
        成就随当前角色记录，转世新角色重新积累。
      </p>
      <InkInput
        label="搜索成就"
        type="search"
        value={search}
        onChange={setSearch}
        placeholder="搜索名称或达成条件"
      />
      <InkTabs
        items={filters}
        activeValue={filter}
        onChange={(value) => setFilter(value as AchievementFilter)}
      />
      {selectedIds.length >= 3 ? (
        <p role="status" className="text-crimson text-sm">
          已选满三项，可先取消一项再选择。
        </p>
      ) : null}
      {visible.length ? (
        visible.map((achievement) => {
          const selected = selectedIds.includes(achievement.id);
          return (
            <section
              key={achievement.id}
              className="border-ink/15 space-y-2 border-b border-dashed pb-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold break-words">
                    {achievement.name}
                  </h3>
                  {achievement.unlocked ? (
                    <p className="text-teal mt-1 text-xs">
                      已解锁
                      {achievement.unlockedAt
                        ? ` · ${new Date(achievement.unlockedAt).toLocaleDateString('zh-CN')}`
                        : ''}
                    </p>
                  ) : null}
                </div>
                <InkButton
                  variant={selected ? 'primary' : 'default'}
                  disabled={
                    disabled ||
                    (!selected &&
                      (!achievement.unlocked || selectedIds.length >= 3))
                  }
                  onClick={() => onToggle(achievement)}
                >
                  {selected
                    ? '取消展示'
                    : achievement.unlocked
                      ? '展示'
                      : '未解锁'}
                </InkButton>
              </div>
              <p className="text-ink-secondary text-sm leading-6">
                {achievement.condition}
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="bg-ink/8 h-1 flex-1"
                  role="progressbar"
                  aria-label={`${achievement.name}进度`}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(1, achievement.progress.target)}
                  aria-valuenow={Math.min(
                    achievement.progress.current,
                    achievement.progress.target,
                  )}
                >
                  <div
                    className={
                      achievement.unlocked
                        ? 'bg-teal h-full'
                        : 'bg-crimson/65 h-full'
                    }
                    style={{
                      width: `${Math.min(100, Math.max(0, (achievement.progress.current / Math.max(1, achievement.progress.target)) * 100))}%`,
                    }}
                  />
                </div>
                <span className="text-ink-secondary shrink-0 font-mono text-xs">
                  {achievement.progress.current}/{achievement.progress.target}
                </span>
              </div>
            </section>
          );
        })
      ) : (
        <div className="py-4 text-center">
          <p role="status" className="text-ink-secondary text-sm">
            {emptyMessage}
          </p>
          {achievements.length && (filter !== 'all' || query) ? (
            <InkButton
              variant="primary"
              onClick={() => {
                setFilter('all');
                setSearch('');
              }}
            >
              查看全部成就
            </InkButton>
          ) : null}
        </div>
      )}
    </div>
  );
}
