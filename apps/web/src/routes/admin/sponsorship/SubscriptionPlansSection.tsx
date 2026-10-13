import { RewardSelectionEditor } from '@app/routes/admin/_components/RewardSelectionEditor';
import { InkButton } from '@app/components/ui/InkButton';
import { useState } from 'react';
import type { EditableSubscriptionPlan } from './SubscriptionPlansSection.helpers';

export function SubscriptionPlansSection({
  plans,
  disabled,
  onChange,
}: {
  plans: EditableSubscriptionPlan[];
  disabled: boolean;
  onChange: (plans: EditableSubscriptionPlan[]) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const update = (index: number, patch: Partial<EditableSubscriptionPlan>) =>
    onChange(plans.map((plan, item) => (item === index ? { ...plan, ...patch } : plan)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-secondary max-w-xl text-sm">
          等级数字越大，当天越优先发放这一份。点开某一条再改物资。清空后保存，会按已填写的功德档位重新生成。
        </p>
        <InkButton
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            const id = `plan_${crypto.randomUUID().replaceAll('-', '')}`;
            onChange([
              ...plans,
              {
                id,
                level: String(
                  plans.reduce(
                    (highest, plan) => Math.max(highest, Number(plan.level) || 0),
                    0,
                  ) + 1,
                ),
                name: '',
                afdianPlanId: '',
                enabled: true,
                rewards: [],
              },
            ]);
            setOpenId(id);
          }}
        >
          添加方案
        </InkButton>
      </div>
      {plans.map((plan, index) => {
        const open = openId === plan.id;
        return (
        <article key={plan.id} className="border-ink/15 border-b py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base">{plan.name || '未命名方案'}</p>
              <p className="text-ink-secondary mt-1 text-xs">
                等级 <span className="font-mono font-semibold">{plan.level || '—'}</span>
                {' · '}
                <span className="font-mono">{plan.afdianPlanId || '未填方案 ID'}</span>
                {' · '}
                {plan.enabled ? '发放中' : '已停发'}
              </p>
            </div>
            <div className="flex gap-3">
              <InkButton
                variant={open ? 'primary' : 'secondary'}
                disabled={disabled}
                onClick={() => setOpenId(open ? null : plan.id)}
              >
                {open ? '收起' : '编辑'}
              </InkButton>
              <InkButton
                variant="ghost"
                disabled={disabled}
                onClick={() => {
                  if (open) setOpenId(null);
                  onChange(plans.filter((item) => item.id !== plan.id));
                }}
              >
                移除
              </InkButton>
            </div>
          </div>
          {open && (
            <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm">
              名称
              <input
                className="mt-1 w-full border p-2 text-base"
                value={plan.name}
                disabled={disabled}
                onChange={(event) => update(index, { name: event.target.value })}
              />
            </label>
            <label className="text-sm">
              等级
              <input
                className="mt-1 w-full border p-2 font-mono text-base font-semibold"
                inputMode="numeric"
                value={plan.level}
                disabled={disabled}
                onChange={(event) => update(index, { level: event.target.value })}
              />
            </label>
            <label className="text-sm md:col-span-2">
              爱发电 plan_id
              <input
                className="mt-1 w-full border p-2 font-mono text-base"
                value={plan.afdianPlanId}
                disabled={disabled}
                onChange={(event) =>
                  update(index, { afdianPlanId: event.target.value })
                }
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={plan.enabled}
              disabled={disabled}
              onChange={(event) => update(index, { enabled: event.target.checked })}
            />
            启用每日补给
          </label>
          <RewardSelectionEditor
            value={plan.rewards}
            disabled={disabled}
            allowEmpty
            onChange={(rewards) => update(index, { rewards })}
          />
            </div>
          )}
        </article>
        );
      })}
      {plans.length === 0 && (
        <p className="text-ink-secondary text-sm">尚未配置订阅方案。</p>
      )}
    </div>
  );
}
