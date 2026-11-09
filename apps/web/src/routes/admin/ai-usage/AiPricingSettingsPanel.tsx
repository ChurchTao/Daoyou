import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { apiFetch } from '@app/lib/api/fetch';
import type {
  AdminAiPricingResponse,
  AiPricingSettings,
} from '@daoyou/contracts/admin/ai-pricing';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

type PricingDraft = {
  id: string;
  provider: string;
  modelId: string;
  currency: string;
  input: string;
  output: string;
  cachedInput: string;
};
type PricingModel = AiPricingSettings['models'][number];

function draftModel(model: PricingModel): PricingDraft {
  return {
    ...model,
    id: crypto.randomUUID(),
    input: String(model.input),
    output: String(model.output),
    cachedInput:
      model.cachedInput === undefined ? '' : String(model.cachedInput),
  };
}

function parsePrice(value: string, label: string): number {
  const text = value.trim();
  if (!text) throw new Error(`请填写${label}，免费请明确填 0。`);
  const amount = Number(text);
  if (
    !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 1_000_000
  ) {
    throw new Error(`${label}必须为 0 到 1,000,000 之间的有效数字。`);
  }
  return amount;
}

function parseDrafts(drafts: PricingDraft[]): AiPricingSettings {
  if (drafts.length > 200) throw new Error('最多保存 200 条模型价格规则。');
  const models: PricingModel[] = [];
  const seen = new Set<string>();
  for (const [index, draft] of drafts.entries()) {
    const prefix = `第 ${index + 1} 条规则：`;
    const provider = draft.provider.trim();
    const modelId = draft.modelId.trim();
    const currency = draft.currency.trim();
    if (!provider || !modelId)
      throw new Error(`${prefix}请填写供应商和精确模型 ID。`);
    if (provider.length > 120 || modelId.length > 240)
      throw new Error(`${prefix}供应商最多 120 字符，模型 ID 最多 240 字符。`);
    if (!/^[A-Z]{3}$/.test(currency))
      throw new Error(`${prefix}币种须为 3 位大写字母，如 CNY。`);
    const key = JSON.stringify([provider, modelId]);
    if (seen.has(key))
      throw new Error(`${prefix}供应商与模型 ID 的组合重复，请合并规则。`);
    seen.add(key);
    models.push({
      provider,
      modelId,
      currency,
      input: parsePrice(draft.input, `${prefix}输入价`),
      output: parsePrice(draft.output, `${prefix}输出价`),
      ...(draft.cachedInput.trim()
        ? { cachedInput: parsePrice(draft.cachedInput, `${prefix}缓存输入价`) }
        : {}),
    });
  }
  return { models };
}

async function requestPricing(
  signal: AbortSignal,
  settings?: AiPricingSettings,
): Promise<AdminAiPricingResponse> {
  const response = await apiFetch('/api/admin/ai-pricing', {
    signal,
    cache: 'no-store',
    ...(settings
      ? {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        }
      : {}),
  });
  const payload = (await response.json()) as AdminAiPricingResponse & {
    error?: string;
    message?: string;
  };
  if (
    !response.ok ||
    !Array.isArray(payload.settings?.models) ||
    !payload.defaults
  )
    throw new Error(
      payload.error ?? payload.message ?? '模型价格规则请求失败，请稍后重试。',
    );
  return payload;
}

