export interface ValidationRule<T> {
  validate(value: T): void;
}

/** 按固定顺序组合独立规则，保证错误首先落在最接近根因的边界。 */
export class ValidationPipeline<T> {
  constructor(private readonly rules: readonly ValidationRule<T>[]) {}

  validate(value: T): void {
    for (const rule of this.rules) rule.validate(value);
  }
}
