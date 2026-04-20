export type CreationPhaseKey = 'Analysis' | 'Budgeting' | 'Selection' | 'Composition' | 'Projection';

export class CreationError extends Error {
  constructor(
    public phase: CreationPhaseKey,
    public code: string,
    public message: string,
    public context?: {
      facts?: any;
      decision?: any;
      rulesApplied?: string[];
      // 允许携带额外的调试信息而不破坏结构
      [key: string]: any; 
    }
  ) {
    super(`[Creation ${phase} Error] ${code}: ${message}`);
    this.name = 'CreationError';
  }
}
