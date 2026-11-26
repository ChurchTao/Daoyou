import { ActivityCardInfoButton } from '@app/components/feature/weekly-activity/ActivityCardInfoButton';
import { useInkUI } from '@app/components/providers/useInkUI';
import { InkButton } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import type { BaixiaoQuestionView } from '@daoyou/contracts/baixiao/meet';
import {
  BAIXIAO_CARD_STREAK,
  BAIXIAO_CARD_TYPES,
  type BaixiaoAnswer,
  type BaixiaoCard,
  type BaixiaoHand,
} from '@daoyou/game-domain/baixiao/meet';
import { useEffect, useId, useRef, useState } from 'react';
import './baixiao-turn.css';
import { baixiaoTime } from './time';

const names: Record<BaixiaoCard, string> = {
  pass: '免答卡',
  fortune: '天机卡',
  challenge: '挑战卡',
};
const cardDetails = {
  pass: {
    flavor: '考官看过这一卷，提笔给你画了个朱勾。',
    effect: '本题直接判对，计入出卡前用时。',
  },
  fortune: {
    flavor: '抛一枚天机钱，瞧瞧天意站在哪一面。',
    effect: '判对、判错各 50%。计入出卡前用时，判错另罚 20 秒。',
  },
  challenge: {
    flavor: '尝试挑战考官的权威，用拳头说服考官。',
    effect:
      '交手期间本题停表，全场继续计时。胜计 25 秒。战败、平局或逃离计 45 秒，另罚 20 秒。',
  },
} satisfies Record<BaixiaoCard, { flavor: string; effect: string }>;

type CardDisclosure = {
  card: BaixiaoCard;
  position: number | undefined;
  mode: 'pointer' | 'focus' | 'inspect' | 'play';
};
const letters = ['A', 'B', 'C', 'D'];

type OptionsProps = {
  question: Pick<BaixiaoQuestionView, 'prompt' | 'kind' | 'options'>;
  disabled: boolean;
  pendingOption?: number;
  onAnswer: (option: number) => void;
};

