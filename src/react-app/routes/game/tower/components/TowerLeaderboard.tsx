import { GameSceneSection, GameSceneTabs } from '@app/components/game-shell';
import { InkCard } from '@app/components/ui/InkCard';
import { InkSelect } from '@app/components/ui/InkSelect';
import {
  TOWER_ELIGIBLE_REALMS,
  type TowerLeaderboardEntry,
} from '@shared/lib/tower';
import type { RealmType } from '@shared/types/constants';

interface TowerLeaderboardProps {
  activeRealm: RealmType;
  entries: TowerLeaderboardEntry[];
  loading: boolean;
  onRealmChange: (realm: RealmType) => void;
}

export function TowerLeaderboard({
  activeRealm,
  entries,
  loading,
  onRealmChange,
}: TowerLeaderboardProps) {
  return (
    <GameSceneSection title="留名榜">
      <InkCard className="min-w-0 w-full space-y-4 overflow-hidden p-4">
        <div className="md:hidden">
          <InkSelect
            value={activeRealm}
            onChange={(value) => onRealmChange(value as RealmType)}
            className="w-full"
          >
            {TOWER_ELIGIBLE_REALMS.map((realm) => (
              <option key={realm} value={realm}>
                {realm}榜
              </option>
            ))}
          </InkSelect>
        </div>

        <GameSceneTabs
          className="hidden md:block"
          items={TOWER_ELIGIBLE_REALMS.map((realm) => ({
            label: `${realm}榜`,
            value: realm,
          }))}
          activeValue={activeRealm}
          onChange={(value) => onRealmChange(value as RealmType)}
        />

        {loading ? (
          <p className="loading-tip py-6 text-center">正在校准榜位……</p>
        ) : entries.length === 0 ? (
          <p className="text-ink-secondary py-6 text-center text-sm">
            本周此境尚无人留名。
          </p>
        ) : (
          <div className="max-h-80 space-y-3 overflow-x-hidden overflow-y-auto pr-1 md:max-h-120">
            {entries.map((entry) => (
              <div
                key={`${entry.recordedRealm}:${entry.cultivatorId}`}
                className="border-ink/15 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-dashed pb-3 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-crimson min-w-12 text-sm font-semibold">
                      第 {entry.rank} 名
                    </span>
                    <span className="min-w-0 truncate font-semibold">
                      {entry.name}
                      {entry.title ? `「${entry.title}」` : ''}
                    </span>
                  </div>
                  <div className="text-ink-secondary mt-1 truncate text-xs">
                    境界：{entry.realm} {entry.realmStage}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-ink text-lg font-semibold">
                    {entry.highestFloor} 层
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </InkCard>
    </GameSceneSection>
  );
}
