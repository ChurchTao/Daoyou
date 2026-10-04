export type EnlightenmentRef = {
  id: string;
  revision: number;
  quantity: number;
};

export type EnlightenmentPreview = {
  successChance: number;
  probabilities: number[];
  cost: { qi: number; baseInsight: number; insight: number };
};