export function AiPricingSettingsPanel() {
  const [saved, setSaved] = useState<AdminAiPricingResponse | null>(null);
  const [drafts, setDrafts] = useState<PricingDraft[]>([]);
  const [pending, setPending] = useState<'load' | 'save' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null);
  const providerListId = useId();

  useEffect(() => () => request.current?.abort(), []);

  const updateDraft = (id: string, patch: Partial<PricingDraft>) => {
    setDrafts((previous) =>
      previous.map((draft) =>
        draft.id === id ? { ...draft, ...patch } : draft,
      ),
    );
    setNotice('');
  };

  const send = async (settings?: AiPricingSettings) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPending(settings ? 'save' : 'load');
    setError('');
    setNotice('');
    try {
      const data = await requestPricing(controller.signal, settings);
      if (controller.signal.aborted) return;
      setSaved(data);
      setDrafts(data.settings.models.map(draftModel));
      if (settings)
        setNotice('已保存。请重启 API 后生效，历史用量与费用不会重算。');
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : '模型价格规则请求失败。',
        );
    } finally {
      if (!controller.signal.aborted) setPending(null);
    }
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    try {
      const settings = parseDrafts(drafts);
      void send(settings);
    } catch (cause) {
      setNotice('');
      setError(cause instanceof Error ? cause.message : '请检查价格规则。');
    }
  };

  return (
    <details
      className="border-ink/15 border-y py-4"
      onToggle={(event) => {
        if (event.currentTarget.open && !saved && !pending) void send();
      }}
    >
      <summary className="text-ink-secondary cursor-pointer text-sm">
        模型价格规则 · 保存后重启 API 生效
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-ink-secondary text-sm leading-6">
          按供应商实际名称与精确模型 ID 匹配，价格单位为每百万 tokens。
          未配置的模型默认按人民币输入 <span className="font-mono">1</span>
          、输出 <span className="font-mono">2</span>{' '}
          估算；缓存输入未填时按普通输入价计算。 保存后须重启
          API，历史用量与费用不会重算。
        </p>
        {error ? (
          <p role="alert" className="text-crimson text-sm leading-6">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-ink text-sm leading-6">
            {notice}
          </p>
        ) : null}
        <form onSubmit={save} noValidate aria-busy={Boolean(pending)}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <InkButton
              onClick={() => void send()}
              disabled={pending === 'save'}
              pending={pending === 'load'}
              pendingLabel="加载中……"
            >
              {saved ? '重新加载（丢弃未保存修改）' : '加载价格规则'}
            </InkButton>
            {saved ? (
              <>
                <InkButton
                  disabled={Boolean(pending) || drafts.length >= 200}
                  onClick={() => {
                    setDrafts((previous) => [
                      ...previous,
                      draftModel({
                        provider: '',
                        modelId: '',
                        ...saved.defaults,
                      }),
                    ]);
                    setNotice('');
                  }}
                >
                  添加规则
                </InkButton>
                <InkButton
                  type="submit"
                  variant="primary"
                  disabled={pending === 'load'}
                  pending={pending === 'save'}
                  pendingLabel="保存中……"
                >
                  保存全部规则
                </InkButton>
              </>
            ) : null}
          </div>
          {saved ? (
            drafts.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1020px] text-left text-sm">
                  <thead className="text-ink-secondary">
                    <tr>
                      {[
                        '供应商实际名称',
                        '精确模型 ID',
                        '币种',
                        '输入价',
                        '输出价',
                        '缓存输入价',
                        '操作',
                      ].map((label) => (
                        <th key={label} className="px-2 pb-3 font-normal">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((draft, index) => (
                      <tr key={draft.id} className="border-ink/10 border-t">
                        <td className="w-52 px-2 py-3">
                          <InkInput
                            aria-label={`第 ${index + 1} 条供应商实际名称`}
                            value={draft.provider}
                            onChange={(provider) =>
                              updateDraft(draft.id, { provider })
                            }
                            placeholder="alibaba.chat"
                            list={providerListId}
                            maxLength={120}
                            disabled={Boolean(pending)}
                            className="font-mono"
                            required
                          />
                        </td>
                        <td className="min-w-60 px-2 py-3">
                          <InkInput
                            aria-label={`第 ${index + 1} 条精确模型 ID`}
                            value={draft.modelId}
                            onChange={(modelId) =>
                              updateDraft(draft.id, { modelId })
                            }
                            placeholder="qwen3.7-flash"
                            maxLength={240}
                            disabled={Boolean(pending)}
                            className="font-mono"
                            required
                          />
                        </td>
                        <td className="w-24 px-2 py-3">
                          <InkInput
                            aria-label={`第 ${index + 1} 条币种`}
                            value={draft.currency}
                            onChange={(currency) =>
                              updateDraft(draft.id, {
                                currency: currency.toUpperCase(),
                              })
                            }
                            maxLength={3}
                            placeholder="CNY"
                            disabled={Boolean(pending)}
                            className="font-mono"
                            required
                          />
                        </td>
                        {(['input', 'output', 'cachedInput'] as const).map(
                          (field) => (
                            <td key={field} className="w-36 px-2 py-3">
                              <InkInput
                                aria-label={`第 ${index + 1} 条${field === 'input' ? '输入价' : field === 'output' ? '输出价' : '缓存输入价'}`}
                                value={draft[field]}
                                onChange={(value) =>
                                  updateDraft(draft.id, { [field]: value })
                                }
                                inputMode="decimal"
                                placeholder={
                                  field === 'cachedInput'
                                    ? '按输入价'
                                    : undefined
                                }
                                disabled={Boolean(pending)}
                                className="font-mono"
                                required={field !== 'cachedInput'}
                              />
                            </td>
                          ),
                        )}
                        <td className="px-2 py-3">
                          <InkButton
                            disabled={Boolean(pending)}
                            onClick={() => {
                              setDrafts((previous) =>
                                previous.filter((row) => row.id !== draft.id),
                              );
                              setNotice('');
                            }}
                          >
                            删除
                          </InkButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <datalist id={providerListId}>
                  <option value="alibaba.chat" />
                  <option value="deepseek.chat" />
                </datalist>
              </div>
            ) : (
              <p className="text-ink-secondary text-sm leading-6">
                暂无模型规则。可添加规则覆盖默认估算价。
              </p>
            )
          ) : null}
        </form>
      </div>
    </details>
  );
}
