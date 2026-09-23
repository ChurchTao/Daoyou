import type { RealmType } from './constants';

export interface GameMailAudienceFilter {
  targetCultivatorId?: string;
  cultivatorCreatedFrom?: string;
  cultivatorCreatedTo?: string;
  realmMin?: RealmType;
  realmMax?: RealmType;
}

export interface BroadcastRecipientSeed {
  recipientType: 'cultivator';
  recipientKey: string;
  metadata?: Record<string, unknown>;
}

export interface RecipientResolveResult {
  totalCount: number;
  recipients: BroadcastRecipientSeed[];
  sampleRecipients: BroadcastRecipientSeed[];
}
