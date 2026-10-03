import {
  createParamDecorator,
  type ExecutionContext,
  type PipeTransform,
  type Type,
} from '@nestjs/common';
import type { Request } from 'express';
import getRawBody from 'raw-body';

/** Preserve the former Bun server's 128 MiB ceiling without inflating bodies. */
export async function readRequestBody(
  request: Request,
  limit = 128 * 1_024 * 1_024,
): Promise<Buffer> {
  request.body ??= await getRawBody(request, {
    length: request.headers['content-length'],
    limit,
  });
  return request.body;
}

export class JsonBodyParseError extends SyntaxError {
  constructor(error: SyntaxError) {
    super(error.message, { cause: error });
  }
}

type JsonBodyOptions = { fallback: unknown };

const RequestBody = createParamDecorator(
  (_data: undefined, context: ExecutionContext): Request =>
    context.switchToHttp().getRequest<Request>(),
);

class JsonBodyPipe implements PipeTransform<Request, Promise<unknown>> {
  constructor(private readonly options?: JsonBodyOptions) {}

  async transform(request: Request): Promise<unknown> {
    const body = await readRequestBody(request);
    try {
      return JSON.parse(new TextDecoder().decode(body));
    } catch (error) {
      if (this.options) return this.options.fallback;
      if (error instanceof SyntaxError) throw new JsonBodyParseError(error);
      throw error;
    }
  }
}

/** Nest awaits pipes, but not a custom parameter factory before its first pipe. */
export function JsonBody(
  optionsOrPipe?: JsonBodyOptions | PipeTransform | Type<PipeTransform>,
  ...pipes: (PipeTransform | Type<PipeTransform>)[]
): ParameterDecorator {
  if (optionsOrPipe && 'fallback' in optionsOrPipe) {
    return RequestBody(undefined, new JsonBodyPipe(optionsOrPipe), ...pipes);
  }
  return RequestBody(
    undefined,
    new JsonBodyPipe(),
    ...(optionsOrPipe ? [optionsOrPipe] : []),
    ...pipes,
  );
}
