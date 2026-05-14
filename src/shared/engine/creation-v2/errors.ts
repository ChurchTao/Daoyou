export type CreationPhaseKey =
  | 'Analysis'
  | 'Budgeting'
  | 'Selection'
  | 'Composition'
  | 'Projection';

type CreationErrorContext = {
  facts?: unknown;
  decision?: unknown;
  rulesApplied?: string[];
  [key: string]: unknown;
};

export class CreationError extends Error {
  constructor(
    public phase: CreationPhaseKey,
    public code: string,
    public message: string,
    public context?: CreationErrorContext,
  ) {
    super(`[Creation ${phase} Error] ${code}: ${message}`);
    this.name = 'CreationError';
  }
}
