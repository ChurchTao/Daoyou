import {
  extractTemplateVariables,
  renderTemplate,
} from '@server/lib/template/render';
import type { TemplateVariableMap } from '@shared/types/admin-broadcast';

export { extractTemplateVariables, renderTemplate };

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
