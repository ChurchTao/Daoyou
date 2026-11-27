import { BeastRestButton } from '@app/components/feature/beasts/BeastRestButton';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { RewardItemGrid } from '@app/components/feature/items/RewardItemGrid';
import { ActivityCardInfoButton } from '@app/components/feature/weekly-activity/ActivityCardInfoButton';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import type {
  InvasionCommand,
  InvasionPreviousWave,
  InvasionStatus,
} from '@daoyou/contracts/invasion';
import {
  INVASION_CARDS,
  INVASION_CARD_COPY,
  type InvasionCard,
} from '@daoyou/game-domain/invasion';
import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';
import {
  INVASION_REST_MS,
  invasionBossWave,
} from '@daoyou/game-rules/invasion';
import { useEffect, useId, useRef, useState } from 'react';
import { InvasionPortrait } from './InvasionParty';
import { invasionClock } from './request';

type Team = NonNullable<InvasionStatus['team']>;
type Send = (input: InvasionCommand) => Promise<boolean>;
const rewardNumber = new Intl.NumberFormat('zh-CN');

function PreviousWaveReward({ result }: { result: InvasionPreviousWave }) {
  const reward = result.status === 'settled' ? result.reward : null;
  return (
    <section
      className="invasion-receipt"
      aria-label="上一波收益"
      aria-live="polite"
    >
      <div className="invasion-section-heading">
        <h3>上一波收益</h3>
        <span>
          第 <b className="font-mono">{result.wave}</b> 波 ·{' '}
          {result.status === 'assist' ? '助战成功' : '已通关'}
        </span>
      </div>
      {reward ? (
        <div className="invasion-wave-rewards">
          <dl>
            <div>
              <dt>修为</dt>
              <dd>+{rewardNumber.format(reward.cultivationExp)}</dd>
            </div>
            <div>
              <dt>灵石</dt>
              <dd>+{rewardNumber.format(reward.spiritStones)}</dd>
            </div>
            <div>
              <dt>感悟</dt>
              <dd>+{rewardNumber.format(reward.insight)}</dd>
            </div>
          </dl>
          {reward.drops.length > 0 ? (
            <div className="min-w-0" aria-label="道具奖励" role="group">
              <RewardItemGrid grants={reward.drops} />
            </div>
          ) : (
            <p className="invasion-note">本波无道具掉落</p>
          )}
        </div>
      ) : (
        <p className="invasion-note">
          {result.status === 'pending'
            ? '正在结算本波收益……'
            : result.status === 'assist'
              ? '本波为助战，无个人收益。'
              : '本波收益明细未记录。'}
        </p>
      )}
    </section>
  );
}

function RecoverySlots({
  team,
  playerId,
  disabled,
  send,
}: {
  team: Team;
  playerId?: string;
  disabled: boolean;
  send: Send;
}) {
  const bag = useInventoryBag();
  const identity = useCultivatorIdentity();
  const body = playerId ? team.resources[playerId] : undefined;
  const ids = new Set(team.recovery.map(({ id }) => id));
  const items = (bag.data?.items ?? []).filter((item) => ids.has(item.id));
  async function use(id: string, close?: () => void) {
    if (
      await send({
        type: 'recover',
        itemId: id,
        requestId: crypto.randomUUID(),
      })
    ) {
      close?.();
      await bag.reload();
    }
  }

  return (
    <section className="invasion-supplies" aria-label="回复丹药">
      <div className="invasion-section-heading">
        <h3>回复丹药</h3>
        <span>每次消耗 1 份</span>
      </div>
      {items.length ? (
        <InventoryItems
          items={items}
          compact
          quickTouchHint
          className="grid-cols-[repeat(auto-fill,minmax(3.9rem,4.5rem))] gap-2"
          slotProps={(item) => {
            const facts = ConsumableFactsSchema.safeParse(item?.instanceData);
            const usable =
              body &&
              body.hp > 0 &&
              facts.success &&
              facts.data.spec.kind === 'pill' &&
              facts.data.spec.operations.some(
                (op) =>
                  op.type === 'restore_resource' &&
                  (op.resource === 'hp'
                    ? body.hp < body.maxHp
                    : body.mp < body.maxMp),
              );
            const available = !!item && !!usable && !disabled;
            return {
              previewOptions: { realm: identity.data?.cultivator.realm },
              quickOnTouch: available,
              onQuickAction: available ? () => void use(item.id) : undefined,
              children: item
                ? (close) =>
                    available ? (
                      <InkButton
                        variant="primary"
                        onClick={() => void use(item.id, close)}
                      >
                        服用 1 份
                      </InkButton>
                    ) : (
                      <p className="text-ink-secondary text-sm">
                        {usable
                          ? '休憩已结束或正在结算'
                          : '当前状态用不上这枚丹药。'}
                      </p>
                    )
                : undefined,
            };
          }}
        />
      ) : (
        <p className="invasion-note">
          {body?.hp === 0 ? '倒地时无法服药。' : '暂无可用的回复丹药。'}
        </p>
      )}
    </section>
  );
}

