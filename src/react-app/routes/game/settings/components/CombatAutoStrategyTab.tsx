import { InkButton } from '@app/components/ui/InkButton';
import { autoStatusChoices } from '@shared/combat-v6/auto-status-options';
import {
  autoComparison,
  MAX_AUTO_STRATEGY_RULES,
  SaveAutoStrategySchema,
  type AutoComparison,
  type AutoStrategy,
} from '@shared/combat-v6/auto-strategy';
import { useEffect, useState } from 'react';
import { SettingsMessage } from './SettingsFields';

type Rule = AutoStrategy['rules'][number];
type Condition = Rule['conditions'][number];
type View = {
  pathId: string;
  pathName: string;
  defaultStrategy: AutoStrategy;
  customStrategy: AutoStrategy | null;
  availableSkills: { id: string; name: string }[];
  availableResources: { id: string; name: string }[];
  skillNames: Record<string, string>;
};

const conditionChoices: { value: Condition['type']; label: string }[] = [
  { value: 'selfHpBelow', label: '自身气血' },
  { value: 'allyHpBelow', label: '任一己方气血' },
  { value: 'targetHpBelow', label: '出招目标气血' },
  { value: 'enemyHpBelow', label: '敌方气血' },
  { value: 'allyDowned', label: '有队友倒地' },
  { value: 'enemyCountAtLeast', label: '存活敌人' },
  { value: 'selfResourceAtLeast', label: '自身资源' },
  { value: 'selfStatus', label: '自身状态' },
  { value: 'targetStatus', label: '出招目标状态' },
  { value: 'allyStatus', label: '己方状态' },
];
const comparisonChoices: { value: AutoComparison; label: string }[] = [
  { value: 'lt', label: '低于' },
  { value: 'lte', label: '至多' },
  { value: 'gt', label: '大于' },
  { value: 'gte', label: '至少' },
];
const comparisonLabel = (condition: Condition) =>
  comparisonChoices.find(
    (choice) => choice.value === autoComparison(condition),
  )!.label;
const targetChoices: { value: Rule['target']; label: string }[] = [
  { value: 'best', label: '收益最高' },
  { value: 'lowestHpEnemy', label: '最低血敌人' },
  { value: 'lowestHpAlly', label: '最低血己方' },
];
const targetScopeChoices: {
  value: NonNullable<Rule['targetScope']>;
  label: string;
}[] = [
  { value: 'any', label: '不限制' },
  { value: 'allyPet', label: '己方灵兽' },
  { value: 'ownPet', label: '自己的灵兽' },
  { value: 'teammatePlayer', label: '其他队友人物' },
];
const fieldClass =
  'border-ink/20 bg-paper/70 text-ink focus:border-crimson min-h-9 min-w-0 border px-2 py-1.5 text-sm outline-none';

function newCondition(
  type: Condition['type'],
  resourceId = '',
  statuses: ReturnType<typeof autoStatusChoices> = { self: [], target: [] },
): Condition {
  if (type === 'allyDowned') return { type };
  if (type === 'enemyCountAtLeast') return { type, count: 2 };
  if (type === 'selfResourceAtLeast') return { type, resourceId, amount: 1 };
  if (type === 'selfStatus')
    return { type, kind: statuses.self[0]?.kind ?? '', present: false };
  if (type === 'targetStatus' || type === 'allyStatus') {
    const first =
      type === 'allyStatus'
        ? statuses.target.find((choice) => choice.side === 'ally')
        : statuses.target[0];
    return {
      type,
      kind: first?.kind ?? '',
      statusId: first?.statusId,
      ownedBySelf: first?.ownedBySelf ?? false,
      present: false,
    };
  }
  return { type, percent: 50 };
}

const statusKey = (kind: string, statusId?: string) =>
  `${kind}|${statusId ?? ''}`;

