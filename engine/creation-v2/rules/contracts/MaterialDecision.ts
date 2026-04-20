import { RuleDecisionMeta } from '../core';

export interface MaterialDecision extends RuleDecisionMeta {
  valid: boolean;
  normalizedTags: string[];
  dominantTags: string[];
  recipeTags: string[];
  notes: string[];
}