import type { TemplateVariableMap } from '@/types/admin-broadcast';

const VARIABLE_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function extractTemplateVariables(template: string): string[] {
  const vars = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = VARIABLE_PATTERN.exec(template)) !== null) {
    vars.add(match[1]);
  }

  return [...vars];
}

export function renderTemplate(
  template: string,
  variables: TemplateVariableMap,
): string {
  const needed = extractTemplateVariables(template);
  const missing = needed.filter((key) => variables[key] === undefined);

  if (missing.length > 0) {
    throw new Error(`模板变量缺失: ${missing.join(', ')}`);
  }

  return template.replace(VARIABLE_PATTERN, (_, key: string) =>
    String(variables[key]),
  );
}

export function normalizeTemplatePayload(
  defaultPayload: unknown,
  payload: unknown,
): TemplateVariableMap {
  const base =
    defaultPayload && typeof defaultPayload === 'object'
      ? (defaultPayload as Record<string, unknown>)
      : {};
  const input =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {};

  const merged = { ...base, ...input };
  const result: TemplateVariableMap = {};

  for (const [key, value] of Object.entries(merged)) {
    if (typeof value === 'string' || typeof value === 'number') {
      result[key] = value;
    }
  }

  return result;
}
