import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBodyParseError } from '../http/json-body.js';

// Auto commands parse inputs before their route-local service catch block.
export const AutoErrors = apiErrorFilter((error) => {
  if (error instanceof JsonBodyParseError) return undefined;
  return Response.json(
    { error: error instanceof Error ? error.message : '自动指令提交失败' },
    { status: 409 },
  );
});
