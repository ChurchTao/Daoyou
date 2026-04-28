# Affix Text Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make affix `listenerText` and `conditionText` render precise Chinese descriptions based on `eventType`, `ListenerScope`, and condition scope without changing battle runtime behavior.

**Architecture:** Keep the change inside `engine/battle-v5/effects/affixText`. Add a small display-only render context, pass it from `buildBodyText` into the listener and condition formatters, and update formatter logic to derive the correct subject from event/scope combinations. Drive the change with focused renderer tests built around existing affix definitions.

**Tech Stack:** TypeScript, Jest, battle-v5 affix renderer

---

### Task 1: Lock the expected text with failing renderer tests

**Files:**
- Modify: `engine/battle-v5/tests/effects/AffixRenderer.test.ts`
- Reference: `engine/creation-v2/affixes/definitions/artifactAffixes.ts`
- Reference: `engine/creation-v2/affixes/definitions/skillAffixes.ts`

- [ ] **Step 1: Write the failing test for target-side DamageTakenEvent wording**

```ts
it('"混元" 在 DamageTakenEvent + owner_as_target 下保持受击主语', () => {
  const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-defense-crit-reflect');
  const line = renderAffixLine(toRolledAffix(def!), '真品');

  expect(line.bodyText).toContain('受击后');
  expect(line.bodyText).toContain('被暴击时');
  expect(line.bodyText).toMatch(/反弹\s*34%\s*伤害/);
});
```

- [ ] **Step 2: Write the failing test for caster-side DamageTakenEvent wording**

```ts
it('"噬血" 在 DamageTakenEvent + owner_as_caster 下使用自身主语', () => {
  const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-variant-heal-on-cast');
  const line = renderAffixLine(toRolledAffix(def!), '真品');

  expect(line.bodyText).toContain('造成伤害后');
  expect(line.bodyText).toContain('吸取');
  expect(line.bodyText).not.toContain('受击');
});
```

- [ ] **Step 3: Write the failing test for condition scope differences**

```ts
it('自定义词缀在 caster/target 条件 scope 下渲染不同主语', () => {
  const base = DEFAULT_AFFIX_REGISTRY.queryById('skill-variant-damage-boost');
  const casterScoped = renderAffixLine(
    toRolledAffix(base!, {
      id: 'test-caster-hp-boost',
      effectTemplate: {
        ...base!.effectTemplate,
        conditions: [{ type: 'hp_below', params: { value: 0.3, scope: 'caster' } }],
      },
    }),
    '真品',
  );
  const targetScoped = renderAffixLine(
    toRolledAffix(base!, {
      id: 'test-target-hp-boost',
      effectTemplate: {
        ...base!.effectTemplate,
        conditions: [{ type: 'hp_below', params: { value: 0.3, scope: 'target' } }],
      },
    }),
    '真品',
  );

  expect(casterScoped.bodyText).toContain('自身气血低于30%');
  expect(targetScoped.bodyText).toContain('目标气血低于30%');
});
```

- [ ] **Step 4: Run renderer tests to verify they fail for the expected wording**

Run: `npm test -- engine/battle-v5/tests/effects/AffixRenderer.test.ts --runInBand`

Expected: FAIL because listener and condition text still render old wording such as `受击时` / `气血低于30%`.

### Task 2: Add display-only render context plumbing

**Files:**
- Modify: `engine/battle-v5/effects/affixText/index.ts`
- Create or Modify: `engine/battle-v5/effects/affixText/listeners.ts`
- Create or Modify: `engine/battle-v5/effects/affixText/conditions.ts`

- [ ] **Step 1: Add a local render context type and pass it through buildBodyText**

```ts
interface AffixTextRenderContext {
  eventType?: string;
  listenerScope?: ListenerScope;
}

const renderContext: AffixTextRenderContext | undefined = listenerSpec
  ? {
      eventType: listenerSpec.eventType,
      listenerScope: listenerSpec.scope,
    }
  : undefined;

const listenerText = describeListener(listenerSpec, renderContext);
const conditionText = describeConditions(effect.conditions, renderContext);
```

- [ ] **Step 2: Run the renderer test to ensure it still fails only on wording**

Run: `npm test -- engine/battle-v5/tests/effects/AffixRenderer.test.ts --runInBand`

Expected: FAIL with the same assertion mismatch, proving the wiring alone does not change behavior.

### Task 3: Implement scope-aware listener and condition wording

**Files:**
- Modify: `engine/battle-v5/effects/affixText/listeners.ts`
- Modify: `engine/battle-v5/effects/affixText/conditions.ts`
- Reference: `engine/battle-v5/core/configs.ts`

- [ ] **Step 1: Implement DamageTakenEvent listener wording by scope**

```ts
function describeDamageTakenListener(scope?: ListenerScope): string {
  switch (scope) {
    case 'owner_as_caster':
      return '造成伤害后';
    case 'owner_as_actor':
      return '伤害结算后';
    case 'owner_as_target':
    default:
      return '受击后';
  }
}
```

- [ ] **Step 2: Implement condition subject resolution for caster/target wording**

```ts
function resolveConditionSubject(
  condScope: 'caster' | 'target' | undefined,
  context?: AffixTextRenderContext,
): 'self' | 'target' {
  if (condScope === 'caster') return 'self';
  if (condScope === 'target') {
    return context?.listenerScope === 'owner_as_target' ? 'self' : 'target';
  }
  return context?.listenerScope === 'owner_as_target' ? 'self' : 'target';
}
```

- [ ] **Step 3: Update concrete condition phrases**

```ts
case 'is_critical':
  return context?.listenerScope === 'owner_as_caster' ? '暴击时' : '被暴击时';
case 'hp_below':
  return prefixSubject(resolveConditionSubject(params.scope, context), '气血低于30%');
case 'ability_has_tag':
  return context?.listenerScope === 'owner_as_caster'
    ? `造成「${tagLabel(params.tag)}」伤害时`
    : `受到「${tagLabel(params.tag)}」伤害时`;
```

- [ ] **Step 4: Run the renderer tests to verify the new wording passes**

Run: `npm test -- engine/battle-v5/tests/effects/AffixRenderer.test.ts --runInBand`

Expected: PASS

### Task 4: Regression verification

**Files:**
- Modify: none if tests are already green

- [ ] **Step 1: Run the focused renderer suite again for fresh evidence**

Run: `npm test -- engine/battle-v5/tests/effects/AffixRenderer.test.ts --runInBand`

Expected: PASS with all renderer tests green.

- [ ] **Step 2: Run one broader battle-v5 integration slice that exercises affix visuals**

Run: `npm test -- engine/battle-v5/tests/integration/EffectVisualValidation.test.ts --runInBand`

Expected: PASS

- [ ] **Step 3: Commit the implementation once verification is green**

```bash
git add engine/battle-v5/effects/affixText/index.ts \
        engine/battle-v5/effects/affixText/listeners.ts \
        engine/battle-v5/effects/affixText/conditions.ts \
        engine/battle-v5/tests/effects/AffixRenderer.test.ts \
        docs/superpowers/plans/2026-04-28-affix-text-context.md
git commit -m "fix: refine affix text listener and condition wording"
```