export function BaixiaoFeedbackToast({
  answer,
  totalMs,
  foreground,
}: {
  answer: BaixiaoAnswer & { position: number };
  totalMs: number;
  foreground: boolean;
}) {
  const { pushToast, dismissToast } = useInkUI();
  const [answerTime] = useState(totalMs);
  const toast = useRef<string | null>(null);
  const message = [
    `第 ${answer.position + 1} 题答对`,
    answer.usedCard && names[answer.usedCard],
    answer.bonusCard && `四题连对，获得${names[answer.bonusCard]}`,
    `累计用时 ${baixiaoTime(answerTime)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  useEffect(() => {
    if (foreground && !toast.current)
      toast.current = pushToast({ message, tone: 'success', duration: 3000 });
  }, [foreground, message, pushToast]);
  useEffect(
    () => () => {
      if (toast.current) dismissToast(toast.current);
      toast.current = null;
    },
    [dismissToast],
  );
  return null;
}

export function BaixiaoQuestionOptions({
  question,
  disabled,
  pendingOption,
  onAnswer,
}: OptionsProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <>
      <h2 tabIndex={-1} ref={heading}>
        {question.prompt}
      </h2>
      <div className="baixiao-options">
        {question.options.map((option, index) => (
          <button
            type="button"
            key={option}
            disabled={disabled}
            data-pending={index === pendingOption || undefined}
            onClick={() => onAnswer(index)}
          >
            {question.kind === 'choice' && (
              <span aria-hidden="true">{letters[index]}</span>
            )}
            {option}
          </button>
        ))}
      </div>
    </>
  );
}

export function BaixiaoHandPanel({
  hand,
  streak,
  position,
  disabled,
  pendingCard,
  latest,
  onCard,
}: {
  hand: BaixiaoHand;
  streak: number;
  position?: number;
  disabled: boolean;
  pendingCard?: BaixiaoCard;
  latest: (BaixiaoAnswer & { position: number }) | null;
  onCard: (card: BaixiaoCard) => void;
}) {
  const detailId = useId();
  const [open, setOpen] = useState<CardDisclosure | null>(null);
  const [hint, setHint] = useState<CardDisclosure | null>(null);
  const origin = useRef<HTMLButtonElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const selected = open?.position === position ? open : null;
  const detail = selected ?? (hint?.position === position ? hint : null);
  const playing = detail?.mode === 'play' ? detail.card : null;
  const award = latest?.bonusCard;

  useEffect(() => {
    if (playing)
      actions.current
        ?.querySelector<HTMLButtonElement>('button:last-child')
        ?.focus({ preventScroll: true });
  }, [playing]);

  function dismiss() {
    setOpen(null);
    setHint(null);
    if (playing) origin.current?.focus({ preventScroll: true });
  }

  return (
    <section
      className="baixiao-tactics"
      aria-label="对策卡"
      onPointerLeave={() => {
        if (hint?.mode === 'pointer') setHint(null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && detail) {
          event.stopPropagation();
          dismiss();
        }
      }}
    >
      <div className="baixiao-tactics-caption">
        <h2>对策卡</h2>
        <span className="baixiao-streak">
          <span>连对</span>
          <span
            className="baixiao-streak-marks"
            role="img"
            aria-label={`连对 ${streak} / ${BAIXIAO_CARD_STREAK}`}
          >
            {Array.from({ length: BAIXIAO_CARD_STREAK }, (_, index) => (
              <i key={index} data-filled={index < streak || undefined} />
            ))}
          </span>
        </span>
      </div>
      <div className="baixiao-tactics-hand">
        {BAIXIAO_CARD_TYPES.map((card) => {
          const shown = detail?.card === card;
          const confirming = playing === card;
          return (
            <div className="baixiao-card-slot" key={card}>
              <button
                className="baixiao-card"
                type="button"
                disabled={disabled || !hand[card]}
                aria-label={`${card === 'pass' ? '使用' : '选择'}${names[card]}，余 ${hand[card]} 张`}
                aria-expanded={card === 'pass' ? undefined : confirming}
                aria-controls={confirming ? detailId : undefined}
                data-pending={pendingCard === card || undefined}
                onClick={(event) => {
                  setHint(null);
                  if (card === 'pass') {
                    setOpen(null);
                    onCard(card);
                  } else {
                    origin.current = event.currentTarget;
                    setOpen(
                      confirming ? null : { card, position, mode: 'play' },
                    );
                  }
                }}
              >
                <GameIcon
                  value={`icon:baixiao-${card}`}
                  className="baixiao-card-icon"
                />
                <strong>
                  <span>{names[card]}</span>
                  <span className="font-mono">×{hand[card]}</span>
                </strong>
                {award === card && (
                  <span
                    key={latest?.position}
                    className="baixiao-card-bonus font-mono"
                    aria-hidden="true"
                  >
                    +1
                  </span>
                )}
              </button>
              <ActivityCardInfoButton
                aria-label={`查看${names[card]}效果`}
                aria-expanded={shown && !confirming}
                aria-controls={shown && !confirming ? detailId : undefined}
                aria-describedby={shown && !confirming ? detailId : undefined}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse' && !selected)
                    setHint({ card, position, mode: 'pointer' });
                }}
                onFocus={(event) => {
                  if (
                    event.currentTarget.matches(':focus-visible') &&
                    !selected
                  )
                    setHint({ card, position, mode: 'focus' });
                }}
                onBlur={() => {
                  if (hint?.mode === 'focus') setHint(null);
                }}
                onClick={() => {
                  setHint(null);
                  setOpen(
                    selected?.card === card && selected.mode === 'inspect'
                      ? null
                      : { card, position, mode: 'inspect' },
                  );
                }}
              />
            </div>
          );
        })}
      </div>
      {detail && (
        <div className="baixiao-card-detail" id={detailId} key={detail.card}>
          <div>
            <h3>{names[detail.card]}</h3>
            <p>{cardDetails[detail.card].flavor}</p>
            <p className="baixiao-card-effect">
              {cardDetails[detail.card].effect}
            </p>
          </div>
          {playing && (
            <div className="baixiao-card-actions" ref={actions}>
              <InkButton variant="secondary" onClick={dismiss}>
                收起
              </InkButton>
              <InkButton
                variant="primary"
                disabled={disabled || !hand[playing]}
                pending={pendingCard === playing}
                pendingLabel="正在用卡…"
                onClick={() => onCard(playing)}
              >
                {playing === 'challenge' ? '发起挑战' : '掷天机钱'}
              </InkButton>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
