import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { InkModal } from '@app/components/layout/InkModal';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import type {
  BeastManagementView,
  BeastRecoveryRequest,
} from '@daoyou/contracts/beasts';
import type { SummonedBeast } from '@daoyou/game-domain/beasts';
import { beastRestCost } from '@daoyou/game-rules/beasts/growth';
import { useRef, useState } from 'react';

const base = '/api/combat-v6/beasts';

export function BeastRestDialog({
  beasts,
  spiritStones,
  scope,
  activity,
  onClose,
  onRest,
}: {
  beasts: SummonedBeast[];
  spiritStones: number;
  scope: BeastRecoveryRequest['scope'];
  activity?: BeastRecoveryRequest['activity'];
  onClose: () => void;
  onRest: (view: BeastManagementView) => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const { pushToast } = useInkUI();
  const needed = beasts
    .map((beast) => ({ beast, cost: beastRestCost(beast) }))
    .filter(({ cost }) => cost > 0);
  const cost = needed.reduce((total, item) => total + item.cost, 0);
  const confirm = async () => {
    if (busy.current || cost <= 0 || cost > spiritStones) return;
    busy.current = true;
    setPending(true);
    try {
      const input: BeastRecoveryRequest = {
        requestId,
        scope,
        activity,
        expectedCost: cost,
        beasts: needed.map(({ beast }) => ({
          beastId: beast.id,
          expectedRevision: beast.revision,
        })),
      };
      const result = await combatV6Request<BeastManagementView>(
        `${base}/rest`,
        mutationBody(input),
      );
      onRest(result);
      onClose();
      pushToast({ message: '休养完成', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '休养未完成',
        tone: 'warning',
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <InkModal
      isOpen
      title={scope === 'single' ? `休养 · ${beasts[0].name}` : '灵兽休养'}
      onClose={() => {
        if (!busy.current) onClose();
      }}
      footer={
        <div className="flex justify-end gap-3">
          <InkButton variant="secondary" disabled={pending} onClick={onClose}>
            取消
          </InkButton>
          <InkButton
            variant="primary"
            pending={pending}
            disabled={!cost || cost > spiritStones}
            onClick={() => void confirm()}
          >
            确认休养
          </InkButton>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        {needed.length ? (
          <p>
            将 <span className="font-mono">{needed.length}</span>{' '}
            只灵兽的气血和法力恢复至上限，需 <SpiritStones amount={cost} />。
          </p>
        ) : (
          <p>灵兽的气血和法力已满。</p>
        )}
        {cost > 0 && (
          <p>
            现有灵石 <SpiritStones amount={spiritStones} mode="compact" />
          </p>
        )}
      </div>
    </InkModal>
  );
}

export function BeastRestButton({
  disabled,
  view,
  activity,
  onRest,
  label = '休养',
}: {
  disabled?: boolean;
  view?: BeastManagementView;
  activity?: BeastRecoveryRequest['activity'];
  onRest?: (view: BeastManagementView) => void;
  label?: string;
}) {
  const [quote, setQuote] = useState<BeastManagementView>();
  const [loading, setLoading] = useState(false);
  const { pushToast } = useInkUI();
  async function open() {
    if (view) {
      setQuote(view);
      return;
    }
    setLoading(true);
    try {
      setQuote(await combatV6Request<BeastManagementView>(base));
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '无法读取灵兽状态',
        tone: 'warning',
      });
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <InkButton
        variant="secondary"
        disabled={disabled || loading}
        pending={loading}
        onClick={() => void open()}
      >
        {label}
      </InkButton>
      {quote && (
        <BeastRestDialog
          beasts={quote.beasts.filter(({ id }) =>
            quote.lineup.carriedBeastIds.includes(id),
          )}
          spiritStones={quote.spiritStones}
          scope="bag"
          activity={activity}
          onClose={() => setQuote(undefined)}
          onRest={(result) => onRest?.(result)}
        />
      )}
    </>
  );
}
