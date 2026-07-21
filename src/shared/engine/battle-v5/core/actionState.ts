export type ActionStateType = 'rest' | 'queued_action' | 'ability_mode';
export type ActionStatePhase = 'entered' | 'triggered' | 'cancelled' | 'skipped';
export type ActionInterruptPolicy = 'normal' | 'uninterruptible';
export type ActionHitPolicy = 'normal' | 'guaranteed';

export interface ActionStateAbilityView {
  id: string;
  name: string;
}

export interface ActionStateView {
  type: ActionStateType;
  name: string;
  remainingActions: number;
  sourceAbility?: ActionStateAbilityView;
  ability?: ActionStateAbilityView;
  interruptPolicy?: ActionInterruptPolicy;
  hitPolicy?: ActionHitPolicy;
}