function skillName(view: View, id: string) {
  return (
    view.availableSkills.find((skill) => skill.id === id)?.name ??
    view.skillNames[id] ??
    '未知招式'
  );
}

function actionName(view: View, action: Rule['action']) {
  if (action.type === 'attack') return '普通攻击';
  if (action.type === 'defend') return '防御';
  return skillName(view, action.skillId);
}

function conditionName(view: View, condition: Condition) {
  switch (condition.type) {
    case 'selfHpBelow':
      return `自身气血${comparisonLabel(condition)} ${condition.percent}%`;
    case 'allyHpBelow':
      return `任一己方气血${comparisonLabel(condition)} ${condition.percent}%`;
    case 'targetHpBelow':
      return `目标气血${comparisonLabel(condition)} ${condition.percent}%`;
    case 'enemyHpBelow':
      return `敌方气血${comparisonLabel(condition)} ${condition.percent}%`;
    case 'allyDowned':
      return '有队友倒地';
    case 'enemyCountAtLeast':
      return `存活敌人${comparisonLabel(condition)} ${condition.count} 名`;
    case 'selfResourceAtLeast':
      return `${view.availableResources.find((item) => item.id === condition.resourceId)?.name ?? '战斗资源'}${comparisonLabel(condition)} ${condition.amount}`;
    case 'selfStatus': {
      const choice = autoStatusChoices(view.pathId).self.find(
        (item) =>
          item.kind === condition.kind && item.statusId === condition.statusId,
      );
      return `自身${condition.present ? '有' : '无'}${choice?.label ?? '指定状态'}`;
    }
    case 'targetStatus': {
      const choice = autoStatusChoices(view.pathId).target.find(
        (item) =>
          item.kind === condition.kind &&
          item.statusId === condition.statusId &&
          item.ownedBySelf === condition.ownedBySelf,
      );
      return `目标${condition.present ? '有' : '无'}${choice?.label ?? '指定状态'}`;
    }
    case 'allyStatus': {
      const choice = autoStatusChoices(view.pathId).target.find(
        (item) =>
          item.side === 'ally' &&
          item.kind === condition.kind &&
          item.statusId === condition.statusId &&
          item.ownedBySelf === condition.ownedBySelf,
      );
      return `己方${condition.present ? '已有' : '无人持有'}${choice?.label ?? '指定状态'}`;
    }
  }
}

