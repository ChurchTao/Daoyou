/*
 * Rule: 单条规则接口定义。
 * 每个 Rule 在 RuleContext 上运行，可修改 Decision、添加 reasons/warnings/trace。
 */
import { RuleContext } from './RuleContext';
import { RuleDecisionMeta } from './types';

export interface Rule<TFacts, TDecision extends RuleDecisionMeta> {
  readonly id: string;
  apply(context: RuleContext<TFacts, TDecision>): void;
}