import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

function decodeQuery(value: string): string {
  const spaced = value.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(spaced);
  } catch {
    // Preserve malformed UTF-8 escapes while decoding separate valid runs.
    return spaced.replace(/(?:%[\da-f]{2})+/gi, (run) => {
      try {
        return decodeURIComponent(run);
      } catch {
        return run;
      }
    });
  }
}

/** Preserve Hono's first-value semantics for query objects and named values. */
export const FirstQuery = createParamDecorator(
  (key: string | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();
    const url = request.originalUrl.split('#', 1)[0];
    const start = url.indexOf('?');
    const fields = start === -1 ? [] : url.slice(start + 1).split('&');
    const values: Record<string, string> = Object.create(null);
    for (const field of fields) {
      const separator = field.indexOf('=');
      const name = separator === -1 ? field : field.slice(0, separator);
      const value = separator === -1 ? '' : field.slice(separator + 1);
      // Named Hono queries prefer a literal key over earlier encoded aliases.
      if (key && !/[%+]/.test(key) && name === key) return decodeQuery(value);
      const decodedName = decodeQuery(name);
      if (decodedName) values[decodedName] ??= decodeQuery(value);
    }
    return key ? values[key] : values;
  },
);
