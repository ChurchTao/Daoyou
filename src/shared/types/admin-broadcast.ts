import type { RealmType } from './constants';

export type AdminChannel = 'email' | 'game_mail';

export type TemplateStatus = 'active' | 'disabled';

export type RecipientType = 'email' | 'cultivator';

export type TemplateVariableMap = Record<string, string | number>;

export interface EmailAudienceFilter {
  registeredFrom?: string;
  registeredTo?: string;
  hasActiveCultivator?: boolean;
  realmMin?: RealmType;
  realmMax?: RealmType;
}

export interface GameMailAudienceFilter {
  cultivatorCreatedFrom?: string;
  cultivatorCreatedTo?: string;
  realmMin?: RealmType;
  realmMax?: RealmType;
}

export type AudienceFilter = EmailAudienceFilter | GameMailAudienceFilter;

export interface BroadcastRecipientSeed {
  recipientType: RecipientType;
  recipientKey: string;
  metadata?: Record<string, unknown>;
}

export interface RecipientResolveResult {
  totalCount: number;
  recipients: BroadcastRecipientSeed[];
  sampleRecipients: BroadcastRecipientSeed[];
}
