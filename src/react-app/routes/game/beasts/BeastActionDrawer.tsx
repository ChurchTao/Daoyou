import { InkModal } from '@app/components/layout/InkModal';
import { InkButton } from '@app/components/ui/InkButton';
import type { SummonedBeast } from '@shared/engine/combat-v6/beasts';
import { beastRestCost } from '@shared/engine/combat-v6/beasts/progression';

export type BeastAction = 'release' | 'rest';
const labels = { release: '放生', rest: '休养' };
export function BeastActionDrawer({
  beast,
  action,
  spiritStones,
  pending,
  close,
  confirm,
}: {
  beast: SummonedBeast;
  action: BeastAction;
  spiritStones: number;
  pending: boolean;
  close: () => void;
  confirm: () => void;
}) {
  const cost = beastRestCost(beast);
  return (
    <InkModal
      isOpen
      title={`${labels[action]} · ${beast.name}`}
      onClose={close}
      footer={
        <div className="flex justify-end gap-3">
          <InkButton disabled={pending} onClick={close}>
            取消
          </InkButton>
          <InkButton
            pending={pending}
            disabled={action === 'rest' && (cost <= 0 || cost > spiritStones)}
            onClick={confirm}
          >
            确认{labels[action]}
          </InkButton>
        </div>
      }
    >
      {action === 'rest' ? (
        <div className="space-y-3 text-sm">
          <p>
            恢复{' '}
            <span className="font-mono">
              {beast.maxLifespan - beast.currentLifespan}
            </span>{' '}
            点寿命，消耗 <span className="font-mono">{cost}</span> 灵石。
          </p>
          <p>
            现有灵石 <span className="font-mono">{spiritStones}</span>
          </p>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p>
            <span className="font-mono">{beast.level}</span> 级 · 成长{' '}
            <span className="font-mono">{beast.growth.toFixed(3)}</span> ·{' '}
            <span className="font-mono">{beast.skillSlotCapacity}</span>{' '}
            个技能格
          </p>
          <p>放生没有收益，无法找回。该灵兽会同时移出携带编组。</p>
        </div>
      )}
    </InkModal>
  );
}
