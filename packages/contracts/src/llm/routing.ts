import {
  LLM_PROVIDER_DEFAULT_MODELS,
  LLM_PROVIDER_IDS,
  LlmProviderIdSchema,
  type LlmProviderId,
} from './config.js';

export type LlmRouteSpec = {
  provider: LlmProviderId;
  model?: string;
  weight: number;
};

export type LlmRoute = {
  provider: LlmProviderId;
  model: string;
  weight: number;
};

export type LlmRoutingInput = {
  providerSpec?: string;
  availableProviders: Partial<Record<LlmProviderId, boolean>>;
  /** 出错信息中引用的环境变量名。 */
  envName?: string;
};

/** 基础模型组承担日常调用；高级模型组用于需要更强推理与一致性的场景。 */
export const LLM_MODEL_TIERS = ['basic', 'advanced'] as const;

export type LlmModelTier = (typeof LLM_MODEL_TIERS)[number];

export const LLM_TIER_ENV_NAMES: Record<LlmModelTier, string> = {
  basic: 'LLM_PROVIDER',
  advanced: 'LLM_ADVANCED_PROVIDER',
};

const ROUTE_ENTRY = /^([a-z][a-z0-9_]*)(?:\/([^:,\s]+))?(?::(\d+))?$/i;
const AUTO_DETECT_ORDER: readonly LlmProviderId[] = ['alibaba', 'deepseek'];

function hashUserId(userId: string): number {
  let hash = 2166136261;
  for (const char of userId) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function llmRouteKey(
  route: Pick<LlmRoute, 'provider' | 'model'>,
): string {
  return `${route.provider}/${route.model}`;
}

function compareRoutes(
  left: Pick<LlmRoute, 'provider' | 'model'>,
  right: Pick<LlmRoute, 'provider' | 'model'>,
): number {
  return (
    left.provider.localeCompare(right.provider) ||
    left.model.localeCompare(right.model)
  );
}

function sortRoutes(routes: readonly LlmRoute[]): LlmRoute[] {
  return [...routes].sort(compareRoutes);
}

function invalidSpecError(envName: string): Error {
  return new Error(
    `Invalid ${envName}. Expected provider[/model][:weight], e.g. "alibaba/qwen3.7-flash:70,deepseek/deepseek-v4-flash:30".`,
  );
}

export function parseLlmRouteSpec(
  raw: string,
  envName = LLM_TIER_ENV_NAMES.basic,
): LlmRouteSpec[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw invalidSpecError(envName);
  }

  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw invalidSpecError(envName);
  }

  const seen = new Set<string>();
  const routes: LlmRouteSpec[] = [];

  for (const part of parts) {
    const match = part.match(ROUTE_ENTRY);
    if (!match) {
      throw new Error(
        `Invalid ${envName} entry "${part}". Expected provider[/model][:weight].`,
      );
    }

    const parsedId = LlmProviderIdSchema.safeParse(match[1]);
    if (!parsedId.success) {
      throw new Error(
        `Invalid ${envName} "${match[1]}". Expected one of: ${LLM_PROVIDER_IDS.join(', ')}`,
      );
    }

    const model = match[2] || undefined;
    const identity = `${parsedId.data}/${model ?? ''}`;
    if (seen.has(identity)) {
      throw new Error(
        `Duplicate ${envName} entry "${model ? `${parsedId.data}/${model}` : parsedId.data}".`,
      );
    }
    seen.add(identity);

    const weight = match[3] === undefined ? 1 : Number(match[3]);
    if (!Number.isInteger(weight) || weight <= 0) {
      throw new Error(
        `Invalid weight for "${part}". Expected a positive integer.`,
      );
    }

    routes.push({
      provider: parsedId.data,
      ...(model ? { model } : {}),
      weight,
    });
  }

  return routes;
}

function autoDetectRouteSpec(
  availableProviders: Partial<Record<LlmProviderId, boolean>>,
): LlmRouteSpec[] {
  for (const provider of AUTO_DETECT_ORDER) {
    if (availableProviders[provider]) {
      return [{ provider, weight: 1 }];
    }
  }

  throw new Error(
    'No LLM provider configured. Set ALIBABA_API_KEY or DEEPSEEK_API_KEY (or LLM_PROVIDER).',
  );
}

export function resolveLlmRouteModels(
  routes: readonly LlmRouteSpec[],
  envName = LLM_TIER_ENV_NAMES.basic,
): LlmRoute[] {
  if (routes.length === 0) {
    throw new Error('No LLM routes to resolve.');
  }

  const resolved = routes.map((route) => ({
    provider: route.provider,
    model: route.model ?? LLM_PROVIDER_DEFAULT_MODELS[route.provider],
    weight: route.weight,
  }));

  const seen = new Set<string>();
  for (const route of resolved) {
    const key = llmRouteKey(route);
    if (seen.has(key)) {
      throw new Error(`Duplicate ${envName} route "${key}".`);
    }
    seen.add(key);
  }

  return resolved;
}

export function resolveServerLlmRoutes(input: LlmRoutingInput): LlmRoute[] {
  const envName = input.envName ?? LLM_TIER_ENV_NAMES.basic;
  const specs = input.providerSpec?.trim()
    ? parseLlmRouteSpec(input.providerSpec, envName)
    : autoDetectRouteSpec(input.availableProviders);

  for (const spec of specs) {
    if (!input.availableProviders[spec.provider]) {
      throw new Error(
        `${envName} includes "${spec.provider}" but its API key is not set.`,
      );
    }
  }

  return resolveLlmRouteModels(specs, envName);
}

/**
 * 解析指定模型组的路由。高级组格式与基础组相同；未配置时沿用基础组，
 * 这样未部署高级模型的环境不受影响。只解析所需的一组，高级组配置有误
 * 不会波及基础组场景。
 */
export function resolveServerLlmTierRoutes(
  input: {
    basicSpec?: string;
    advancedSpec?: string;
    availableProviders: Partial<Record<LlmProviderId, boolean>>;
  },
  tier: LlmModelTier,
): LlmRoute[] {
  if (tier === 'advanced' && input.advancedSpec?.trim()) {
    return resolveServerLlmRoutes({
      providerSpec: input.advancedSpec,
      availableProviders: input.availableProviders,
      envName: LLM_TIER_ENV_NAMES.advanced,
    });
  }
  return resolveServerLlmRoutes({
    providerSpec: input.basicSpec,
    availableProviders: input.availableProviders,
  });
}

export function pickLlmRouteByUserHash(
  routes: readonly LlmRoute[],
  userId: string,
): LlmRoute {
  if (routes.length === 0) {
    throw new Error('No LLM routes to pick from.');
  }
  if (!userId) {
    throw new Error('userId is required for weighted LLM routing.');
  }
  if (routes.length === 1) {
    return routes[0];
  }

  const ordered = sortRoutes(routes);
  const totalWeight = ordered.reduce((sum, route) => sum + route.weight, 0);
  const bucket = hashUserId(userId) % totalWeight;

  let cursor = 0;
  for (const route of ordered) {
    cursor += route.weight;
    if (bucket < cursor) {
      return route;
    }
  }

  return ordered[ordered.length - 1];
}

export function pickHighestWeightLlmRoute(
  routes: readonly LlmRoute[],
): LlmRoute {
  if (routes.length === 0) {
    throw new Error('No LLM routes to pick from.');
  }

  return sortRoutes(routes).reduce((best, current) =>
    current.weight > best.weight ? current : best,
  );
}
