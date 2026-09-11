import { InkButton } from '@app/components/ui/InkButton';
import type { DungeonEncounterView } from '@shared/contracts/combatV6Dungeon';

export function BattlePreparation({
  encounter,
  processing,
  onBegin,
  onQuit,
}: {
  encounter: DungeonEncounterView;
  processing: boolean;
  onBegin: () => Promise<void>;
  onQuit: () => Promise<boolean>;
}) {
  return (
    <div className="space-y-6 py-4">
      <p className="text-ink leading-8">{encounter.description}</p>
      <div>
        <p className="text-ink-secondary mb-2 text-sm">
          前方守敌 ·{' '}
          <span className="font-mono">{encounter.enemies.length}</span> 位
        </p>
        <p className="text-crimson text-lg">{encounter.enemies.join('、')}</p>
      </div>
      <dl className="border-ink/15 grid grid-cols-2 gap-4 border-y py-4 text-sm">
        <div>
          <dt className="text-ink-secondary">气血</dt>
          <dd className="mt-1 font-mono">
            {Math.floor(encounter.hp.current)} / {Math.floor(encounter.hp.max)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-secondary">法力</dt>
          <dd className="mt-1 font-mono">
            {Math.floor(encounter.mp.current)} / {Math.floor(encounter.mp.max)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-ink-secondary">出战灵兽</dt>
          <dd className="mt-1">{encounter.beast ?? '无'}</dd>
        </div>
      </dl>
      <p className="text-ink-secondary text-sm leading-7">
        迎战将以当前气血、法力入场，战斗消耗会保留。也可就此结束探索，带走此前已确定的收获。
      </p>
      <div className="flex flex-wrap gap-3">
        <InkButton disabled={processing} onClick={() => void onBegin()}>
          {processing ? '处理中…' : '迎战'}
        </InkButton>
        <InkButton
          variant="secondary"
          disabled={processing}
          onClick={() => void onQuit()}
        >
          结束探索
        </InkButton>
      </div>
    </div>
  );
}
