import type { BaixiaoQuestionView } from '@daoyou/contracts/baixiao/meet';
import {
  BAIXIAO_CARD_STREAK,
  BAIXIAO_CARD_TYPES,
  type BaixiaoAnswer,
  type BaixiaoCard,
  type BaixiaoHand,
} from '@daoyou/game-domain/baixiao/meet';
import { useEffect, useRef } from 'react';
import './baixiao-turn.css';

const names: Record<BaixiaoCard, string> = {
  pass: '免答卡',
  fortune: '天机卡',
  challenge: '挑战卡',
};
const effects: Record<BaixiaoCard, string> = {
  pass: '本题直接判对',
  fortune: '判对、判错各 50%',
  challenge: '与考官交手。胜计 25 秒，战败或逃离计 45 秒并罚时',
};
const feedback = {
  correct: '答对',
  wrong: '答错 · 罚时 20 秒',
  timeout: '作答超时 · 罚时 20 秒',
  focus: '已离开作答页面 · 罚时 20 秒',
} as const;
const letters = ['A', 'B', 'C', 'D'];

type OptionsProps = {
  question: Pick<BaixiaoQuestionView, 'prompt' | 'kind' | 'options'>;
  disabled: boolean;
  onAnswer: (option: number) => void;
};

export function BaixiaoFeedback({ answer }: { answer: BaixiaoAnswer }) {
  return (
    <>
      <span>
        {answer.usedCard && `${names[answer.usedCard]} · `}
        {feedback[answer.verdict]}
      </span>
      {answer.bonusCard && (
        <small>四题连对，获得「{names[answer.bonusCard]}」</small>
      )}
    </>
  );
}

export function BaixiaoQuestionOptions({
  question,
  disabled,
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

export function BaixiaoTurn({
  hand,
  streak,
  onCard,
  ...options
}: OptionsProps & {
  hand: BaixiaoHand;
  streak: number;
  onCard: (card: BaixiaoCard) => void;
}) {
  return (
    <>
      <BaixiaoQuestionOptions {...options} />
      <div className="baixiao-tactics" aria-label="对策卡">
        <div className="baixiao-tactics-caption">
          <span>对策卡</span>
          <span>
            连对{' '}
            <b className="font-mono">
              {streak}/{BAIXIAO_CARD_STREAK}
            </b>{' '}
            · 满额抽一张
          </span>
        </div>
        <div className="baixiao-tactics-hand">
          {BAIXIAO_CARD_TYPES.map((card) => (
            <button
              key={card}
              type="button"
              onClick={() => onCard(card)}
              disabled={options.disabled || !hand[card]}
            >
              <strong>
                {names[card]} <span className="font-mono">×{hand[card]}</span>
              </strong>
              <small>{effects[card]}</small>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
