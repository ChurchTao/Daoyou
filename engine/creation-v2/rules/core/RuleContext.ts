/*
 * RuleContext: 规则执行时的上下文结构。
 * 包含只读的 facts、可变的 decision、用于收集诊断信息的 diagnostics，以及可选 metadata（如 phase/sessionId）。
 */

import { RuleDecisionMeta } from './types';

export interface RuleContextMetadata {
  phase?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface RuleContext<
  TFacts,
  TDecision extends RuleDecisionMeta,
> {
  facts: TFacts;
  decision: TDecision;
  metadata: RuleContextMetadata;
}