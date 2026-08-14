import postgres from 'postgres';
import {
  normalizeAlchemyEffectRoute,
  validateAlchemyEffectRoute,
} from '../src/shared/lib/alchemyEffectResolver';
import type {
  AlchemyEffectKey,
  AlchemyFormulaBlueprint,
} from '../src/shared/types/consumable';

type FormulaRow = {
  id: string;
  pattern: unknown;
  blueprint: unknown;
};

const LEGACY_KEY_MAP: Record<string, string> = {
  tempering_vitality: 'body_qi_blood',
  tempering_spirit: 'body_organs',
  tempering_wisdom: 'body_primordial_spirit',
  tempering_speed: 'body_skin',
  tempering_willpower: 'body_sinew_bone',
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const sql = postgres(databaseUrl);
const dryRun = process.argv.includes('--dry-run');

function routeFromPattern(pattern: Record<string, unknown>) {
  const raw = Array.isArray(pattern.targetPropertyVector)
    ? pattern.targetPropertyVector
    : [];
  const merged = new Map<string, number>();
  for (const item of raw) {
    const value = item as Record<string, unknown>;
    const key = LEGACY_KEY_MAP[String(value.key)] ?? value.key;
    const weight = Number(value.weight);
    if (typeof key !== 'string' || !Number.isFinite(weight) || weight <= 0)
      continue;
    merged.set(key, (merged.get(key) ?? 0) + weight);
  }
  const route = normalizeAlchemyEffectRoute({
    effects: [...merged.entries()].map(([key, weight]) => ({
      key: key as AlchemyEffectKey,
      weight,
    })),
  });
  if (route.effects.length > 0) validateAlchemyEffectRoute(route);
  return route.effects;
}

function buildBlueprintV4(
  pattern: Record<string, unknown>,
  blueprint: Record<string, unknown>,
): AlchemyFormulaBlueprint {
  const effects = routeFromPattern(pattern);
  const consumeRules = blueprint.consumeRules as
    AlchemyFormulaBlueprint['consumeRules'] | undefined;
  return {
    version: 4,
    route: { effects },
    needsRebirth: effects.length === 0 ? true : undefined,
    consumeRules: consumeRules ?? {
      scene: 'out_of_battle_only',
      quotaCategory: 'none',
    },
    targetStability: Number(blueprint.targetStability ?? 60),
    targetToxicity: Number(blueprint.targetToxicity ?? 0),
  };
}

function needsUpgrade(
  blueprint: Record<string, unknown>,
  nextBlueprint: AlchemyFormulaBlueprint,
): boolean {
  return (
    blueprint.version !== 4 ||
    Object.prototype.hasOwnProperty.call(blueprint, 'operations') ||
    JSON.stringify(blueprint.route) !== JSON.stringify(nextBlueprint.route) ||
    (blueprint.needsRebirth === true) !== (nextBlueprint.needsRebirth === true)
  );
}

const rows = await sql<FormulaRow[]>`
  SELECT id, pattern, blueprint
  FROM wanjiedaoyou_alchemy_formulas
  ORDER BY created_at, id
`;

let upgraded = 0;
let skipped = 0;
const preview: Array<{
  id: string;
  routeCount: number;
  needsRebirth: boolean;
}> = [];
const updates: Record<string, AlchemyFormulaBlueprint> = {};

for (const row of rows) {
  const pattern = (
    typeof row.pattern === 'string' ? JSON.parse(row.pattern) : row.pattern
  ) as Record<string, unknown>;
  const blueprint = (
    typeof row.blueprint === 'string'
      ? JSON.parse(row.blueprint)
      : row.blueprint
  ) as Record<string, unknown>;
  const nextBlueprint = buildBlueprintV4(pattern, blueprint);
  if (!needsUpgrade(blueprint, nextBlueprint)) continue;
  updates[row.id] = nextBlueprint;
  const needsRebirth = nextBlueprint.needsRebirth === true;
  preview.push({
    id: row.id,
    routeCount: nextBlueprint.route.effects.length,
    needsRebirth,
  });
  if (needsRebirth) skipped += 1;
  else upgraded += 1;
}

try {
  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          total: rows.length,
          upgraded,
          needsRebirth: skipped,
          preview,
        },
        null,
        2,
      ),
    );
  } else {
    await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS wanjiedaoyou_alchemy_formula_v3_backup (
          migration_id uuid NOT NULL,
          formula_id uuid NOT NULL,
          pattern jsonb NOT NULL,
          blueprint jsonb NOT NULL,
          backed_up_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (migration_id, formula_id)
        )
      `);
    await sql.begin(async (transaction) => {
      const migrationId = crypto.randomUUID();
      await transaction.unsafe(
        `INSERT INTO wanjiedaoyou_alchemy_formula_v3_backup (migration_id, formula_id, pattern, blueprint)
           SELECT $1, id, pattern, blueprint FROM wanjiedaoyou_alchemy_formulas`,
        [migrationId],
      );
      if (Object.keys(updates).length === 0) return;
      await transaction.unsafe(
        `UPDATE wanjiedaoyou_alchemy_formulas AS f
           SET blueprint = u.blueprint, updated_at = now()
           FROM jsonb_each($1::text::jsonb) AS u(id, blueprint)
           WHERE f.id = u.id::uuid`,
        [JSON.stringify(updates)],
      );
    });
    console.log(
      JSON.stringify({
        dryRun: false,
        total: rows.length,
        upgraded,
        needsRebirth: skipped,
      }),
    );
  }
} finally {
  await sql.end();
}