function InvasionHand({
  hand,
  disabled,
  send,
}: {
  hand: Team['self'];
  disabled: boolean;
  send: Send;
}) {
  const [open, setOpen] = useState<InvasionCard | null>(null);
  const [preview, setPreview] = useState<{
    card: InvasionCard;
    input: 'pointer' | 'focus';
  } | null>(null);
  const detailId = useId();
  const detailRef = useRef<HTMLDivElement>(null);
  const cards = INVASION_CARDS.filter((card) => hand.cards[card]);
  const detail = open ?? preview?.card;

  useEffect(() => {
    if (open) detailRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  return (
    <section
      className="invasion-hand"
      aria-label="增益卡"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !detail) return;
        event.stopPropagation();
        setOpen(null);
        setPreview(null);
      }}
    >
      <div className="invasion-section-heading">
        <h3>增益卡</h3>
        <span>下一波可用 1 张</span>
      </div>
      {cards.length ? (
        <div className="invasion-deck">
          {cards.map((card) => {
            const selected = hand.selected === card;
            const shown = detail === card;
            const { name } = INVASION_CARD_COPY[card];
            const clearPreview = (input: 'pointer' | 'focus') => {
              setPreview((current) =>
                current?.card === card && current.input === input
                  ? null
                  : current,
              );
            };
            return (
              <div className="invasion-card-slot" key={card}>
                <button
                  className="invasion-card"
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() =>
                    void send({ type: 'card', card: selected ? null : card })
                  }
                >
                  <span className="invasion-card-top">
                    <small className="font-mono">×{hand.cards[card]}</small>
                    {selected && <span>已选</span>}
                  </span>
                  <span className="invasion-card-picture">
                    <GameIcon
                      value={`icon:invasion-${card}`}
                      purpose="artwork"
                      className="invasion-card-art"
                    />
                  </span>
                  <strong>{name}</strong>
                </button>
                <ActivityCardInfoButton
                  aria-label={`查看${name}效果`}
                  aria-expanded={shown}
                  aria-controls={shown ? detailId : undefined}
                  aria-describedby={shown ? detailId : undefined}
                  onPointerEnter={(event) => {
                    if (event.pointerType === 'mouse' && !open) {
                      setPreview({ card, input: 'pointer' });
                    }
                  }}
                  onPointerLeave={() => clearPreview('pointer')}
                  onFocus={(event) => {
                    if (
                      event.currentTarget.matches(':focus-visible') &&
                      !open
                    ) {
                      setPreview({ card, input: 'focus' });
                    }
                  }}
                  onBlur={() => clearPreview('focus')}
                  onClick={() => {
                    setPreview(null);
                    setOpen((current) => (current === card ? null : card));
                  }}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="invasion-note">手中暂无增益卡。</p>
      )}
      {detail && (
        <div className="invasion-card-detail" id={detailId} ref={detailRef}>
          <strong>{INVASION_CARD_COPY[detail].name}</strong>
          <p>{INVASION_CARD_COPY[detail].effect}</p>
        </div>
      )}
    </section>
  );
}

export function InvasionRest({
  team,
  playerId,
  currentWave,
  now,
  closesAt,
  busy,
  send,
}: {
  team: Team;
  playerId?: string;
  currentWave: number;
  now: number;
  closesAt: number;
  busy: boolean;
  send: Send;
}) {
  const remaining = Math.max(
    0,
    Math.min(INVASION_REST_MS, (team.restEndsAt ?? now) - now),
  );
  const enabled = remaining > 0 && now < closesAt && !busy;
  const self = playerId ? team.resources[playerId] : undefined;
  const boss = invasionBossWave(team.wave);

  return (
    <section className="invasion-operations" aria-label="波间休憩">
      <header className="invasion-wave-banner">
        <div>
          <p className="invasion-eyebrow">{boss ? '首领将至' : '波间休憩'}</p>
          <h2>
            第 <b className="font-mono">{team.wave}</b> 波
          </h2>
          <p>
            {team.realm}难度 ·{' '}
            {team.firstClear ? '可推进个人进度' : '本波为助战'}
          </p>
        </div>
        <div className="invasion-wave-countdown">
          <small>距开阵</small>
          <strong className="font-mono">
            {invasionClock(remaining, true)}
          </strong>
          <progress
            max={INVASION_REST_MS}
            value={remaining}
            aria-label="休憩剩余时间"
          />
        </div>
      </header>
      {team.previousWave && <PreviousWaveReward result={team.previousWave} />}
      <div className="invasion-preparation">
        <section className="invasion-vitals" aria-label="队伍战况">
          <div className="invasion-section-heading">
            <h3>队伍战况</h3>
            <span>
              本期已过 <b className="font-mono">{currentWave}</b> 波
            </span>
          </div>
          {team.members.map((member) => {
            const condition = team.resources[member.cultivatorId];
            return (
              <div className="invasion-vital" key={member.cultivatorId}>
                <InvasionPortrait member={member} />
                <div>
                  <div className="invasion-vital-name">
                    <strong>{member.name}</strong>
                  </div>
                  {condition && condition.hp > 0 ? (
                    <div className="invasion-vital-bars">
                      <div>
                        <span>
                          气血{' '}
                          <strong className="font-mono">
                            {condition.hp}/{condition.maxHp}
                          </strong>
                        </span>
                        <meter
                          min="0"
                          max={condition.maxHp}
                          value={condition.hp}
                          aria-label={`${member.name} 气血`}
                        />
                      </div>
                      <div>
                        <span>
                          法力{' '}
                          <strong className="font-mono">
                            {condition.mp}/{condition.maxMp}
                          </strong>
                        </span>
                        <meter
                          data-mana
                          min="0"
                          max={condition.maxMp || 1}
                          value={condition.mp}
                          aria-label={`${member.name} 法力`}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="invasion-note">
                      {condition ? '已倒地' : '状态待回传'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
        <div className="invasion-preparation-actions">
          <RecoverySlots
            team={team}
            playerId={playerId}
            disabled={!enabled}
            send={send}
          />
          <BeastRestButton label="灵兽休养" disabled={!enabled}
            activity={{ kind: 'invasion', runId: team.id }} />
          <InvasionHand
            hand={team.self}
            disabled={!enabled || !self?.hp}
            send={send}
          />
        </div>
      </div>
      <footer className="invasion-operation-footer">
        <p>{now >= closesAt ? '本期已收阵。' : '休憩结束后自动开阵。'}</p>
        {team.leader && (
          <div className="invasion-action-row">
            <InkButton
              variant="secondary"
              disabled={!enabled}
              onClick={() => void send({ type: 'withdraw' })}
            >
              全队返回集结
            </InkButton>
            <InkButton
              variant="primary"
              disabled={!enabled}
              onClick={() =>
                void send({ type: 'next', runId: team.id, wave: team.wave })
              }
            >
              开启下一波
            </InkButton>
          </div>
        )}
      </footer>
    </section>
  );
}
