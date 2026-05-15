export class AlchemyServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = 'AlchemyServiceError';
  }
}
