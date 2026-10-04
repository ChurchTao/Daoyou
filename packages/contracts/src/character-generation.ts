import type { ApiSuccess } from './http.js';
import type { Cultivator } from '@daoyou/game-domain/character';

export const CHARACTER_GENERATION_DAILY_LIMIT = 6;
export const CHARACTER_GENERATION_LIMIT_REACHED_CODE =
  'CHARACTER_GENERATION_LIMIT_REACHED';

export type CharacterGenerationLimitedBy = 'none' | 'email' | 'ip' | 'both';

export type CharacterGenerationQuota = {
  dailyLimit: number;
  remaining: number;
  remainingByEmail: number;
  remainingByIp: number;
  limitedBy: CharacterGenerationLimitedBy;
  ipTracked: boolean;
};

export type CharacterGenerationQuotaResponse = ApiSuccess<{
  quota: CharacterGenerationQuota;
}>;

export type GenerateCharacterResponse = ApiSuccess<{
  cultivator: Cultivator;
  tempCultivatorId: string;
  quota: CharacterGenerationQuota;
}>;
