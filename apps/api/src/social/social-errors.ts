import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBodyParseError } from '../http/json-body.js';

export function socialValidationIssues(error: unknown): unknown[] | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('name' in error) ||
    error.name !== 'ZodError' ||
    !('issues' in error) ||
    !Array.isArray(error.issues)
  )
    return null;
  return error.issues;
}

export const socialErrors = apiErrorFilter((error) => {
  const issues = socialValidationIssues(error);
  if (issues)
    return Response.json(
      { error: '参数错误', details: issues },
      { status: 400 },
    );
  if (error instanceof JsonBodyParseError)
    return Response.json({ error: '无效的 JSON 请求' }, { status: 400 });
  return undefined;
});
