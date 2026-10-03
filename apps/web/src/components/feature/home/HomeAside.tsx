import { RecentBattles } from '@app/components/feature/ranking/RecentBattles';
import { GameSceneAsideSection } from '@app/components/game-shell';
import { DailyDivinationEntry } from './DailyDivinationEntry';

export function HomeAside({ cultivatorId }: { cultivatorId: string }) {
  return (
    <>
      <section className="min-w-0">
        <DailyDivinationEntry key={cultivatorId} />
      </section>

      <GameSceneAsideSection title="近况卷 · 近期战札">
        <RecentBattles />
      </GameSceneAsideSection>
    </>
  );
}
