import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkSelect } from '@app/components/ui/InkSelect';
import { LLM_STORAGE_KEY, readStoredLlmConfig } from '@app/lib/llmConfig';
import {
  LLM_PROVIDER_DEFAULT_MODELS,
  LlmByokConfigSchema,
  type LlmProviderId,
} from '@shared/config/llm';
import { useState } from 'react';
import {
  SettingsMessage,
  SettingsSection,
  settingsLabelClass,
} from './SettingsFields';

const PROVIDER_LABELS: Record<LlmProviderId, string> = {
  deepseek: 'DeepSeek',
  alibaba: '阿里云百炼（Qwen）',
};

export function ModelConfigTab() {
  const stored = readStoredLlmConfig();
  const [provider, setProvider] = useState<LlmProviderId>(
    stored?.provider ?? 'alibaba',
  );
  const [apiKey, setApiKey] = useState(stored?.apiKey ?? '');
  const [model, setModel] = useState(
    stored?.model ?? LLM_PROVIDER_DEFAULT_MODELS.alibaba,
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [hasConfig, setHasConfig] = useState(!!stored);

  const canSubmit = apiKey.trim() && model.trim() && !loading;

  const handleProviderChange = (value: string) => {
    const next = value as LlmProviderId;
    setProvider(next);
    setModel(LLM_PROVIDER_DEFAULT_MODELS[next]);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const parsed = LlmByokConfigSchema.safeParse({ provider, apiKey, model });
    if (!parsed.success) {
      setMessage({ type: 'error', text: '配置格式无效' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(parsed.data));
      setHasConfig(true);
      setMessage({ type: 'success', text: '配置已保存到浏览器本地。' });
    } catch {
      setMessage({ type: 'error', text: '保存失败，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    localStorage.removeItem(LLM_STORAGE_KEY);
    setProvider('alibaba');
    setApiKey('');
    setModel(LLM_PROVIDER_DEFAULT_MODELS.alibaba);
    setHasConfig(false);
    setMessage({
      type: 'success',
      text: '已清除本地配置，恢复为服务器默认模型。',
    });
  };

  return (
    <div className="space-y-5">
      <InkSelect
        label="供应商"
        value={provider}
        onChange={handleProviderChange}
        labelClassName={settingsLabelClass}
      >
        <option value="deepseek">{PROVIDER_LABELS.deepseek}</option>
        <option value="alibaba">{PROVIDER_LABELS.alibaba}</option>
      </InkSelect>

      <InkInput
        label="API Key"
        type="password"
        placeholder="sk-..."
        value={apiKey}
        onChange={setApiKey}
        size="sm"
        labelClassName={settingsLabelClass}
      />

      <InkInput
        label="模型"
        placeholder={LLM_PROVIDER_DEFAULT_MODELS[provider]}
        value={model}
        onChange={setModel}
        size="sm"
        labelClassName={settingsLabelClass}
      />

      <div className="flex flex-wrap items-center gap-3">
        <InkButton
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          pending={loading}
          pendingLabel="保存中……"
        >
          保存配置
        </InkButton>

        {hasConfig ? (
          <InkButton
            variant="secondary"
            onClick={handleClear}
            disabled={loading}
          >
            清除配置
          </InkButton>
        ) : null}

        {message ? (
          <SettingsMessage type={message.type}>{message.text}</SettingsMessage>
        ) : null}
      </div>

      <SettingsSection>
        <p className="text-ink-secondary text-sm leading-6">
          支持 DeepSeek 与阿里云百炼（Qwen）。配置保存在浏览器 localStorage
          中，仅当前设备生效，更换浏览器或清除缓存后需要重新配置。
          <br />
          API Key
          仅在前端本地存储，服务端通过请求头获取并调用，不会在服务器持久化保存。
        </p>
      </SettingsSection>
    </div>
  );
}