async function request(
  method: 'GET' | 'PUT' | 'DELETE',
  body?: unknown,
): Promise<View> {
  const response = await fetch('/api/combat-v6/auto-strategy', {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  const payload = (await response.json()) as {
    success?: boolean;
    error?: string;
    data?: View;
  };
  if (!response.ok || !payload.success || !payload.data)
    throw new Error(payload.error ?? `暂时无法${method === 'GET' ? '读取' : '保存'}自动战术，请稍后重试。`);
  return payload.data;
}

export function CombatAutoStrategyTab() {
  const [view, setView] = useState<View | null>(null);
  const [draft, setDraft] = useState<AutoStrategy | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void request('GET')
      .then((loaded) => {
        if (!active) return;
        setView(loaded);
        setDraft(
          structuredClone(loaded.customStrategy ?? loaded.defaultStrategy),
        );
      })
      .catch((error: unknown) => {
        if (active)
          setMessage(error instanceof Error ? error.message : '读取失败');
      });
    return () => {
      active = false;
    };
  }, []);

  const replaceRule = (index: number, rule: Rule) =>
    setDraft(
      (current) =>
        current && {
          ...current,
          rules: current.rules.map((item, at) => (at === index ? rule : item)),
        },
    );
  const moveRule = (index: number, direction: -1 | 1) => {
    if (!draft) return;
    const next = [...draft.rules];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setDraft({ ...draft, rules: next });
    setEditingIndex(index + direction);
  };
  const save = async () => {
    if (!view || !draft) return;
    if (draft.rules.length > MAX_AUTO_STRATEGY_RULES) {
      setMessage(`最多保留 ${MAX_AUTO_STRATEGY_RULES} 条战术，请删减后保存`);
      return;
    }
    const parsed = SaveAutoStrategySchema.safeParse(draft);
    if (!parsed.success) {
      setMessage('请检查战术条件中的数值和资源');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const next = await request('PUT', {
        pathId: view.pathId,
        strategy: parsed.data,
      });
      setView(next);
      setDraft(structuredClone(parsed.data));
      setEditingIndex(null);
      setMessage('战术已保存，从下一场战斗生效。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!view) return;
    setBusy(true);
    setMessage(null);
    try {
      const next = await request('DELETE', { pathId: view.pathId });
      setView(next);
      setDraft(structuredClone(next.defaultStrategy));
      setEditingIndex(null);
      setMessage('已恢复流派战术，从下一场战斗生效。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '恢复失败');
    } finally {
      setBusy(false);
    }
  };

  if (!view || !draft)
    return <SettingsMessage>{message ?? '正在读取自动战术…'}</SettingsMessage>;

  const saved = view.customStrategy ?? view.defaultStrategy;
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const learned = new Set(view.availableSkills.map((skill) => skill.id));
  const statusChoices = autoStatusChoices(view.pathId);
  return (
    <div className="text-ink space-y-4">
      <div className="border-ink/15 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <p className="text-ink-secondary text-xs tracking-[0.16em]">
            {view.pathName} · 自动战术
          </p>
          <p className="mt-1 text-sm leading-6">
            按顺序出招。条件不符或招式不可用时，尝试下一条。
          </p>
        </div>
        <span className="border-crimson/30 bg-crimson/6 text-crimson border px-2 py-1 text-xs">
          {view.customStrategy ? '自定战术' : '流派战术'}
        </span>
      </div>

      <ol className="border-ink/15 border-b">
        {draft.rules.map((rule, index) => {
          const editing = editingIndex === index;
          const targetStatusChoices =
            rule.action.type === 'defend'
              ? []
              : rule.action.type === 'attack'
                ? statusChoices.target.filter(
                    (choice) => choice.side === 'enemy',
                  )
                : statusChoices.target;
          const allyStatusChoices = statusChoices.target.filter(
            (choice) => choice.side === 'ally',
          );
          const unavailable =
            rule.action.type === 'skill' && !learned.has(rule.action.skillId);
          return (
            <li key={index} className="border-ink/10 border-b last:border-b-0">
              <button
                type="button"
                className={`hover:bg-ink/5 focus-visible:outline-crimson flex w-full items-start gap-3 px-2 py-3 text-left transition-colors focus-visible:outline-2 sm:px-3 ${editing ? 'bg-ink/5' : ''}`}
                aria-expanded={editing}
                onClick={() => setEditingIndex(editing ? null : index)}
              >
                <span className="text-crimson min-w-7 pt-0.5 font-mono text-sm">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="text-ink-secondary block text-xs leading-5">
                    {rule.conditions.length
                      ? rule.conditions
                          .map((condition) => conditionName(view, condition))
                          .join(' · ')
                      : '随时出招'}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    <strong className="font-semibold">
                      {actionName(view, rule.action)}
                    </strong>
                    {unavailable ? (
                      <span className="text-ink-secondary text-xs">未习得</span>
                    ) : null}
                    <span className="text-ink-secondary text-xs">
                      {targetChoices.find(
                        (target) => target.value === rule.target,
                      )?.label ?? '收益最高'}
                      {rule.targetScope && rule.targetScope !== 'any'
                        ? ` · ${targetScopeChoices.find((scope) => scope.value === rule.targetScope)?.label}`
                        : ''}
                    </span>
                  </span>
                </span>
                <span className="text-ink-secondary shrink-0 text-xs">
                  {editing ? '收起 ↑' : '调整 ↓'}
                </span>
              </button>

              {editing ? (
                <div className="border-crimson/35 bg-ink/[0.025] ml-2 space-y-4 border-l-2 px-3 py-3 sm:ml-3 sm:px-4">
                  <div>
                    <p className="text-ink-secondary mb-2 text-xs tracking-[0.12em]">
                      出招时机
                    </p>
                    <div className="space-y-2">
                      {rule.conditions.map((condition, at) => (
                        <div
                          key={at}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span className="text-ink-secondary w-5 text-xs">
                            {at === 0 ? '若' : '且'}
                          </span>
                          <select
                            aria-label={`第 ${index + 1} 条战术的第 ${at + 1} 个条件`}
                            className={`${fieldClass} max-w-48 flex-1`}
                            value={condition.type}
                            onChange={(event) =>
                              replaceRule(index, {
                                ...rule,
                                conditions: rule.conditions.map((item, i) =>
                                  i === at
                                    ? newCondition(
                                        event.target.value as Condition['type'],
                                        view.availableResources[0]?.id,
                                        {
                                          ...statusChoices,
                                          target:
                                            event.target.value === 'allyStatus'
                                              ? allyStatusChoices
                                              : targetStatusChoices,
                                        },
                                      )
                                    : item,
                                ),
                              })
                            }
                          >
                            {conditionChoices
                              .filter(
                                (choice) =>
                                  (choice.value !== 'selfResourceAtLeast' ||
                                    view.availableResources.length > 0) &&
                                  (choice.value !== 'selfStatus' ||
                                    statusChoices.self.length > 0) &&
                                  (choice.value !== 'targetStatus' ||
                                    targetStatusChoices.length > 0) &&
                                  (choice.value !== 'allyStatus' ||
                                    allyStatusChoices.length > 0) &&
                                  (choice.value !== 'targetHpBelow' ||
                                    rule.action.type !== 'defend'),
                              )
                              .map((choice) => (
                                <option key={choice.value} value={choice.value}>
                                  {choice.label}
                                </option>
                              ))}
                          </select>
                          {'percent' in condition ||
                          'count' in condition ||
                          'amount' in condition ? (
                            <select
                              aria-label="比较关系"
                              className={fieldClass}
                              value={autoComparison(condition)}
                              onChange={(event) =>
                                replaceRule(index, {
                                  ...rule,
                                  conditions: rule.conditions.map((item, i) =>
                                    i === at
                                      ? {
                                          ...condition,
                                          comparison: event.target
                                            .value as AutoComparison,
                                        }
                                      : item,
                                  ),
                                })
                              }
                            >
                              {comparisonChoices.map((choice) => (
                                <option key={choice.value} value={choice.value}>
                                  {choice.label}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          {'percent' in condition ? (
                            <>
                              <input
                                aria-label="气血百分比"
                                className={`${fieldClass} w-16 text-center font-mono`}
                                type="number"
                                min={1}
                                max={100}
                                value={condition.percent}
                                onChange={(event) =>
                                  replaceRule(index, {
                                    ...rule,
                                    conditions: rule.conditions.map(
                                      (item, i) =>
                                        i === at
                                          ? {
                                              ...condition,
                                              percent: Number(
                                                event.target.value,
                                              ),
                                            }
                                          : item,
                                    ),
                                  })
                                }
                              />
                              <span className="text-ink-secondary text-sm">
                                %
                              </span>
                            </>
                          ) : null}
                          {'count' in condition ? (
                            <>
                              <input
                                aria-label="敌人数量"
                                className={`${fieldClass} w-16 text-center font-mono`}
                                type="number"
                                min={1}
                                max={6}
                                value={condition.count}
                                onChange={(event) =>
                                  replaceRule(index, {
                                    ...rule,
                                    conditions: rule.conditions.map(
                                      (item, i) =>
                                        i === at
                                          ? {
                                              ...condition,
                                              count: Number(event.target.value),
                                            }
                                          : item,
                                    ),
                                  })
                                }
                              />
                              <span className="text-ink-secondary text-sm">
                                名
                              </span>
                            </>
                          ) : null}
                          {condition.type === 'selfResourceAtLeast' ? (
                            <>
                              <select
                                aria-label="战斗资源"
                                className={fieldClass}
                                value={condition.resourceId}
                                onChange={(event) =>
                                  replaceRule(index, {
                                    ...rule,
                                    conditions: rule.conditions.map(
                                      (item, i) =>
                                        i === at
                                          ? {
                                              ...condition,
                                              resourceId: event.target.value,
                                            }
                                          : item,
                                    ),
                                  })
                                }
                              >
                                {view.availableResources.map((resource) => (
                                  <option key={resource.id} value={resource.id}>
                                    {resource.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                aria-label="资源数量"
                                className={`${fieldClass} w-20 text-center font-mono`}
                                type="number"
                                min={0}
                                value={condition.amount}
                                onChange={(event) =>
                                  replaceRule(index, {
                                    ...rule,
                                    conditions: rule.conditions.map(
                                      (item, i) =>
                                        i === at
                                          ? {
                                              ...condition,
                                              amount: Number(
                                                event.target.value,
                                              ),
                                            }
                                          : item,
                                    ),
                                  })
                                }
                              />
                            </>
                          ) : null}
                          {condition.type === 'selfStatus' ? (
                            <>
                              <select
                                aria-label="自身状态"
                                className={fieldClass}
                                value={statusKey(
                                  condition.kind,
                                  condition.statusId,
                                )}
                                onChange={(event) => {
                                  const choice = statusChoices.self.find(
                                    (item) =>
                                      statusKey(item.kind, item.statusId) ===
                                      event.target.value,
                                  );
                                  if (choice)
                                    replaceRule(index, {
                                      ...rule,
                                      conditions: rule.conditions.map(
                                        (item, i) =>
                                          i === at
                                            ? {
                                                ...condition,
                                                kind: choice.kind,
                                                statusId: choice.statusId,
                                              }
                                            : item,
                                      ),
                                    });
                                }}
                              >
                                {statusChoices.self.map((choice) => (
                                  <option
                                    key={statusKey(
                                      choice.kind,
                                      choice.statusId,
                                    )}
                                    value={statusKey(
                                      choice.kind,
                                      choice.statusId,
                                    )}
                                  >
                                    {choice.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                aria-label="自身状态关系"
                                className={fieldClass}
                                value={condition.present ? 'has' : 'lacks'}
                                onChange={(event) =>
                                  replaceRule(index, {
                                    ...rule,
                                    conditions: rule.conditions.map(
                                      (item, i) =>
                                        i === at
                                          ? {
                                              ...condition,
                                              present:
                                                event.target.value === 'has',
                                            }
                                          : item,
                                    ),
                                  })
                                }
                              >
                                <option value="has">已有</option>
                                <option value="lacks">没有</option>
                              </select>
                            </>
                          ) : null}
                          {condition.type === 'targetStatus' ||
                          condition.type === 'allyStatus' ? (
                            <>
                              <select
                                aria-label={
                                  condition.type === 'allyStatus'
                                    ? '己方状态'
                                    : '目标状态'
                                }
                                className={fieldClass}
                                value={statusKey(
                                  condition.kind,
                                  condition.statusId,
                                )}
                                onChange={(event) => {
                                  const choices =
                                    condition.type === 'allyStatus'
                                      ? allyStatusChoices
                                      : targetStatusChoices;
                                  const choice = choices.find(
                                    (item) =>
                                      statusKey(item.kind, item.statusId) ===
                                      event.target.value,
                                  );
                                  if (choice)
                                    replaceRule(index, {
                                      ...rule,
                                      conditions: rule.conditions.map(
                                        (item, i) =>
                                          i === at
                                            ? {
                                                ...condition,
                                                kind: choice.kind,
                                                statusId: choice.statusId,
                                                ownedBySelf: choice.ownedBySelf,
                                              }
                                            : item,
                                      ),
                                    });
                                }}
                              >
                                {(condition.type === 'allyStatus'
                                  ? allyStatusChoices
                                  : targetStatusChoices
                                ).map((choice) => (
                                  <option
                                    key={statusKey(
                                      choice.kind,
                                      choice.statusId,
                                    )}
                                    value={statusKey(
                                      choice.kind,
                                      choice.statusId,
                                    )}
                                  >
                                    {choice.side === 'ally' ? '己方' : '敌方'} ·{' '}
                                    {choice.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                aria-label={
                                  condition.type === 'allyStatus'
                                    ? '己方状态关系'
                                    : '目标状态关系'
                                }
                                className={fieldClass}
                                value={condition.present ? 'has' : 'lacks'}
                                onChange={(event) =>
                                  replaceRule(index, {
                                    ...rule,
                                    conditions: rule.conditions.map(
                                      (item, i) =>
                                        i === at
                                          ? {
                                              ...condition,
                                              present:
                                                event.target.value === 'has',
                                            }
                                          : item,
                                    ),
                                  })
                                }
                              >
                                <option value="has">已有</option>
                                <option value="lacks">没有</option>
                              </select>
                            </>
                          ) : null}
                          <button
                            type="button"
                            className="text-ink-secondary hover:text-crimson px-1 text-sm"
                            aria-label={`移除第 ${at + 1} 个条件`}
                            onClick={() =>
                              replaceRule(index, {
                                ...rule,
                                conditions: rule.conditions.filter(
                                  (_, i) => i !== at,
                                ),
                              })
                            }
                          >
                            移除
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="text-crimson hover:text-crimson/75 mt-2 text-sm disabled:opacity-40"
                      disabled={busy || rule.conditions.length >= 3}
                      onClick={() =>
                        replaceRule(index, {
                          ...rule,
                          conditions: [
                            ...rule.conditions,
                            newCondition('selfHpBelow'),
                          ],
                        })
                      }
                    >
                      ＋ {rule.conditions.length ? '再加条件' : '设置条件'}
                    </button>
                    {!rule.conditions.length ? (
                      <span className="text-ink-secondary ml-2 text-xs">
                        留空则随时尝试
                      </span>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-ink-secondary flex flex-col gap-1 text-xs">
                      优先行动
                      <select
                        className={fieldClass}
                        value={
                          rule.action.type === 'skill'
                            ? rule.action.skillId
                            : rule.action.type
                        }
                        onChange={(event) => {
                          const value = event.target.value;
                          const action: Rule['action'] =
                            value === 'attack' || value === 'defend'
                              ? { type: value }
                              : { type: 'skill', skillId: value };
                          replaceRule(index, {
                            ...rule,
                            action,
                            conditions: rule.conditions.filter((condition) => {
                              if (condition.type === 'targetHpBelow')
                                return action.type !== 'defend';
                              if (condition.type !== 'targetStatus') return true;
                              return action.type !== 'defend' &&
                                (action.type !== 'attack' ||
                                  statusChoices.target.some(
                                    (choice) =>
                                      choice.kind === condition.kind &&
                                      choice.statusId === condition.statusId &&
                                      choice.side === 'enemy',
                                  ));
                            }),
                            target:
                              value === 'defend' ||
                              (value === 'attack' &&
                                rule.target === 'lowestHpAlly')
                                ? 'best'
                                : rule.target,
                            targetScope:
                              action.type === 'skill'
                                ? rule.targetScope
                                : undefined,
                          });
                        }}
                      >
                        <option value="attack">普通攻击</option>
                        <option value="defend">防御</option>
                        {view.availableSkills.map((skill) => (
                          <option key={skill.id} value={skill.id}>
                            {skill.name}
                          </option>
                        ))}
                        {rule.action.type === 'skill' && unavailable ? (
                          <option value={rule.action.skillId}>
                            {skillName(view, rule.action.skillId)} · 未习得
                          </option>
                        ) : null}
                      </select>
                    </label>
                    <label className="text-ink-secondary flex flex-col gap-1 text-xs">
                      目标范围
                      <select
                        className={fieldClass}
                        value={rule.targetScope ?? 'any'}
                        disabled={rule.action.type !== 'skill'}
                        onChange={(event) =>
                          replaceRule(index, {
                            ...rule,
                            targetScope: event.target.value as NonNullable<
                              Rule['targetScope']
                            >,
                          })
                        }
                      >
                        {targetScopeChoices.map((scope) => (
                          <option key={scope.value} value={scope.value}>
                            {scope.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-ink-secondary flex flex-col gap-1 text-xs">
                      目标
                      <select
                        className={fieldClass}
                        value={rule.target}
                        disabled={rule.action.type === 'defend'}
                        onChange={(event) =>
                          replaceRule(index, {
                            ...rule,
                            target: event.target.value as Rule['target'],
                          })
                        }
                      >
                        {targetChoices
                          .filter(
                            (target) =>
                              rule.action.type !== 'attack' ||
                              target.value !== 'lowestHpAlly',
                          )
                          .map((target) => (
                            <option key={target.value} value={target.value}>
                              {target.label}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="border-ink/10 flex flex-wrap gap-x-3 border-t pt-2 text-sm">
                    <InkButton
                      variant="secondary"
                      disabled={busy || index === 0}
                      onClick={() => moveRule(index, -1)}
                    >
                      前移
                    </InkButton>
                    <InkButton
                      variant="secondary"
                      disabled={busy || index === draft.rules.length - 1}
                      onClick={() => moveRule(index, 1)}
                    >
                      后移
                    </InkButton>
                    <InkButton
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setDraft({
                          ...draft,
                          rules: draft.rules.filter((_, at) => at !== index),
                        });
                        setEditingIndex(null);
                      }}
                    >
                      删除此招
                    </InkButton>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
        <li className="text-ink-secondary flex items-center gap-3 px-2 py-3 text-sm sm:px-3">
          <span className="min-w-7 font-mono">—</span>
          <span>其余情况 · 临场应变</span>
        </li>
      </ol>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <InkButton
          variant="outline"
          disabled={busy || draft.rules.length >= MAX_AUTO_STRATEGY_RULES}
          onClick={() => {
            setDraft({
              ...draft,
              rules: [
                ...draft.rules,
                { conditions: [], action: { type: 'attack' }, target: 'best' },
              ],
            });
            setEditingIndex(draft.rules.length);
          }}
        >
          添一招
        </InkButton>
        {changed ? (
          <InkButton
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setDraft(structuredClone(saved));
              setEditingIndex(null);
              setMessage(null);
            }}
          >
            撤销改动
          </InkButton>
        ) : null}
        <InkButton
          variant="primary"
          pending={busy}
          disabled={!changed && Boolean(view.customStrategy)}
          onClick={() => void save()}
        >
          保存战术
        </InkButton>
        {view.customStrategy ? (
          <InkButton
            variant="secondary"
            disabled={busy}
            onClick={() => void reset()}
          >
            恢复流派战术
          </InkButton>
        ) : null}
      </div>
      {draft.rules.length > MAX_AUTO_STRATEGY_RULES ? (
        <p className="text-crimson text-xs">
          旧战术超过 {MAX_AUTO_STRATEGY_RULES} 条，请删减后保存。
        </p>
      ) : null}
      <p className="text-ink-secondary text-xs leading-5">
        未习得的招式会自动略过；改动从下一场战斗生效。灵兽自行选择法术或普攻。
      </p>
      {message ? <SettingsMessage>{message}</SettingsMessage> : null}
    </div>
  );
}
