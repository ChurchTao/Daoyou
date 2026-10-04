export class AlchemyServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AlchemyServiceError';
  }
}
