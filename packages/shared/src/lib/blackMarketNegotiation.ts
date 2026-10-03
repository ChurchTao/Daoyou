export type BlackMarketOfferAssessment =
  'insulting' | 'low' | 'reasonable' | 'strong';

export type BlackMarketNegotiationDecision =
  | 'accept'
  | 'counter'
  | 'reject'
  | 'end';

export interface BlackMarketNegotiationInput {
  currentPrice: number;
  floorPrice: number;
  offeredPrice: number;
  patience: number;
  decision: BlackMarketNegotiationDecision;
  concession: number;
  patienceDelta: -2 | -1;
}

export interface BlackMarketNegotiationOutcome {
  outcome: 'accepted' | 'countered' | 'rejected' | 'locked';
  previousPrice: number;
  nextPrice: number;
  nextPatience: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function accepted(
  previousPrice: number,
  nextPrice: number,
  nextPatience: number,
): BlackMarketNegotiationOutcome {
  return {
    outcome: 'accepted',
    previousPrice,
    nextPrice,
    nextPatience,
  };
}

function rejected(
  previousPrice: number,
  nextPrice: number,
  nextPatience: number,
): BlackMarketNegotiationOutcome {
  return {
    outcome: nextPatience <= 0 ? 'locked' : 'rejected',
    previousPrice,
    nextPrice,
    nextPatience: Math.max(0, nextPatience),
  };
}

export function assessOffer(input: {
  currentPrice: number;
  floorPrice: number;
  offeredPrice: number;
}): BlackMarketOfferAssessment {
  const currentPrice = Math.max(1, Math.round(input.currentPrice));
  const floorPrice = clamp(
    Math.round(input.floorPrice),
    1,
    currentPrice,
  );
  const offeredPrice = clamp(
    Math.round(input.offeredPrice),
    1,
    currentPrice,
  );

  if (offeredPrice < floorPrice * 0.72) return 'insulting';

  const gap = currentPrice - floorPrice;
  const progress =
    gap <= 0
      ? offeredPrice >= floorPrice
        ? 1
        : 0
      : (offeredPrice - floorPrice) / gap;

  if (progress < 0.25) return 'low';
  if (progress < 0.65) return 'reasonable';
  return 'strong';
}

export function applyBlackMarketPriceDecision(
  input: BlackMarketNegotiationInput,
): BlackMarketNegotiationOutcome {
  const currentPrice = Math.max(1, Math.round(input.currentPrice));
  const floorPrice = clamp(
    Math.round(input.floorPrice),
    1,
    currentPrice,
  );
  const offeredPrice = clamp(
    Math.round(input.offeredPrice),
    1,
    currentPrice,
  );
  const concession = clamp(input.concession, 0, 1);
  const patienceDelta = clamp(input.patienceDelta, -2, -1) as
    | -2
    | -1;

  if (input.decision === 'end') {
    return {
      outcome: 'locked',
      previousPrice: currentPrice,
      nextPrice: currentPrice,
      nextPatience: 0,
    };
  }

  if (input.decision === 'accept') {
    if (offeredPrice >= floorPrice) {
      return accepted(currentPrice, offeredPrice, input.patience);
    }

    // The owner wanted to accept, but the offer is below their private floor.
    // Convert it into a final counter at the floor.
    const nextPatience = Math.max(0, input.patience + patienceDelta);
    return nextPatience <= 0
      ? {
          outcome: 'locked',
          previousPrice: currentPrice,
          nextPrice: floorPrice,
          nextPatience: 0,
        }
      : {
          outcome: 'countered',
          previousPrice: currentPrice,
          nextPrice: floorPrice,
          nextPatience,
        };
  }

  if (input.decision === 'reject') {
    return rejected(
      currentPrice,
      currentPrice,
      input.patience + patienceDelta,
    );
  }

  // counter
  const gap = currentPrice - floorPrice;
  if (gap <= 0) {
    if (offeredPrice >= floorPrice) {
      return accepted(currentPrice, offeredPrice, input.patience);
    }
    return rejected(
      currentPrice,
      currentPrice,
      input.patience + patienceDelta,
    );
  }

  const nextPrice = Math.max(
    floorPrice,
    Math.round(currentPrice - gap * concession),
  );

  if (offeredPrice >= nextPrice) {
    return accepted(currentPrice, offeredPrice, input.patience);
  }

  const nextPatience = Math.max(0, input.patience + patienceDelta);
  return {
    outcome: nextPatience <= 0 ? 'locked' : 'countered',
    previousPrice: currentPrice,
    nextPrice,
    nextPatience,
  };
}
